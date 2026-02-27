import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BC_BASE = "https://apinewintegracao.bomcontrole.com.br/integracao";

interface SyncItem {
  portal_company_id: string;
  valor_total_mes: number;
}

interface SyncResult {
  portal_company_id: string;
  status: string;
  message?: string;
  bc_invoice_id?: number;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getApiKey(tenantId: string): string {
  const envKey = `BOMCONTROLE_API_KEY_${tenantId.toUpperCase()}`;
  const key = Deno.env.get(envKey);
  if (!key) throw new Error(`Secret ${envKey} not configured`);
  return key;
}

function sanitizeForLog(obj: unknown): unknown {
  if (!obj) return obj;
  const s = JSON.stringify(obj);
  return JSON.parse(s.replace(/ApiKey\s+[^\s"]+/gi, "ApiKey ***"));
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("Unreachable");
}

// deno-lint-ignore no-explicit-any
async function logAction(supabase: any, tenantId: string, competencia: string | null, portalCompanyId: string | null, action: string, ok: boolean, durationMs: number, requestJson: unknown, responseJson: unknown) {
  await supabase.from("bc_sync_log").insert({
    tenant_id: tenantId, competencia, portal_company_id: portalCompanyId, action, ok,
    duration_ms: durationMs, request_json: sanitizeForLog(requestJson), response_json: sanitizeForLog(responseJson),
  });
}

// deno-lint-ignore no-explicit-any
async function upsertInvoiceMap(supabase: any, tenantId: string, portalCompanyId: string, competencia: string, bcContractId: number, bcInvoiceId: number, dueDate: string | null, lastSyncedValue: number | null, status: string, message: string | null) {
  const row: Record<string, unknown> = {
    tenant_id: tenantId, portal_company_id: portalCompanyId, competencia,
    bc_contract_id: bcContractId, bc_invoice_id: bcInvoiceId,
    due_date: dueDate, last_synced_value: lastSyncedValue, status, message,
  };
  if (lastSyncedValue != null) row.synced_at = new Date().toISOString();
  await supabase.from("bc_invoice_map").upsert(row, { onConflict: "tenant_id,portal_company_id,competencia" });
}

// deno-lint-ignore no-explicit-any
async function syncInvoiceValues(supabase: any, tenantId: string, competencia: string, items: SyncItem[], apiKey: string): Promise<SyncResult[]> {
  const [yearStr, monthStr] = competencia.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const lastDay = lastDayOfMonth(year, month);
  const inicioPeriodo = `${competencia}-01 00:00:00`;
  const terminoPeriodo = `${competencia}-${String(lastDay).padStart(2, "0")} 23:59:59`;
  const results: SyncResult[] = [];

  for (const item of items) {
    const t0 = Date.now();
    try {
      const { data: contract } = await supabase.from("bc_contracts").select("bc_contract_id").eq("tenant_id", tenantId).eq("portal_company_id", item.portal_company_id).eq("active", true).maybeSingle();
      if (!contract) {
        results.push({ portal_company_id: item.portal_company_id, status: "failed", message: "Contrato não encontrado em bc_contracts" });
        await logAction(supabase, tenantId, competencia, item.portal_company_id, "resolve_invoice", false, Date.now() - t0, null, { error: "no contract" });
        continue;
      }

      const bcContractId = contract.bc_contract_id;
      const url = `${BC_BASE}/VendaContrato/Obter/${bcContractId}?inicioPeriodo=${encodeURIComponent(inicioPeriodo)}&terminoPeriodo=${encodeURIComponent(terminoPeriodo)}`;
      const res = await fetchWithRetry(url, { headers: { Authorization: `ApiKey ${apiKey}`, "Content-Type": "application/json" } });

      if (!res.ok) {
        const errText = await res.text();
        results.push({ portal_company_id: item.portal_company_id, status: "failed", message: `BC API ${res.status}: ${errText.substring(0, 200)}` });
        await logAction(supabase, tenantId, competencia, item.portal_company_id, "resolve_invoice", false, Date.now() - t0, { url }, { status: res.status, body: errText.substring(0, 500) });
        continue;
      }

      const contractData = await res.json();
      // deno-lint-ignore no-explicit-any
      const faturas: any[] = contractData?.Faturas ?? [];
      // deno-lint-ignore no-explicit-any
      let invoice: any = null;
      let status = "synced";
      let message: string | undefined;

      if (faturas.length === 0) {
        results.push({ portal_company_id: item.portal_company_id, status: "not_found", message: "Nenhuma fatura encontrada no período" });
        await logAction(supabase, tenantId, competencia, item.portal_company_id, "resolve_invoice", true, Date.now() - t0, { url }, { faturas_count: 0 });
        await upsertInvoiceMap(supabase, tenantId, item.portal_company_id, competencia, bcContractId, 0, null, null, "not_found", "Nenhuma fatura no período");
        continue;
      }

      if (faturas.length === 1) {
        invoice = faturas[0];
      } else {
        // deno-lint-ignore no-explicit-any
        const faturamento = faturas.filter((f: any) => f.TipoFatura === 0);
        if (faturamento.length === 1) {
          invoice = faturamento[0];
        } else {
          const midMonth = new Date(year, month - 1, 15).getTime();
          // deno-lint-ignore no-explicit-any
          invoice = faturas.reduce((best: any, f: any) => {
            const d = Math.abs(new Date(f.DataVencimento).getTime() - midMonth);
            const bestD = Math.abs(new Date(best.DataVencimento).getTime() - midMonth);
            return d < bestD ? f : best;
          });
        }
        status = "warning_multiple";
        message = `${faturas.length} faturas encontradas, selecionada Id=${invoice.Id}`;
      }

      const bcInvoiceId = invoice.Id;
      await logAction(supabase, tenantId, competencia, item.portal_company_id, "resolve_invoice", true, Date.now() - t0, { url }, { faturas_count: faturas.length, selected_id: bcInvoiceId });

      // Check if value changed
      const { data: existingMap } = await supabase.from("bc_invoice_map").select("last_synced_value").eq("tenant_id", tenantId).eq("portal_company_id", item.portal_company_id).eq("competencia", competencia).maybeSingle();
      if (existingMap && Number(existingMap.last_synced_value) === item.valor_total_mes) {
        await upsertInvoiceMap(supabase, tenantId, item.portal_company_id, competencia, bcContractId, bcInvoiceId, invoice.DataVencimento, item.valor_total_mes, "unchanged", null);
        results.push({ portal_company_id: item.portal_company_id, status: "unchanged", bc_invoice_id: bcInvoiceId });
        continue;
      }

      // Update value via PUT
      const t1 = Date.now();
      const putUrl = `${BC_BASE}/Fatura/AlterarValor/${bcInvoiceId}`;
      const putRes = await fetchWithRetry(putUrl, {
        method: "PUT",
        headers: { Authorization: `ApiKey ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ Valor: item.valor_total_mes }),
      });
      const putBody = await putRes.text();
      await logAction(supabase, tenantId, competencia, item.portal_company_id, "update_value", putRes.ok, Date.now() - t1, { url: putUrl, body: { Valor: item.valor_total_mes } }, { status: putRes.status, body: putBody.substring(0, 500) });

      if (!putRes.ok) {
        await upsertInvoiceMap(supabase, tenantId, item.portal_company_id, competencia, bcContractId, bcInvoiceId, invoice.DataVencimento, null, "failed", `PUT ${putRes.status}: ${putBody.substring(0, 200)}`);
        results.push({ portal_company_id: item.portal_company_id, status: "failed", message: `PUT ${putRes.status}`, bc_invoice_id: bcInvoiceId });
        continue;
      }

      await upsertInvoiceMap(supabase, tenantId, item.portal_company_id, competencia, bcContractId, bcInvoiceId, invoice.DataVencimento, item.valor_total_mes, status, message ?? null);
      results.push({ portal_company_id: item.portal_company_id, status, bc_invoice_id: bcInvoiceId, message });
    } catch (err) {
      results.push({ portal_company_id: item.portal_company_id, status: "failed", message: String(err).substring(0, 300) });
      await logAction(supabase, tenantId, competencia, item.portal_company_id, "resolve_invoice", false, Date.now() - t0, null, { error: String(err).substring(0, 500) });
    }
  }

  return results;
}

function getMesKeyFromCompetencia(competencia: string): string | null {
  const month = parseInt(competencia.split("-")[1]);
  const keys = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return keys[month - 1] ?? null;
}

function formatDateBR(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } catch {
    return isoDate;
  }
}

// deno-lint-ignore no-explicit-any
async function syncPayments(supabase: any, tenantId: string, apiKey: string): Promise<{ processed: number; paid: number; errors: number }> {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const { data: unpaid } = await supabase.from("bc_invoice_map").select("*").eq("tenant_id", tenantId).eq("paid", false).in("competencia", months).not("status", "in", '("not_found","failed")');
  if (!unpaid || unpaid.length === 0) return { processed: 0, paid: 0, errors: 0 };

  let paidCount = 0;
  let errorCount = 0;

  for (const inv of unpaid) {
    const t0 = Date.now();
    try {
      const [yearStr, monthStr] = inv.competencia.split("-");
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      const lastDay = lastDayOfMonth(year, month);
      const inicioPeriodo = `${inv.competencia}-01 00:00:00`;
      const terminoPeriodo = `${inv.competencia}-${String(lastDay).padStart(2, "0")} 23:59:59`;

      const url = `${BC_BASE}/VendaContrato/Obter/${inv.bc_contract_id}?inicioPeriodo=${encodeURIComponent(inicioPeriodo)}&terminoPeriodo=${encodeURIComponent(terminoPeriodo)}`;
      const res = await fetchWithRetry(url, { headers: { Authorization: `ApiKey ${apiKey}`, "Content-Type": "application/json" } });

      if (!res.ok) {
        errorCount++;
        await logAction(supabase, tenantId, inv.competencia, inv.portal_company_id, "sync_payment", false, Date.now() - t0, { url }, { status: res.status });
        continue;
      }

      const data = await res.json();
      // deno-lint-ignore no-explicit-any
      const fatura = (data?.Faturas ?? []).find((f: any) => f.Id === inv.bc_invoice_id);

      if (!fatura) {
        await logAction(supabase, tenantId, inv.competencia, inv.portal_company_id, "sync_payment", true, Date.now() - t0, { url }, { message: "invoice not found in response" });
        continue;
      }

      if (fatura.Quitado === true && fatura.DataPagamento) {
        await supabase.from("bc_invoice_map").update({
          paid: true, payment_date: fatura.DataPagamento, payment_value: fatura.ValorPagamento ?? fatura.Valor, last_payment_sync_at: new Date().toISOString(),
        }).eq("id", inv.id);

        const { data: honEmpresa } = await supabase.from("honorarios_empresas").select("id, meses").eq("empresa_id", inv.portal_company_id).maybeSingle();
        if (honEmpresa) {
          const mesKey = getMesKeyFromCompetencia(inv.competencia);
          if (mesKey) {
            const meses = honEmpresa.meses ?? {};
            const mesData = meses[mesKey] ?? {};
            meses[mesKey] = { ...mesData, data_pagamento: formatDateBR(fatura.DataPagamento) };
            await supabase.from("honorarios_empresas").update({ meses }).eq("id", honEmpresa.id);
          }
        }

        paidCount++;
        await logAction(supabase, tenantId, inv.competencia, inv.portal_company_id, "sync_payment", true, Date.now() - t0, { url }, { paid: true, payment_date: fatura.DataPagamento });
      }
    } catch (err) {
      errorCount++;
      await logAction(supabase, tenantId, inv.competencia, inv.portal_company_id, "sync_payment", false, Date.now() - t0, null, { error: String(err).substring(0, 500) });
    }
  }

  return { processed: unpaid.length, paid: paidCount, errors: errorCount };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = url.searchParams.get("action") ?? body.action ?? "sync_values";

    if (action === "sync_values") {
      const { tenant_id, competencia, items } = body as { tenant_id: string; competencia: string; items: SyncItem[] };

      if (!tenant_id || !competencia || !items?.length) {
        return new Response(JSON.stringify({ error: "Missing tenant_id, competencia, or items" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const apiKey = getApiKey(tenant_id);
      const results = await syncInvoiceValues(supabase, tenant_id, competencia, items, apiKey);
      const summary = {
        total: results.length,
        synced: results.filter((r) => r.status === "synced").length,
        unchanged: results.filter((r) => r.status === "unchanged").length,
        not_found: results.filter((r) => r.status === "not_found").length,
        warning_multiple: results.filter((r) => r.status === "warning_multiple").length,
        failed: results.filter((r) => r.status === "failed").length,
      };

      return new Response(JSON.stringify({ summary, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sync_payments") {
      const tenantId = url.searchParams.get("tenant_id") ?? body.tenant_id ?? "contmax";
      const apiKey = getApiKey(tenantId);
      const result = await syncPayments(supabase, tenantId, apiKey);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sync-bomcontrole error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
