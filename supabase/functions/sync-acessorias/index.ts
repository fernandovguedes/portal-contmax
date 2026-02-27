import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const THROTTLE_MS = 750;
const BATCH_SIZE = 12; // ~60s per batch (12 pages × ~5s each), well within the ~150s wall clock limit

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeKey(raw: string): string {
  return raw.replace(/[.\-\/]/g, "").trim();
}

function formatCnpj(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return raw;
}

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

/**
 * Process a batch of pages. Returns the counters and whether there are more pages.
 */
async function processBatch(
  supabase: ReturnType<typeof createClient>,
  syncJobId: string,
  tenantId: string,
  apiToken: string,
  baseUrl: string,
  startPage: number,
  prevCounters: SyncCounters,
  integrationJobId: string | null,
): Promise<{ counters: SyncCounters; nextPage: number | null; totalPages: number }> {
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
    await sleep(THROTTLE_MS);

    const apiUrl = `${baseUrl}/companies/ListAll?page=${page}`;
    console.log(`[sync-acessorias] Fetching ${apiUrl}`);
    const res = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      await logEntry("error", `API error page ${page}: ${res.status}`, { body: errText });
      c.totalErrors++;
      return { counters: c, nextPage: null, totalPages };
    }

    const data = await res.json();

    const companies = Array.isArray(data)
      ? data
      : Array.isArray(data?.data) ? data.data
      : Array.isArray(data?.items) ? data.items
      : [];

    if (companies.length === 0) {
      console.log(`[sync-acessorias] Page ${page}: empty response. Keys in data: ${Object.keys(data || {}).join(", ")}`);
      return { counters: c, nextPage: null, totalPages };
    }

    if (page === startPage || totalPages === 0) {
      totalPages = data?.totalPages || data?.total_pages || 0;
      console.log(`[sync-acessorias] Page ${page}: ${companies.length} companies, totalPages=${totalPages}, response keys: ${Object.keys(data || {}).join(", ")}`);
    }

    // Log first 3 companies of each batch for diagnostics
    const samplesToLog = Math.min(3, companies.length);
    for (let i = 0; i < samplesToLog; i++) {
      const company = companies[i];
      const rawKey = company.cnpj || company.cpf || company.identificador || company.document || "";
      const digits = rawKey.replace(/\D/g, "");
      const formattedKey = formatCnpj(rawKey);
      console.log(`[sync-acessorias] DIAG company[${i}]: rawKey="${rawKey}" digits="${digits}" formattedKey="${formattedKey}" nome="${company.razaoSocial || company.nome || "?"}" keys=${Object.keys(company).join(",")}`);
    }

    for (const company of companies) {
      c.totalRead++;
      try {
        const rawKey = company.cnpj || company.cpf || company.identificador || company.document || "";
        if (!rawKey) {
          await logEntry("warning", "Empresa sem CNPJ/CPF, ignorada", { company });
          c.totalSkipped++;
          continue;
        }

        const formattedKey = formatCnpj(rawKey);
        const digitsOnly = rawKey.replace(/\D/g, "");
        const nome = company.razaoSocial || company.razao_social || company.nome || company.name || "Sem nome";
        const sortedJson = JSON.stringify(company, Object.keys(company).sort());
        const hash = await sha256(sortedJson);

        // Try matching by formatted CNPJ first, then by digits-only external_key
        let existing: { id: string; hash_payload: string | null } | null = null;

        const { data: byFormattedCnpj } = await supabase
          .from("empresas")
          .select("id, hash_payload")
          .eq("organizacao_id", tenantId)
          .eq("cnpj", formattedKey)
          .maybeSingle();

        existing = byFormattedCnpj;

        // If not found by formatted CNPJ, try by external_key (digits only)
        if (!existing && digitsOnly) {
          const { data: byExternalKey } = await supabase
            .from("empresas")
            .select("id, hash_payload")
            .eq("organizacao_id", tenantId)
            .eq("external_key", digitsOnly)
            .maybeSingle();
          existing = byExternalKey;
        }

        // If still not found, try matching by digits in cnpj column (strip formatting from DB value)
        if (!existing && digitsOnly) {
          const { data: allCandidates } = await supabase
            .from("empresas")
            .select("id, hash_payload, cnpj")
            .eq("organizacao_id", tenantId);

          if (allCandidates) {
            const match = allCandidates.find(e => e.cnpj.replace(/\D/g, "") === digitsOnly);
            if (match) {
              existing = { id: match.id, hash_payload: match.hash_payload };
            }
          }
        }

        // Log first few match results for diagnostics
        if (c.totalRead <= 5) {
          console.log(`[sync-acessorias] MATCH company #${c.totalRead}: formattedKey="${formattedKey}" digitsOnly="${digitsOnly}" found=${!!existing} existingId=${existing?.id || "none"} hashMatch=${existing?.hash_payload === hash}`);
        }

        if (!existing) {
          const { error: insertErr } = await supabase.from("empresas").insert({
            organizacao_id: tenantId,
            cnpj: formattedKey,
            nome,
            regime_tributario: company.regimeTributario || "simples_nacional",
            emite_nota_fiscal: true,
            meses: {},
            obrigacoes: {},
            socios: [],
            external_source: "acessorias",
            external_key: digitsOnly,
            raw_payload: company,
            hash_payload: hash,
            synced_at: new Date().toISOString(),
          });
          if (insertErr) {
            if (c.totalErrors < 5) {
              console.log(`[sync-acessorias] INSERT ERROR: ${formattedKey} — ${insertErr.message}`);
            }
            await logEntry("error", `Insert failed: ${formattedKey}`, { error: insertErr.message });
            c.totalErrors++;
          } else {
            c.totalCreated++;
          }
        } else if (existing.hash_payload !== hash) {
          const { error: updateErr } = await supabase
            .from("empresas")
            .update({
              nome,
              external_source: "acessorias",
              external_key: digitsOnly,
              raw_payload: company,
              hash_payload: hash,
              synced_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          if (updateErr) {
            await logEntry("error", `Update failed: ${formattedKey}`, { error: updateErr.message });
            c.totalErrors++;
          } else {
            c.totalUpdated++;
          }
        } else {
          c.totalSkipped++;
        }
      } catch (companyErr) {
        c.totalErrors++;
        await logEntry("error", `Error processing company`, { error: String(companyErr), company });
      }
    }

    await logEntry("info", `Page ${page} processed: ${companies.length} companies — created=${c.totalCreated} updated=${c.totalUpdated} skipped=${c.totalSkipped} errors=${c.totalErrors}`);
    await updateSyncJobProgress(supabase, syncJobId, c);

    // Update integration_job progress (50-95% range)
    if (integrationJobId && totalPages > 0) {
      const pct = Math.min(95, 50 + Math.round((page / totalPages) * 45));
      await supabase.from("integration_jobs").update({ progress: pct }).eq("id", integrationJobId);
    }

    if (totalPages && page >= totalPages) {
      return { counters: c, nextPage: null, totalPages };
    }

    page++;
  }

  // More pages to process
  return { counters: c, nextPage: page, totalPages };
}

/**
 * Finalize the integration_job, update tenant_integrations, log to integration_logs,
 * and retrigger the worker to drain the queue.
 */
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
    status,
    progress: success ? 100 : 0,
    error_message: errorMsg,
    finished_at: new Date().toISOString(),
    execution_time_ms: executionTime,
    result: { ...counters },
  }).eq("id", integrationJobId);

  if (tenantIntegrationId) {
    await supabase.from("tenant_integrations").update({
      last_status: status,
      last_error: errorMsg,
    }).eq("id", tenantIntegrationId);
  }

  await supabase.from("integration_logs").insert({
    tenant_id: tenantId,
    integration: "acessorias",
    provider_slug: "acessorias",
    execution_id: crypto.randomUUID(),
    status,
    error_message: errorMsg,
    execution_time_ms: executionTime,
    total_processados: counters.totalRead,
    total_matched: counters.totalCreated + counters.totalUpdated,
    total_ignored: counters.totalSkipped,
    total_review: 0,
    response: { ...counters },
  });

  // Retrigger worker
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  fetch(`${supabaseUrl}/functions/v1/process-integration-job`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
    body: JSON.stringify({}),
  }).catch((err) => console.error("[sync-acessorias] Failed to retrigger worker:", err));

  console.log(`[sync-acessorias] Integration job ${integrationJobId} finalized — status=${status}, time=${executionTime}ms`);
}

/**
 * Self-invoke to continue processing the next batch.
 */
async function continueNextBatch(params: Record<string, any>) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const url = `${supabaseUrl}/functions/v1/sync-acessorias`;

  console.log(`[sync-acessorias] Continuing with next batch — start_page=${params.start_page}`);

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.error("[sync-acessorias] Failed to invoke next batch:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  console.log(`[sync-acessorias] ${req.method} ${url.pathname}${url.search}`);

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: `Method ${req.method} not allowed` }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const isInternalCall = token === supabaseServiceKey;

    let userId = "system";

    if (!isInternalCall) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", detail: `JWT validation failed: ${claimsError?.message || "invalid token"}` }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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

    const isContinuation = startPage > 1 && syncJobId;

    console.log(`[sync-acessorias] POST — tenant_slug=${tenantSlug}, start_page=${startPage}, continuation=${isContinuation}, integration_job_id=${integrationJobId}`);

    if (!tenantSlug || !["contmax", "pg"].includes(tenantSlug)) {
      return new Response(
        JSON.stringify({ error: "Invalid tenant_slug" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check only on first invocation
    if (!isInternalCall && !isContinuation) {
      const { data: isAdmin } = await supabase.rpc("is_tenant_admin", {
        _user_id: userId,
        _tenant_slug: tenantSlug,
      });
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: tenant } = await supabase.from("organizacoes").select("id").eq("slug", tenantSlug).single();
    if (!tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const tenantId = tenant.id;

    const secretName = tenantSlug === "contmax" ? "ACESSORIAS_TOKEN_CONTMAX" : "ACESSORIAS_TOKEN_PG";
    const apiToken = Deno.env.get(secretName);
    if (!apiToken) {
      return new Response(
        JSON.stringify({ error: "Configuration error", detail: `API token '${secretName}' not configured` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: integration } = await supabase
      .from("tenant_integrations")
      .select("base_url, is_enabled")
      .eq("tenant_id", tenantId)
      .eq("provider", "acessorias")
      .single();

    const baseUrl = integration?.base_url || "https://api.acessorias.com";
    if (integration && !integration.is_enabled) {
      return new Response(
        JSON.stringify({ error: "Integration disabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create sync_job only on first invocation
    let currentSyncJobId = syncJobId;
    if (!currentSyncJobId) {
      const { data: job } = await supabase.from("sync_jobs").insert({
        tenant_id: tenantId,
        provider: "acessorias",
        entity: "companies",
        status: "running",
        created_by_user_id: userId === "system" ? null : userId,
      }).select("id").single();
      currentSyncJobId = job!.id;
      console.log(`[sync-acessorias] Sync job ${currentSyncJobId} created.`);
    }

    // Process this batch
    const result = await processBatch(
      supabase, currentSyncJobId, tenantId, apiToken, baseUrl,
      startPage, prevCounters, integrationJobId,
    );

    if (result.nextPage !== null) {
      // More pages — self-invoke for next batch (fire-and-forget)
      console.log(`[sync-acessorias] Batch done (pages ${startPage}-${result.nextPage - 1}). Scheduling next batch starting at page ${result.nextPage}.`);

      // Fire-and-forget the next batch
      continueNextBatch({
        tenant_slug: tenantSlug,
        tenant_id: tenantId,
        integration_job_id: integrationJobId,
        tenant_integration_id: tenantIntegrationId,
        sync_job_id: currentSyncJobId,
        start_page: result.nextPage,
        counters: result.counters,
        batch_start_time: batchStartTime,
      });

      return new Response(
        JSON.stringify({
          status: "batch_complete",
          next_page: result.nextPage,
          counters: result.counters,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // All pages done — finalize
    console.log(`[sync-acessorias] All pages processed. Finalizing.`);
    console.log(`[sync-acessorias] Sync complete: read=${result.counters.totalRead} created=${result.counters.totalCreated} updated=${result.counters.totalUpdated} skipped=${result.counters.totalSkipped} errors=${result.counters.totalErrors}`);

    // Finalize sync_job
    await supabase.from("sync_jobs").update({
      status: "success",
      total_read: result.counters.totalRead,
      total_created: result.counters.totalCreated,
      total_updated: result.counters.totalUpdated,
      total_skipped: result.counters.totalSkipped,
      total_errors: result.counters.totalErrors,
      finished_at: new Date().toISOString(),
    }).eq("id", currentSyncJobId);

    // Finalize integration_job if present
    if (integrationJobId) {
      await finalizeIntegrationJob(
        supabase, integrationJobId, tenantIntegrationId, tenantId,
        batchStartTime, true, null, result.counters,
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_id: currentSyncJobId,
        status: "success",
        total_read: result.counters.totalRead,
        total_created: result.counters.totalCreated,
        total_updated: result.counters.totalUpdated,
        total_skipped: result.counters.totalSkipped,
        total_errors: result.counters.totalErrors,
        message: "Sincronização concluída.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[sync-acessorias] Unhandled error:", String(err));
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
