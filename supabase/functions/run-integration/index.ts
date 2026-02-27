import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, provider_slug } = await req.json();
    if (!tenant_id || !provider_slug) {
      return new Response(
        JSON.stringify({ error: "tenant_id and provider_slug are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Verify integration is enabled
    const { data: ti, error: tiError } = await admin
      .from("tenant_integrations")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("provider", provider_slug)
      .maybeSingle();

    if (tiError || !ti) {
      return new Response(
        JSON.stringify({ error: "Integration not found for this tenant" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ti.is_enabled) {
      return new Response(
        JSON.stringify({ error: "Integration is disabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing pending/running job
    const { data: existingJob } = await admin
      .from("integration_jobs")
      .select("id, status, created_at, started_at")
      .eq("tenant_id", tenant_id)
      .eq("provider_slug", provider_slug)
      .in("status", ["pending", "running"])
      .maybeSingle();

    if (existingJob) {
      // Auto-heal: if the job is stale (older than threshold), mark it as error
      const jobAge = Date.now() - new Date(existingJob.started_at ?? existingJob.created_at).getTime();
      if (jobAge > STALE_THRESHOLD_MS) {
        console.log(`Auto-healing stale job ${existingJob.id} (age: ${Math.round(jobAge / 1000)}s)`);
        await admin
          .from("integration_jobs")
          .update({
            status: "error",
            error_message: "Auto-heal: job ficou preso por mais de 15 minutos",
            finished_at: new Date().toISOString(),
            progress: 0,
          })
          .eq("id", existingJob.id);

        // Also reset tenant_integrations ghost status
        await admin
          .from("tenant_integrations")
          .update({ last_status: "error", last_error: "Auto-heal: job anterior ficou preso" })
          .eq("id", ti.id);
      } else {
        // Job is recent and legitimately active
        return new Response(
          JSON.stringify({
            error: "Já existe um job em andamento para esta integração",
            job_id: existingJob.id,
            status: existingJob.status,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create job
    const { data: newJob, error: jobError } = await admin
      .from("integration_jobs")
      .insert({
        tenant_id,
        provider_slug,
        status: "pending",
        created_by: userData.user.id,
        payload: {},
      })
      .select("id")
      .single();

    if (jobError) throw jobError;

    // Fire-and-forget: trigger worker
    const workerUrl = `${supabaseUrl}/functions/v1/process-integration-job`;
    fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({}),
    }).catch((err) => console.error("Failed to trigger worker:", err));

    return new Response(
      JSON.stringify({ job_id: newJob.id, status: "pending" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("run-integration error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
