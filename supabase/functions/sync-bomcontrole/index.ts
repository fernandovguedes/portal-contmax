import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BC_BASE = "https://apinewintegracao.bomcontrole.com.br/integracao";

// Parcela 1 = competência fevereiro (venc março), Parcela 10 = comp novembro (venc dezembro)
const COMPETENCIA_OFFSET: Record<string, number> = {
  "2026-02": 0, "2026-03": 1, "2026-04": 2, "2026-05": 3,
  "2026-06": 4, "2026-07": 5, "2026-08": 6, "2026-09": 7,
  "2026-10": 8, "2026-11": 9,
};

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

function getApiKey(tenantId: string): string {
  const envKey = `BOMCONTROLE_API_KEY_${tenantId.toUpperCase()}`;
  const key = Deno.env.get(envKey);
  if (!key) throw new Error(`Secret ${envKey} not configured`);
  return key;
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 && i < retries) {
        await new Promise((r) => setTimeout(r, 5000 * (i + 1)));
        continue;
      }
      return res;
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("Unreachable");
}

// deno-lint-ignore no-explicit-any
async function syncInvoiceValues(supabase: any, tenantId: string, competencia: string, items: SyncItem[], apiKey: string): Promise<{ summary: any; results: SyncResult[] }> {
  const results: SyncResult[] = [];
  const offset = COMPETENCIA_OFFSET[competencia];

  if (offset === undefined) {
    return {
      summary: { total: 0, synced: 0, unchanged: 0, not_found: 0, warning_multiple: 0, failed: 1 },
      results: [{ portal_company_id: "all", status: "failed", message: `Competência ${competencia} fora do período (2026-02 a 2026-11)` }],
    };
  }

  // Build items map for quick lookup
  const itemsMap = new Map<string, number>();
  for (const item of items) {
    itemsMap.set(item.portal_company_id, item.valor_total_mes);
  }

  // Single query: join honorarios_empresas with bc_invoice_map to find differences
  const { data: empresas, error: dbError } = await supabase
    .from("honorarios_empresas")
    .select("empresa_id, bc_contrato_id, bc_fatura_id")
    .not("bc_fatura_id", "is", null);

  if (dbError) {
    return {
      summary: { total: 0, synced: 0, unchanged: 0, not_found: 0, warning_multiple: 0, failed: 1 },
      results: [{ portal_company_id: "all", status: "failed", message: `DB: ${dbError.message}` }],
    };
  }

  // Load existing synced values in one query
  const { data: existingMaps } = await supabase
    .from("bc_invoice_map")
    .select("portal_company_id, last_synced_value")
    .eq("tenant_id", tenantId)
    .eq("competencia", competencia);

  const lastSyncedMap = new Map<string, number>();
  for (const m of (existingMaps || [])) {
    lastSyncedMap.set(m.portal_company_id, Number(m.last_synced_value));
  }

  // Find items that need updating (value changed)
  const toUpdate: Array<{ empresa_id: string; bc_contrato_id: number; bc_fatura_id: number; bcInvoiceId: number; valor: number }> = [];
  let unchangedCount = 0;
  let notFoundCount = 0;

  for (const emp of (empresas || [])) {
    const valor = itemsMap.get(emp.empresa_id);
    if (valor === undefined) continue; // not in items list

    const bcInvoiceId = emp.bc_fatura_id + offset;
    const lastSynced = lastSyncedMap.get(emp.empresa_id);

    if (lastSynced !== undefined && lastSynced === valor) {
      unchangedCount++;
      continue; // Skip - no API call, no DB write
    }

    toUpdate.push({
      empresa_id: emp.empresa_id,
      bc_contrato_id: emp.bc_contrato_id,
      bc_fatura_id: emp.bc_fatura_id,
      bcInvoiceId,
      valor,
    });
  }

  // Count items without bc_fatura_id
  const empresaIds = new Set((empresas || []).map((e: any) => e.empresa_id));
  for (const item of items) {
    if (!empresaIds.has(item.portal_company_id)) {
      notFoundCount++;
    }
  }

  // Process updates in batches of 3
  let syncedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < toUpdate.length; i += 3) {
    const batch = toUpdate.slice(i, i + 3);
    const batchPromises = batch.map(async (emp) => {
      try {
        const putUrl = `${BC_BASE}/VendaContrato/AlterarFatura?idContrato=${emp.bc_contrato_id}&idFatura=${emp.bcInvoiceId}`;
        const res = await fetchWithRetry(putUrl, {
          method: "PUT",
          headers: { Authorization: `ApiKey ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            Servicos: [{ IdServico: 2, Quantidade: 1, ValorUnitario: emp.valor, ValorDesconto: 0 }],
            FormaPagamento: { Boleto: { Observacao: "", EmiteBoleto: true } },
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          // Update bc_invoice_map with error
          await supabase.from("bc_invoice_map").upsert({
            tenant_id: tenantId, portal_company_id: emp.empresa_id, competencia,
            bc_contract_id: emp.bc_contrato_id, bc_invoice_id: emp.bcInvoiceId,
            status: "failed", message: `PUT ${res.status}: ${body.substring(0, 100)}`,
          }, { onConflict: "tenant_id,portal_company_id,competencia" });
          failedCount++;
          results.push({ portal_company_id: emp.empresa_id, status: "failed", message: `PUT ${res.status}`, bc_invoice_id: emp.bcInvoiceId });
          return;
        }

        // Update bc_invoice_map with success
        await supabase.from("bc_invoice_map").upsert({
          tenant_id: tenantId, portal_company_id: emp.empresa_id, competencia,
          bc_contract_id: emp.bc_contrato_id, bc_invoice_id: emp.bcInvoiceId,
          last_synced_value: emp.valor, status: "synced", synced_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,portal_company_id,competencia" });
        syncedCount++;
        results.push({ portal_company_id: emp.empresa_id, status: "synced", bc_invoice_id: emp.bcInvoiceId });
      } catch (err) {
        failedCount++;
        results.push({ portal_company_id: emp.empresa_id, status: "failed", message: String(err).substring(0, 200) });
      }
    });

    await Promise.all(batchPromises);

    // Delay between batches
    if (i + 3 < toUpdate.length) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  const summary = {
    total: items.length,
    synced: syncedCount,
    unchanged: unchangedCount,
    not_found: notFoundCount,
    warning_multiple: 0,
    failed: failedCount,
  };

  return { summary, results };
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

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
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
    try {
      const url = `${BC_BASE}/Fatura/Obter/${inv.bc_invoice_id}`;
      const res = await fetchWithRetry(url, { headers: { Authorization: `ApiKey ${apiKey}`, "Content-Type": "application/json" } });
      if (!res.ok) { errorCount++; continue; }
      const fatura = await res.json();

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
      }
      await new Promise((r) => setTimeout(r, 300));
    } catch (_err) { errorCount++; }
  }

  return { processed: unpaid.length, paid: paidCount, errors: errorCount };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let integrationJobId: string | null = null;
  let tenantIntegrationId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const isInternalCall = token === serviceKey;

    if (!isInternalCall) {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const adminClient = createClient(supabaseUrl, serviceKey);
      const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    integrationJobId = body.integration_job_id || null;
    tenantIntegrationId = body.tenant_integration_id || null;
    const action = body.action ?? (integrationJobId ? "sync_payments" : "sync_values");

    if (action === "sync_values") {
      const { tenant_id, competencia, items } = body as { tenant_id: string; competencia: string; items: SyncItem[] };
      if (!tenant_id || !competencia || !items?.length) {
        return new Response(JSON.stringify({ error: "Missing tenant_id, competencia, or items" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const apiKey = getApiKey(tenant_id);
      const { summary, results } = await syncInvoiceValues(supabase, tenant_id, competencia, items, apiKey);
      return new Response(JSON.stringify({ summary, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "sync_payments") {
      let tenantSlug = body.tenant_id ?? "contmax";
      if (tenantSlug.includes("-")) {
        const { data: org } = await supabase.from("organizacoes").select("slug").eq("id", tenantSlug).maybeSingle();
        if (org) tenantSlug = org.slug;
      }
      const apiKey = getApiKey(tenantSlug);
      const result = await syncPayments(supabase, tenantSlug, apiKey);

      if (integrationJobId) {
        const executionTime = Date.now() - startTime;
        await supabase.from("integration_jobs").update({
          status: "success", progress: 100, finished_at: new Date().toISOString(), execution_time_ms: executionTime, result,
        }).eq("id", integrationJobId);
        if (tenantIntegrationId) {
          await supabase.from("tenant_integrations").update({ last_status: "success", last_error: null }).eq("id", tenantIntegrationId);
        }
        await supabase.from("integration_logs").insert({
          tenant_id: tenantSlug, integration: "bomcontrole", provider_slug: "bomcontrole",
          status: "success", execution_time_ms: executionTime, total_processados: result.processed, total_matched: result.paid,
        });
      }

      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("sync-bomcontrole error:", err);
    if (integrationJobId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey);
        await supabase.from("integration_jobs").update({
          status: "error", progress: 0, error_message: String(err), finished_at: new Date().toISOString(), execution_time_ms: Date.now() - startTime,
        }).eq("id", integrationJobId);
      } catch (_) {}
    }
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
