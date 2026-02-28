import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tenant config: maps organizacao_id to OneCode credentials env vars
const CONTMAX_ORG_ID = "d84e2150-0ae0-4462-880c-da8cec89e96a";
const PG_ORG_ID = "30e6da4c-ed58-47ce-8a83-289b58ca15ab";

function getOneCodeConfig(organizacaoId: string): { url: string; token: string } | null {
  if (organizacaoId === CONTMAX_ORG_ID) {
    const url = Deno.env.get("ONECODE_API_URL_CONTMAX");
    const token = Deno.env.get("ONECODE_API_TOKEN_CONTMAX");
    if (url && token) return { url, token };
  }
  // P&G or default
  const url = Deno.env.get("ONECODE_API_URL");
  const token = Deno.env.get("ONECODE_API_TOKEN");
  if (url && token) return { url, token };
  return null;
}

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
    const { to, body, empresa_id, ticketStrategy, competencia, message_type, is_resend, resend_reason } = await req.json();

    if (!to || !body || !empresa_id) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, body, empresa_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Detect tenant from empresa_id
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: empresa } = await serviceClient
      .from("empresas")
      .select("organizacao_id")
      .eq("id", empresa_id)
      .single();

    const organizacaoId = empresa?.organizacao_id || PG_ORG_ID;
    const oneCodeConfig = getOneCodeConfig(organizacaoId);

    if (!oneCodeConfig) {
      return new Response(JSON.stringify({ error: "OneCode API not configured for this tenant" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url: ONECODE_API_URL, token: ONECODE_API_TOKEN } = oneCodeConfig;
    const oneCodeUrl = `${ONECODE_API_URL}/api/send/${to}`;

    console.log("Sending WhatsApp via", organizacaoId === CONTMAX_ORG_ID ? "CONTMAX" : "PG", "to", to);

    let status = "success";
    let ticketId: string | null = null;
    let responseRaw: any = null;

    try {
      const oneCodeRes = await fetch(oneCodeUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ONECODE_API_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ body, ticketStrategy: ticketStrategy || "create" }),
      });

      responseRaw = await oneCodeRes.json();

      if (!oneCodeRes.ok) {
        status = "error";
      } else {
        ticketId = responseRaw?.ticketId || responseRaw?.ticket_id || responseRaw?.message?.ticketId || null;
      }
    } catch (fetchErr) {
      status = "error";
      responseRaw = { error: String(fetchErr) };
    }

    // Auto-close ticket if send succeeded and we have a ticketId
    let closeError: string | null = null;
    if (status === "success" && ticketId) {
      try {
        const closeUrl = `${ONECODE_API_URL}/api/tickets/${ticketId}/resolve`;
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
      empresa_id,
      to,
      body,
      user_id: userId,
      status,
      ticket_id: ticketId,
      response_raw: closeError ? { ...responseRaw, close_error: closeError } : responseRaw,
      competencia: competencia || null,
      message_type: message_type || "extrato_nao_enviado",
      is_resend: is_resend || false,
      resend_reason: resend_reason || null,
    });

    if (status === "error") {
      return new Response(
        JSON.stringify({ error: "Falha ao enviar mensagem", details: responseRaw }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, ticketId, response: responseRaw }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
