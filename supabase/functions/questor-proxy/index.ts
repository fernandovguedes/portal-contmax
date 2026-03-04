import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SYN_TOKEN = (Deno.env.get("QUESTOR_SYN_TOKEN") ?? "").trim();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Usa pg_net para fazer a chamada HTTP via Postgres
    const { data, error } = await supabase.rpc("questor_inserir", {
      p_payload: JSON.stringify(body),
      p_token: SYN_TOKEN,
    });

    if (error) throw new Error(error.message);

    console.log("pg_net result:", JSON.stringify(data));

    // Busca o resultado da requisição pg_net
    const { data: result, error: resultError } = await supabase
      .from("net._http_response")
      .select("status_code, content")
      .eq("id", data)
      .single();

    if (resultError) {
      // Retorna sucesso otimista se não conseguir ler o resultado imediatamente
      return new Response(JSON.stringify({ success: true, requestId: data }), {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    return new Response(result.content, {
      status: result.status_code,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Erro:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
