import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FUNCTION_MAP: Record<string, string> = { acessorias: "sync-acessorias", bomcontrole: "sync-bomcontrole" };
const STALE_RUNNING_MS = 45 * 60 * 1000;
const STALE_PENDING_MS = 15 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const token = authHeader.replace("Bearer ", "");
  const isServiceRole = token === serviceRoleKey;

  if (!isServiceRole) {
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    await admin.from("integration_jobs").update({ status: "error", error_message: "Timeout: running > 45min", finished_at: new Date().toISOString(), progress: 0 }).eq("status", "running").lt("started_at", new Date(Date.now() - STALE_RUNNING_MS).toISOString());
    await admin.from("integration_jobs").update({ status: "error", error_message: "Timeout: running sem started_at", finished_at: new Date().toISOString(), progress: 0 }).eq("status", "running").is("started_at", null);
    await admin.from("integration_jobs").update({ status: "error", error_message: "Timeout: pending > 15min", finished_at: new Date().toISOString(), progress: 0 }).eq("status", "pending").lt("created_at", new Date(Date.now() - STALE_PENDING_MS).toISOString());

    const { data: job, error: jobError } = await admin.from("integration_jobs").select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (jobError) throw jobError;
    if (!job) return new Response(JSON.stringify({ message: "No pending jobs" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    console.log("[job:" + job.id + "] Starting provider=" + job.provider_slug);
    const startTime = Date.now();

    await admin.from("integration_jobs").update({ status: "running", started_at: new Date().toISOString(), attempts: (job.attempts ?? 0) + 1, progress: 5 }).eq("id", job.id);

    const { data: ti } = await admin.from("tenant_integrations").select("*").eq("tenant_id", job.tenant_id).eq("provider", job.provider_slug).maybeSingle();
    if (!ti || !ti.is_enabled) {
      const errMsg = !ti ? "Integration not found" : "Integration is disabled";
      await finalizeJob(admin, job, "error", errMsg, startTime, null);
      return new Response(JSON.stringify({ error: errMsg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("tenant_integrations").update({ last_status: "running", last_run: new Date().toISOString(), last_error: null }).eq("id", ti.id);
    await admin.from("integration_jobs").update({ progress: 20 }).eq("id", job.id);

    const functionName = FUNCTION_MAP[job.provider_slug];
    if (!functionName) {
      const errMsg = "No function mapped for provider: " + job.provider_slug;
      await finalizeJob(admin, job, "error", errMsg, startTime, null);
      await admin.from("tenant_integrations").update({ last_status: "error", last_error: errMsg }).eq("id", ti.id);
      return new Response(JSON.stringify({ error: errMsg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("integration_jobs").update({ progress: 50 }).eq("id", job.id);

    const fnBody: any = { tenant_id: job.tenant_id, integration_job_id: job.id, tenant_integration_id: ti.id };
    if (job.provider_slug === "acessorias") {
      const { data: org } = await admin.from("organizacoes").select("slug").eq("id", job.tenant_id).single();
      if (org) fnBody.tenant_slug = org.slug;
    }

    console.log("[process-integration-job] Job " + job.id + " prepared. Returning call info for " + functionName);

    return new Response(JSON.stringify({
      status: "prepared",
      job_id: job.id,
      function_name: functionName,
      function_body: fnBody,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("process-integration-job error:", String(err));
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function finalizeJob(admin: any, job: any, status: string, errorMessage: string | null, startTime: number, result: any) {
  await admin.from("integration_jobs").update({
    status, progress: status === "success" ? 100 : 0,
    error_message: errorMessage, finished_at: new Date().toISOString(),
    execution_time_ms: Date.now() - startTime, result,
  }).eq("id", job.id);
}
