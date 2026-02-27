import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BC_BASE = "https://apinewintegracao.bomcontrole.com.br/integracao";
const BATCH_SIZE = 2;
const DELAY_MS = 5000;

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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 && i < retries) {
        const waitMs = 5000 * (i + 1);
        console.log(`429 received, waiting ${waitMs / 1000}s before retry ${i + 1}/${retries}`);
        await sleep(waitMs);
        continue;
      }
      return res;
    } catch (err) {
      if (i === retries) throw err;
      await sleep(1000 * (i + 1));
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

interface ContractDetail {
  bc_contract_id: number;
  portal_company_id: string;
  status: string;
  message?: string;
}

// deno-lint-ignore no-explicit-any
function hasPaidFutureInvoice(faturas: any[], competenciaCorte: string): boolean {
  const corteDate = new Date(`${competenciaCorte}-01T00:00:00Z`);
  // deno-lint-ignore no-explicit-any
  return faturas.some((f: any) => {
    const comp = f.DataCompetencia ? new Date(f.DataCompetencia) : null;
    if (!comp || comp < corteDate) return false;
    return f.Quitado === true || f.DataPagamento != null || (f.ValorPagamento != null && f.ValorPagamento > 0);
  });
}

async function fetchAllContracts(supabase: ReturnType<typeof createClient>, tenantId: string, offset: number) {
  const from = offset;
  const to = offset + BATCH_SIZE - 1;
  const { data, error } = await supabase
    .from("bc_contracts")
    .select("bc_contract_id, portal_company_id")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .eq("legacy", true)
    .order("bc_contract_id", { ascending: true })
    .range(from, to);

  if (error) throw new Error(`DB error: ${error.message}`);
  return data || [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const { tenant_id, competencia_corte, execute, offset = 0 } = body as {
      tenant_id: string; competencia_corte: string; execute: boolean; offset?: number;
    };

    if (!tenant_id || !competencia_corte) {
      return new Response(JSON.stringify({ error: "Missing tenant_id or competencia_corte" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = getApiKey(tenant_id);
    const contracts = await fetchAllContracts(supabase, tenant_id, offset);

    if (!contracts || contracts.length === 0) {
      return new Response(JSON.stringify({
        summary: { total_analisados: 0, total_ok: 0, total_bloqueados: 0, offset, finished: true },
        details: [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const details: ContractDetail[] = [];

    if (!execute) {
      // Dry-run: check each contract
      for (const c of contracts) {
        const t0 = Date.now();
        try {
          const url = `${BC_BASE}/VendaContrato/Obter/${c.bc_contract_id}`;
          const res = await fetchWithRetry(url, {
            headers: { Authorization: `ApiKey ${apiKey}`, "Content-Type": "application/json" },
          });

          if (!res.ok) {
            const errText = await res.text();
            details.push({ bc_contract_id: c.bc_contract_id, portal_company_id: c.portal_company_id, status: "error_api", message: `HTTP ${res.status}: ${errText.substring(0, 200)}` });
            await logAction(supabase, tenant_id, competencia_corte, c.portal_company_id, "dry_close_check", false, Date.now() - t0, { url }, { status: res.status });
          } else {
            const data = await res.json();
            // deno-lint-ignore no-explicit-any
            const faturas: any[] = data?.Faturas ?? [];
            const blocked = hasPaidFutureInvoice(faturas, competencia_corte);
            details.push({ bc_contract_id: c.bc_contract_id, portal_company_id: c.portal_company_id, status: blocked ? "blocked_paid_future" : "ok_to_close" });
            await logAction(supabase, tenant_id, competencia_corte, c.portal_company_id, "dry_close_check", true, Date.now() - t0, { url }, { faturas_count: faturas.length, status: blocked ? "blocked" : "ok" });
          }
        } catch (err) {
          details.push({ bc_contract_id: c.bc_contract_id, portal_company_id: c.portal_company_id, status: "error_api", message: String(err).substring(0, 300) });
          await logAction(supabase, tenant_id, competencia_corte, c.portal_company_id, "dry_close_check", false, Date.now() - t0, null, { error: String(err).substring(0, 500) });
        }
        await sleep(DELAY_MS);
      }

      const totalOk = details.filter((d) => d.status === "ok_to_close").length;
      const totalBloqueados = details.filter((d) => d.status === "blocked_paid_future").length;
      const hasMore = contracts.length === BATCH_SIZE;

      return new Response(JSON.stringify({
        summary: { total_analisados: details.length, total_ok: totalOk, total_bloqueados: totalBloqueados, offset, finished: !hasMore, ...(hasMore ? { next_offset: offset + BATCH_SIZE } : {}) },
        details,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Execute mode: verify + close in single pass
    let totalEncerrados = 0;
    let totalFalhas = 0;
    let totalBloqueados = 0;

    for (const c of contracts) {
      const t0 = Date.now();
      try {
        // Step 1: Get contract to check invoices
        const getUrl = `${BC_BASE}/VendaContrato/Obter/${c.bc_contract_id}`;
        const getRes = await fetchWithRetry(getUrl, {
          headers: { Authorization: `ApiKey ${apiKey}`, "Content-Type": "application/json" },
        });

        if (!getRes.ok) {
          const errText = await getRes.text();
          details.push({ bc_contract_id: c.bc_contract_id, portal_company_id: c.portal_company_id, status: "error_api", message: `GET HTTP ${getRes.status}: ${errText.substring(0, 200)}` });
          totalFalhas++;
          await logAction(supabase, tenant_id, competencia_corte, c.portal_company_id, "execute_get", false, Date.now() - t0, { url: getUrl }, { status: getRes.status });
          await sleep(DELAY_MS);
          continue;
        }

        const contractData = await getRes.json();
        // deno-lint-ignore no-explicit-any
        const faturas: any[] = contractData?.Faturas ?? [];
        const blocked = hasPaidFutureInvoice(faturas, competencia_corte);

        if (blocked) {
          details.push({ bc_contract_id: c.bc_contract_id, portal_company_id: c.portal_company_id, status: "blocked_paid_future" });
          totalBloqueados++;
          await logAction(supabase, tenant_id, competencia_corte, c.portal_company_id, "execute_blocked", true, Date.now() - t0, { url: getUrl }, { blocked: true });
          await sleep(DELAY_MS);
          continue;
        }

        await sleep(DELAY_MS);

        // Step 2: Close the contract
        const closeUrl = `${BC_BASE}/VendaContrato/Encerrar/${c.bc_contract_id}`;
        const closeRes = await fetchWithRetry(closeUrl, {
          method: "DELETE",
          headers: { Authorization: `ApiKey ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            DataCompetencia: `${competencia_corte}-01 00:00:00`,
            Motivo: "Encerramento para migracao contrato unico Contmax",
          }),
        });

        const closeText = await closeRes.text();

        if (closeRes.ok) {
          await supabase.from("bc_contracts").update({
            active: false, closed_at: new Date().toISOString(), closed_competencia: competencia_corte,
          }).eq("bc_contract_id", c.bc_contract_id).eq("tenant_id", tenant_id);

          details.push({ bc_contract_id: c.bc_contract_id, portal_company_id: c.portal_company_id, status: "closed" });
          totalEncerrados++;
          await logAction(supabase, tenant_id, competencia_corte, c.portal_company_id, "execute_close", true, Date.now() - t0, { url: closeUrl }, { status: closeRes.status });
        } else {
          details.push({ bc_contract_id: c.bc_contract_id, portal_company_id: c.portal_company_id, status: "error_close", message: `HTTP ${closeRes.status}: ${closeText.substring(0, 200)}` });
          totalFalhas++;
          await logAction(supabase, tenant_id, competencia_corte, c.portal_company_id, "execute_close", false, Date.now() - t0, { url: closeUrl }, { status: closeRes.status, body: closeText.substring(0, 500) });
        }
      } catch (err) {
        details.push({ bc_contract_id: c.bc_contract_id, portal_company_id: c.portal_company_id, status: "error_close", message: String(err).substring(0, 300) });
        totalFalhas++;
        await logAction(supabase, tenant_id, competencia_corte, c.portal_company_id, "execute_close", false, Date.now() - t0, null, { error: String(err).substring(0, 500) });
      }
      await sleep(DELAY_MS);
    }

    const hasMore = contracts.length === BATCH_SIZE;

    return new Response(JSON.stringify({
      summary: {
        total_analisados: details.length, total_encerrados: totalEncerrados,
        total_bloqueados: totalBloqueados, total_falhas: totalFalhas,
        offset, finished: !hasMore, ...(hasMore ? { next_offset: offset + BATCH_SIZE } : {}),
      },
      details,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("close-bomcontrole-contracts error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
