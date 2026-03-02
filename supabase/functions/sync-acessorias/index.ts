import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sha256, sleep, normalizeKey, formatCnpj } from "../_shared/utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const THROTTLE_MS = 750;
const BATCH_SIZE = 12;
const MAX_PAGES = 50;

interface SyncCounters {
  totalRead: number;
  totalCreated: number;
  totalUpdated: number;
  totalSkipped: number;
  totalErrors: number;
}

async function updateSyncJobProgress(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  counters: SyncCounters,
) {
  await supabase.from("sync_jobs").update({
    total_read: counters.totalRead,
    total_created: counters.totalCreated,
    total_updated: counters.totalUpdated,
    total_skipped: counters.totalSkipped,
    total_errors: counters.totalErrors,
  }).eq("id", jobId);
}

async function preloadEmpresas(supabase: ReturnType<typeof createClient>, tenantId: string) {
  const { data: allEmpresas } = await supabase
    .from("empresas")
    .select("id, cnpj, hash_payload, data_baixa")
    .eq("organizacao_id", tenantId);

  const byCnpj = new Map<string, { id: string; hash_payload: string | null; data_baixa: string | null }>();
  const byDigits = new Map<string, { id: string; hash_payload: string | null; data_baixa: string | null }>();

  for (const e of (allEmpresas || [])) {
    if (e.cnpj) {
      byCnpj.set(e.cnpj, { id: e.id, hash_payload: e.hash_payload, data_baixa: e.data_baixa });
      const digits = e.cnpj.replace(/\D/g, "");
      if (digits) byDigits.set(digits, { id: e.id, hash_payload: e.hash_payload, data_baixa: e.data_baixa });
    }
  }

  return { byCnpj, byDigits };
}

async function processBatch(
  supabase: ReturnType<typeof createClient>,
  syncJobId: string,
  tenantId: string,
  apiToken: string,
  baseUrl: string,
  startPage: number,
  prevCounters: SyncCounters,
  integrationJobId: string | null,
  empresaLookup: { byCnpj: Map<string, any>; byDigits: Map<string, any> },
  seenFirstIds: Set<string>,
): Promise<{ counters: SyncCounters; nextPage: number | null; totalPages: number; seenFirstIds: Set<string> }> {
  const c = { ...prevCounters };
  let totalPages = 0;

  const logEntry = async (level: string, message: string, payload?: unknown) => {
    await supabase.from("sync_logs").insert({
      sync_job_id: syncJobId,
      level,
      message,
      payload: payload ? JSON.parse(JSON.stringify(payload)) : null,
    });
  };

  let page = startPage;
  const endPage = startPage + BATCH_SIZE;

  while (page < endPage) {
    if (page > MAX_PAGES) {
      console.log(`[sync-acessorias] Page ${page}: exceeded MAX_PAGES=${MAX_PAGES} — stopping`);
      await logEntry("warning", `Stopped at page ${page}: exceeded MAX_PAGES safety limit`);
      return { counters: c, nextPage: null, totalPages, seenFirstIds };
    }

    await sleep(THROTTLE_MS);

    const apiUrl = `${baseUrl}/companies/ListAll?Pagina=${page}`;
    console.log(`[sync-acessorias] Fetching ${apiUrl}`);
    const res = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      await logEntry("error", `API error page ${page}: ${res.status}`, { body: errText });
      c.totalErrors++;
      return { counters: c, nextPage: null, totalPages, seenFirstIds };
    }

    const data = await res.json();

    const companies = Array.isArray(data)
      ? data
      : Array.isArray(data?.data) ? data.data
      : Array.isArray(data?.items) ? data.items
      : [];

    if (companies.length === 0) {
      console.log(`[sync-acessorias] Page ${page}: empty — end of data`);
      return { counters: c, nextPage: null, totalPages, seenFirstIds };
    }

    const isLastPage = companies.length < 20;

    const firstCompany = companies[0];
    const firstId = String(firstCompany?.Identificador || firstCompany?.ID || firstCompany?.id || firstCompany?.cnpj || "");
    if (firstId && seenFirstIds.has(firstId)) {
      console.log(`[sync-acessorias] Page ${page}: LOOP DETECTED — firstId=${firstId} already seen. Stopping.`);
      await logEntry("warning", `Pagination loop detected at page ${page}: firstId=${firstId} repeated`);
      return { counters: c, nextPage: null, totalPages, seenFirstIds };
    }
    if (firstId) seenFirstIds.add(firstId);

    if (page === startPage || totalPages === 0) {
      totalPages = data?.totalPages || data?.total_pages || data?.TotalPages || 0;
      console.log(`[sync-acessorias] Page ${page}: ${companies.length} companies, totalPages=${totalPages || "unknown"}`);
    }

    if (page === startPage && companies.length > 0) {
      console.log(`[sync-acessorias] DIAG RAW company[0]: ${JSON.stringify(companies[0])}`);
    }

    for (const company of companies) {
      c.totalRead++;
      try {
        const rawKey = company.Identificador || company.cnpj || company.cpf || company.identificador || company.document || "";
        const companyStatus = company.Status || company.status || "";

        if (companyStatus && companyStatus !== "Ativa") {
          if (rawKey) {
            const formattedKeyInactive = formatCnpj(rawKey);
            const existing = empresaLookup.byCnpj.get(formattedKeyInactive);
            if (existing && !existing.data_baixa) {
              const { error: baixaErr } = await supabase
                .from("empresas")
                .update({ data_baixa: new Date().toISOString().slice(0, 10), synced_at: new Date().toISOString() })
                .eq("id", existing.id);
              if (!baixaErr) { existing.data_baixa = new Date().toISOString().slice(0, 10); c.totalUpdated++; }
              else { c.totalErrors++; }
            } else { c.totalSkipped++; }
          } else { c.totalSkipped++; }
          continue;
        }

        if (!rawKey) { c.totalSkipped++; continue; }

        const formattedKey = formatCnpj(rawKey);
        const digitsOnly = rawKey.replace(/\D/g, "");
        const nome = company.Razao || company.razaoSocial || company.razao_social || company.Fantasia || company.nome || company.name || "Sem nome";
        const sortedJson = JSON.stringify(company, Object.keys(company).sort());
        const hash = await sha256(sortedJson);

        const existing = empresaLookup.byCnpj.get(formattedKey) || empresaLookup.byDigits.get(digitsOnly) || null;

        if (!existing) {
          const { data: inserted, error: insertErr } = await supabase.from("empresas").insert({
            organizacao_id: tenantId, cnpj: formattedKey, nome,
            regime_tributario: company.regimeTributario || "simples_nacional",
            emite_nota_fiscal: true, meses: {}, obrigacoes: {}, socios: [],
            external_source: "acessorias", external_key: digitsOnly,
            raw_payload: company, hash_payload: hash, synced_at: new Date().toISOString(),
          }).select("id").maybeSingle();
          if (insertErr) {
            if (c.totalErrors < 5) console.log(`[sync-acessorias] INSERT ERROR: ${formattedKey} — ${insertErr.message}`);
            c.totalErrors++;
          } else {
            c.totalCreated++;
            if (inserted) {
              const entry = { id: inserted.id, hash_payload: hash, data_baixa: null };
              empresaLookup.byCnpj.set(formattedKey, entry);
              if (digitsOnly) empresaLookup.byDigits.set(digitsOnly, entry);
            }
          }
        } else if (existing.hash_payload !== hash) {
          const { error: updateErr } = await supabase.from("empresas").update({
            nome, external_source: "acessorias", external_key: digitsOnly,
            raw_payload: company, hash_payload: hash, synced_at: new Date().toISOString(),
          }).eq("id", existing.id);
          if (!updateErr) { existing.hash_payload = hash; c.totalUpdated++; }
          else { c.totalErrors++; }
        } else {
          c.totalSkipped++;
        }
      } catch (companyErr) { c.totalErrors++; }
    }

    await logEntry("info", `Page ${page} processed: ${companies.length} companies — created=${c.totalCreated} updated=${c.totalUpdated} skipped=${c.totalSkipped} errors=${c.totalErrors}`);
    await updateSyncJobProgress(supabase, syncJobId, c);

    if (integrationJobId && totalPages > 0) {
      const pct = Math.min(95, 50 + Math.round((page / totalPages) * 45));
      await supabase.from("integration_jobs").update({ progress: pct }).eq("id", integrationJobId);
    }

    if (isLastPage) {
      console.log(`[sync-acessorias] Page ${page}: ${companies.length} items (< 20) — last page`);
      return { counters: c, nextPage: null, totalPages, seenFirstIds };
    }
    if (totalPages && page >= totalPages) {
      console.log(`[sync-acessorias] Page ${page}: reached totalPages=${totalPages} — stopping`);
      return { counters: c, nextPage: null, totalPages, seenFirstIds };
    }

    page++;
  }

  return { counters: c, nextPage: page, totalPages, seenFirstIds };
}

async function finalizeIntegrationJob(
  supabase: ReturnType<typeof createClient>,
  integrationJobId: string,
  tenantIntegrationId: string | null,
  tenantId: string,
  startTime: number,
  success: boolean,
  errorMsg: string | null,
  counters: SyncCounters,
) {
  const status = success ? "success" : "error";
  const executionTime = Date.now() - startTime;

  await supabase.from("integration_jobs").update({
    status, progress: success ? 100 : 0, error_message: errorMsg,
    finished_at: new Date().toISOString(), execution_time_ms: executionTime, result: { ...counters },
  }).eq("id", integrationJobId);

  if (tenantIntegrationId) {
    await supabase.from("tenant_integrations").update({ last_status: status, last_error: errorMsg }).eq("id", tenantIntegrationId);
  }

  await supabase.from("integration_logs").insert({
    tenant_id: tenantId, integration: "acessorias", provider_slug: "acessorias",
    execution_id: crypto.randomUUID(), status, error_message: errorMsg,
    execution_time_ms: executionTime, total_processados: counters.totalRead,
    total_matched: counters.totalCreated + counters.totalUpdated,
    total_ignored: counters.totalSkipped, total_review: 0, response: { ...counters },
  });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    await fetch(`${supabaseUrl}/functions/v1/process-integration-job`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({}),
    });
  } catch (err) { console.error("[sync-acessorias] Failed to retrigger worker:", err); }
}

function continueNextBatch(params: Record<string, any>) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const url = `${supabaseUrl}/functions/v1/sync-acessorias`;

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
    body: JSON.stringify(params),
  }).then(res => {
    console.log(`[sync-acessorias] Next batch triggered — status=${res.status}`);
  }).catch(err => {
    console.error("[sync-acessorias] Failed to invoke next batch:", err);
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: `Method ${req.method} not allowed` }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const isInternalCall = token === supabaseServiceKey;
    let userId = "system";

    if (!isInternalCall) {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = claimsData.claims.sub as string;
    }

    const body = await req.json();
    const tenantSlug = body.tenant_slug;
    const integrationJobId = body.integration_job_id || null;
    const tenantIntegrationId = body.tenant_integration_id || null;
    const startPage: number = body.start_page || 1;
    const syncJobId: string | null = body.sync_job_id || null;
    const prevCounters: SyncCounters = body.counters || { totalRead: 0, totalCreated: 0, totalUpdated: 0, totalSkipped: 0, totalErrors: 0 };
    const batchStartTime: number = body.batch_start_time || Date.now();
    const seenFirstIds: Set<string> = new Set(body.seen_first_ids || []);
    const isContinuation = startPage > 1 && syncJobId;

    console.log(`[sync-acessorias] POST — tenant=${tenantSlug}, page=${startPage}, cont=${isContinuation}`);

    if (!tenantSlug || !["contmax", "pg"].includes(tenantSlug)) {
      return new Response(JSON.stringify({ error: "Invalid tenant_slug" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!isInternalCall && !isContinuation) {
      const { data: isAdmin } = await supabase.rpc("is_tenant_admin", { _user_id: userId, _tenant_slug: tenantSlug });
      if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: tenant } = await supabase.from("organizacoes").select("id").eq("slug", tenantSlug).single();
    if (!tenant) return new Response(JSON.stringify({ error: "Tenant not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const tenantId = tenant.id;

    const secretName = tenantSlug === "contmax" ? "ACESSORIAS_TOKEN_CONTMAX" : "ACESSORIAS_TOKEN_PG";
    const apiToken = Deno.env.get(secretName);
    if (!apiToken) return new Response(JSON.stringify({ error: `Token ${secretName} not configured` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: integration } = await supabase.from("tenant_integrations").select("base_url, is_enabled").eq("tenant_id", tenantId).eq("provider", "acessorias").single();
    const baseUrl = integration?.base_url || "https://api.acessorias.com";
    if (integration && !integration.is_enabled) return new Response(JSON.stringify({ error: "Integration disabled" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const empresaLookup = await preloadEmpresas(supabase, tenantId);
    console.log(`[sync-acessorias] Pre-loaded ${empresaLookup.byCnpj.size} empresas`);

    let currentSyncJobId = syncJobId;
    if (!currentSyncJobId) {
      const { data: job } = await supabase.from("sync_jobs").insert({
        tenant_id: tenantId, provider: "acessorias", entity: "companies", status: "running",
        created_by_user_id: userId === "system" ? null : userId,
      }).select("id").single();
      currentSyncJobId = job!.id;
    }

    const result = await processBatch(supabase, currentSyncJobId, tenantId, apiToken, baseUrl, startPage, prevCounters, integrationJobId, empresaLookup, seenFirstIds);

    if (result.nextPage !== null) {
      continueNextBatch({
        tenant_slug: tenantSlug, tenant_id: tenantId,
        integration_job_id: integrationJobId, tenant_integration_id: tenantIntegrationId,
        sync_job_id: currentSyncJobId, start_page: result.nextPage,
        counters: result.counters, batch_start_time: batchStartTime,
        seen_first_ids: Array.from(result.seenFirstIds),
      });
      return new Response(JSON.stringify({ status: "batch_complete", next_page: result.nextPage, counters: result.counters }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[sync-acessorias] All done: read=${result.counters.totalRead} created=${result.counters.totalCreated} updated=${result.counters.totalUpdated} skipped=${result.counters.totalSkipped}`);

    await supabase.from("sync_jobs").update({
      status: "success", total_read: result.counters.totalRead, total_created: result.counters.totalCreated,
      total_updated: result.counters.totalUpdated, total_skipped: result.counters.totalSkipped,
      total_errors: result.counters.totalErrors, finished_at: new Date().toISOString(),
    }).eq("id", currentSyncJobId);

    if (integrationJobId) {
      await finalizeIntegrationJob(supabase, integrationJobId, tenantIntegrationId, tenantId, batchStartTime, true, null, result.counters);
    }

    return new Response(JSON.stringify({ success: true, job_id: currentSyncJobId, ...result.counters, message: "Sincronização concluída." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[sync-acessorias] Error:", String(err));
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
