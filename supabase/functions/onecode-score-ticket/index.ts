import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResp({ error: "Method not allowed" }, 405);
  }

  const t0 = Date.now();

  try {
    // Auth: accept user JWT or service_role key
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { error: claimsError } = await anonClient.auth.getClaims(token);
      if (claimsError) {
        return jsonResp({ error: "Unauthorized" }, 401);
      }
    }

    const { ticket_id } = await req.json();
    if (!ticket_id) {
      return jsonResp({ error: "ticket_id is required" }, 400);
    }

    console.log("Scoring ticket:", ticket_id);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

    // Fetch messages
    const { data: messages, error: msgError } = await supabase
      .from("onecode_messages_raw")
      .select("from_me, body, created_at_onecode, user_id, user_name, organizacao_id, is_group")
      .eq("ticket_id", String(ticket_id))
      .order("created_at_onecode", { ascending: true });

    if (msgError) throw new Error(msgError.message);

    const organizacaoId = messages?.[0]?.organizacao_id;

    // Skip group tickets — save null score without calling AI
    const isGroup = messages?.some((m: any) => m.is_group);
    if (isGroup) {
      console.log("Group ticket detected, skipping scoring:", ticket_id);
      const groupRow = {
        ticket_id: String(ticket_id),
        user_id: messages?.find((m: any) => m.from_me)?.user_id || null,
        user_name: messages?.find((m: any) => m.from_me)?.user_name || null,
        score_final: null,
        feedback: "Ticket de grupo — ignorado na avaliação de qualidade.",
        model_used: "skipped",
        organizacao_id: organizacaoId || "00000000-0000-0000-0000-000000000000",
      };
      const { data: saved, error: saveErr } = await supabase
        .from("onecode_ticket_scores")
        .upsert(groupRow, { onConflict: "ticket_id" })
        .select()
        .single();
      if (saveErr) throw new Error(saveErr.message);
      return jsonResp({
        ok: true,
        score: saved,
        skipped: true,
        reason: "group_ticket",
        elapsed_ms: Date.now() - t0,
      });
    }

    // No human attendant — skip scoring for bot-only tickets
    const humanMessages = messages?.filter((m: any) => m.from_me && m.user_id);
    if (!humanMessages || humanMessages.length === 0) {
      console.log("Bot-only ticket detected, skipping scoring:", ticket_id);
      const botRow = {
        ticket_id: String(ticket_id),
        user_id: null,
        user_name: null,
        score_final: null,
        feedback: "Ticket sem interação de atendente humano — ignorado.",
        model_used: "skipped",
        organizacao_id: organizacaoId || "00000000-0000-0000-0000-000000000000",
      };
      const { data: saved, error: saveErr } = await supabase
        .from("onecode_ticket_scores")
        .upsert(botRow, { onConflict: "ticket_id" })
        .select()
        .single();
      if (saveErr) throw new Error(saveErr.message);
      return jsonResp({
        ok: true,
        score: saved,
        skipped: true,
        reason: "bot_only",
        elapsed_ms: Date.now() - t0,
      });
    }

    // Not enough messages — save null score with reason
    if (!messages || messages.length < 2) {
      console.log("Insufficient messages:", messages?.length ?? 0);
      const nullRow = {
        ticket_id: String(ticket_id),
        user_id: messages?.[0]?.from_me ? messages[0].user_id : null,
        user_name: messages?.find((m) => m.from_me)?.user_name || null,
        score_final: null,
        feedback: `Mensagens insuficientes para avaliação (${messages?.length ?? 0} mensagens encontradas).`,
        model_used: "skipped",
        organizacao_id: organizacaoId || "00000000-0000-0000-0000-000000000000",
      };
      const { data: saved, error: saveErr } = await supabase
        .from("onecode_ticket_scores")
        .upsert(nullRow, { onConflict: "ticket_id" })
        .select()
        .single();
      if (saveErr) throw new Error(saveErr.message);
      return jsonResp({
        ok: true,
        score: saved,
        skipped: true,
        reason: "insufficient_messages",
        elapsed_ms: Date.now() - t0,
      });
    }

    // Build transcript
    const humanMsg = messages.find((m) => m.from_me && m.user_id);
    const attendantName = humanMsg?.user_name || "Atendente";
    const attendantUserId = humanMsg?.user_id || null;
    const transcript = messages
      .map((m) => {
        const role = m.from_me ? `ATENDENTE (${attendantName})` : "CLIENTE";
        return `${role}: ${m.body || "(mensagem sem texto)"}`;
      })
      .join("\n");

    console.log("Transcript built. Messages:", messages.length, "Chars:", transcript.length);

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Você é um auditor interno de qualidade de atendimento da Contmax Contabilidade.

A Contmax é um escritório contábil profissional, técnico e orientado à clareza tributária e responsabilidade legal.

Avalie o atendimento abaixo considerando o padrão Contmax:

Princípios obrigatórios:
- Comunicação clara e objetiva
- Linguagem profissional (sem excesso de informalidade, gírias ou emojis excessivos)
- Segurança técnica (não prometer o que não pode cumprir)
- Organização da resposta (respostas completas e estruturadas)
- Foco na resolução real da demanda
- Postura respeitosa e cordial
- Não transferir insegurança ao cliente
- Não deixar perguntas sem resposta
- Se o cliente envia a mensagem via aúdio, e o atendente responde em áudio, não penalize o atendente 

Critérios de avaliação (0 a 10):

1. Clareza – Explicação compreensível e didática.
2. Cordialidade – Educação e respeito profissional.
3. Objetividade – Respostas diretas, sem enrolação.
4. Resolução – Realmente resolveu ou encaminhou corretamente?
5. Profissionalismo – Linguagem técnica adequada, responsabilidade e postura contábil correta.

Regras importantes:
- Não penalize o atendente por erro do cliente.
- Penalize respostas vagas, inseguras ou que transfiram responsabilidade indevidamente.
- Penalize promessas sem base técnica.
- Se o atendimento for exemplar, permita notas altas.
- Seja justo e consistente.

Calcule score_final como média ponderada:
Resolução 30%
Clareza 25%
Objetividade 20%
Profissionalismo 15%
Cordialidade 10%

Retorne APENAS JSON válido no formato especificado.
Não inclua comentários fora do JSON.

Ignore quando for atendimento do Atendente, não de notas, não classifique`;

    const aiT0 = Date.now();
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Avalie esta conversa de atendimento:\n\n${transcript}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_evaluation",
              description: "Submit the structured evaluation scores and feedback.",
              parameters: {
                type: "object",
                properties: {
                  clareza: { type: "number", description: "Score 0-10" },
                  cordialidade: { type: "number", description: "Score 0-10" },
                  objetividade: { type: "number", description: "Score 0-10" },
                  resolucao: { type: "number", description: "Score 0-10" },
                  profissionalismo: { type: "number", description: "Score 0-10" },
                  score_final: { type: "number", description: "Weighted score 0-100" },
                  feedback: { type: "string", description: "Short constructive feedback in Portuguese" },
                  pontos_fortes: { type: "array", items: { type: "string" }, description: "1-3 strengths" },
                  pontos_melhoria: { type: "array", items: { type: "string" }, description: "1-3 improvements" },
                },
                required: [
                  "clareza",
                  "cordialidade",
                  "objetividade",
                  "resolucao",
                  "profissionalismo",
                  "score_final",
                  "feedback",
                  "pontos_fortes",
                  "pontos_melhoria",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_evaluation" } },
      }),
    });

    const aiElapsed = Date.now() - aiT0;

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) return jsonResp({ error: "Rate limit exceeded. Try again later." }, 429);
      if (aiResponse.status === 402) return jsonResp({ error: "Insufficient credits." }, 402);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const usage = aiData.usage;
    console.log("AI response received. Elapsed:", aiElapsed, "ms. Tokens:", JSON.stringify(usage ?? "N/A"));

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured evaluation");
    }

    const evaluation =
      typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;

    // Validate ranges
    const clamp = (v: unknown, min: number, max: number): number => {
      const n = Number(v);
      if (isNaN(n)) return 0;
      return Math.round(Math.min(Math.max(n, min), max) * 10) / 10;
    };

    const clareza = clamp(evaluation.clareza, 0, 10);
    const cordialidade = clamp(evaluation.cordialidade, 0, 10);
    const objetividade = clamp(evaluation.objetividade, 0, 10);
    const resolucao = clamp(evaluation.resolucao, 0, 10);
    const conformidade = clamp(evaluation.profissionalismo, 0, 10); // maps to DB column "conformidade"

    // Recalculate to ensure consistency
    const scoreFinal =
      Math.round(
        (clareza * 0.25 + cordialidade * 0.15 + objetividade * 0.2 + resolucao * 0.3 + conformidade * 0.1) * 100,
      ) / 10;

    const scoreRow = {
      ticket_id: String(ticket_id),
      user_id: attendantUserId,
      user_name: attendantName,
      clareza,
      cordialidade,
      objetividade,
      resolucao,
      conformidade,
      score_final: scoreFinal,
      feedback: String(evaluation.feedback || "").slice(0, 2000),
      pontos_fortes: Array.isArray(evaluation.pontos_fortes) ? evaluation.pontos_fortes.map(String).slice(0, 5) : [],
      pontos_melhoria: Array.isArray(evaluation.pontos_melhoria)
        ? evaluation.pontos_melhoria.map(String).slice(0, 5)
        : [],
      model_used: "google/gemini-3-flash-preview",
      organizacao_id: organizacaoId,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("onecode_ticket_scores")
      .upsert(scoreRow, { onConflict: "ticket_id" })
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    const totalElapsed = Date.now() - t0;
    console.log(
      "Score saved. Total elapsed:",
      totalElapsed,
      "ms. AI elapsed:",
      aiElapsed,
      "ms. Tokens:",
      JSON.stringify(usage ?? "N/A"),
    );

    return jsonResp({
      ok: true,
      score: inserted,
      timing: { total_ms: totalElapsed, ai_ms: aiElapsed },
      tokens: usage ?? null,
    });
  } catch (e) {
    const totalElapsed = Date.now() - t0;
    console.error("Score error:", e, "Elapsed:", totalElapsed, "ms");
    return jsonResp({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
