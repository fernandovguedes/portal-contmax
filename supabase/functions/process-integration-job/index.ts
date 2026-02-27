import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FUNCTION_MAP: Record<string, string> = {
  acessorias: "sync-acessorias",
  bomcontrole: "sync-bomcontrole",
  onecode: "sync-onecode-contacts",
};

const STALE_RUNNING_MS = 45 * 60 * 1000; // 45 min (sync-acessorias can process 160+ pages across many batches)
const STALE_PENDING_MS = 15 * 60 * 1000; // 15 min

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Timeout stale running jobs (> 10 min) — including those with null started_at
    await admin
      .from("integration_jobs")
      .update({
        status: "error",
        error_message: "Timeout: job ficou running por mais de 10 minutos",
        finished_at: new Date().toISOString(),
        progress: 0,
      })
      .eq("status", "running")
      .lt("started_at", new Date(Date.now() - STALE_RUNNING_MS).toISOString());

    // Also handle inconsistent jobs: running but started_at is null (shouldn't happen, but safety net)
    await admin
      .from("integration_jobs")
      .update({
        status: "error",
        error_message: "Timeout: job em running sem started_at",
        finished_at: new Date().toISOString(),
        progress: 0,
      })
      .eq("status", "running")
      .is("started_at", null);

    // 1b. Timeout stale pending jobs (> 15 min)
    await admin
      .from("integration_jobs")
      .update({
        status: "error",
        error_message: "Timeout: job ficou pending por mais de 15 minutos",
        finished_at: new Date().toISOString(),
        progress: 0,
      })
      .eq("status", "pending")
      .lt("created_at", new Date(Date.now() - STALE_PENDING_MS).toISOString());

    // 2. Fetch next pending job
    const { data: job, error: jobError } = await admin
      .from("integration_jobs")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (jobError) throw jobError;

    if (!job) {
      return new Response(JSON.stringify({ message: "No pending jobs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[job:${job.id}] Starting — provider=${job.provider_slug}, tenant=${job.tenant_id}, attempt=${(job.attempts ?? 0) + 1}`);

    // 3. Mark as running
    const startTime = Date.now();
    await admin
      .from("integration_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        attempts: (job.attempts ?? 0) + 1,
        progress: 5,
      })
      .eq("id", job.id);

    // 4. Check integration is enabled
    const { data: ti } = await admin
      .from("tenant_integrations")
      .select("*")
      .eq("tenant_id", job.tenant_id)
      .eq("provider", job.provider_slug)
      .maybeSingle();

    if (!ti || !ti.is_enabled) {
      const errMsg = !ti ? "Integration not found" : "Integration is disabled";
      await finalizeJob(admin, job, "error", errMsg, startTime, null);
      await retriggerWorker(supabaseUrl, serviceRoleKey);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update tenant_integrations to running
    await admin
      .from("tenant_integrations")
      .update({ last_status: "running", last_run: new Date().toISOString(), last_error: null })
      .eq("id", ti.id);

    // 5. Update progress to 20%
    await admin
      .from("integration_jobs")
      .update({ progress: 20 })
      .eq("id", job.id);

    // 6. Delegate to specific function
    const functionName = FUNCTION_MAP[job.provider_slug];
    if (!functionName) {
      const errMsg = `No function mapped for provider: ${job.provider_slug}`;
      await finalizeJob(admin, job, "error", errMsg, startTime, null);
      await admin
        .from("tenant_integrations")
        .update({ last_status: "error", last_error: errMsg })
        .eq("id", ti.id);
      await retriggerWorker(supabaseUrl, serviceRoleKey);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Progress 50%
    await admin
      .from("integration_jobs")
      .update({ progress: 50 })
      .eq("id", job.id);

    const fnUrl = `${supabaseUrl}/functions/v1/${functionName}`;

    // Build request body
    const fnBody: any = {
      tenant_id: job.tenant_id,
      integration_job_id: job.id,
      tenant_integration_id: ti.id,
    };
    if (job.provider_slug === "acessorias") {
      const { data: org } = await admin
        .from("organizacoes")
        .select("slug")
        .eq("id", job.tenant_id)
        .single();
      if (org) fnBody.tenant_slug = org.slug;
    }

    console.log(`[job:${job.id}] Delegating to ${functionName} (fire-and-forget)`);

    // Fire-and-forget: the delegated function will finalize the job,
    // update tenant_integrations, log to integration_logs, and retrigger the worker.
    fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(fnBody),
    }).catch((err) => {
      console.error(`[job:${job.id}] Fire-and-forget fetch error:`, err);
    });

    return new Response(
      JSON.stringify({ status: "delegated", job_id: job.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("process-integration-job error:", err);
    // Still try to retrigger in case there are other jobs
    await retriggerWorker(supabaseUrl, serviceRoleKey).catch(() => {});
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function finalizeJob(
  admin: any,
  job: any,
  status: string,
  errorMessage: string | null,
  startTime: number,
  result: any
) {
  const executionTime = Date.now() - startTime;
  await admin
    .from("integration_jobs")
    .update({
      status,
      progress: status === "success" ? 100 : 0,
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
      execution_time_ms: executionTime,
      result,
    })
    .eq("id", job.id);
}

async function retriggerWorker(supabaseUrl: string, serviceRoleKey: string) {
  const workerUrl = `${supabaseUrl}/functions/v1/process-integration-job`;
  try {
    await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({}),
    });
  } catch (err) {
    console.error("Failed to retrigger worker:", err);
  }
}
