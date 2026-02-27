import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    const { items, ticketStrategy, closeAfterSend, competencia, message_type } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "items array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ONECODE_API_URL = Deno.env.get("ONECODE_API_URL");
    const ONECODE_API_TOKEN = Deno.env.get("ONECODE_API_TOKEN");

    if (!ONECODE_API_URL || !ONECODE_API_TOKEN) {
      return new Response(JSON.stringify({ error: "OneCode API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const batchId = crypto.randomUUID();
    const batchTotal = items.length;
    const results: any[] = [];

    // Process sequentially to avoid rate limiting
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const { empresaId, to, body, is_resend, resend_reason } = item;

      let status = "success";
      let ticketId: string | null = null;
      let responseRaw: any = null;
      let closeError: string | null = null;

      try {
        const sendUrl = `${ONECODE_API_URL}/api/send/${to}`;
        const sendRes = await fetch(sendUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ONECODE_API_TOKEN}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ body, ticketStrategy: ticketStrategy || "create" }),
        });

        responseRaw = await sendRes.json();

        if (!sendRes.ok) {
          status = "error";
        } else {
          ticketId = responseRaw?.ticketId || responseRaw?.ticket_id || responseRaw?.message?.ticketId || null;
        }
      } catch (fetchErr) {
        status = "error";
        responseRaw = { error: String(fetchErr) };
      }

      // Auto-close ticket
      if (status === "success" && ticketId && closeAfterSend) {
        try {
          const closeUrl = `${ONECODE_API_URL}/api/tickets/${ticketId}/send-and-close`;
          const closeRes = await fetch(closeUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ONECODE_API_TOKEN}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          });
          if (!closeRes.ok) {
            const closeBody = await closeRes.text();
            closeError = `Failed to close ticket ${ticketId}: ${closeRes.status} ${closeBody}`;
          }
        } catch (err) {
          closeError = `Error closing ticket ${ticketId}: ${String(err)}`;
        }
      }

      // Log to whatsapp_logs
      await serviceClient.from("whatsapp_logs").insert({
        empresa_id: empresaId,
        to,
        body,
        user_id: userId,
        status,
        ticket_id: ticketId,
        response_raw: closeError ? { ...responseRaw, close_error: closeError } : responseRaw,
        batch_id: batchId,
        batch_index: i,
        batch_total: batchTotal,
        competencia: competencia || null,
        message_type: message_type || "extrato_nao_enviado",
        is_resend: is_resend || false,
        resend_reason: resend_reason || null,
      });

      results.push({
        empresaId,
        to,
        success: status === "success",
        error: status === "error" ? (responseRaw?.error || "Send failed") : null,
        ticketId,
        response_raw: responseRaw,
      });
    }

    return new Response(
      JSON.stringify({ batchId, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
