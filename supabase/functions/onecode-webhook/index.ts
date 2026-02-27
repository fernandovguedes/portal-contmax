import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-onecode-secret, x-onecode-source, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOURCE_CONFIG: Record<string, { secretEnv: string; organizacaoId: string }> = {
  contmax: {
    secretEnv: "ONECODE_WEBHOOK_SECRET",
    organizacaoId: "d84e2150-0ae0-4462-880c-da8cec89e96a",
  },
  pg: {
    secretEnv: "ONECODE_WEBHOOK_SECRET_PG",
    organizacaoId: "30e6da4c-ed58-47ce-8a83-289b58ca15ab",
  },
};

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  console.log("Webhook recebido, method:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResp({ error: "Method not allowed" }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Source & secret validation
    const source = (req.headers.get("x-onecode-source") || "contmax").toLowerCase();
    const secret = req.headers.get("x-onecode-secret");
    console.log("Source:", source, "Secret presente:", !!secret);

    const config = SOURCE_CONFIG[source];
    if (!config) {
      console.error("Unknown source:", source);
      return jsonResp({ error: `Unknown source: ${source}` }, 400);
    }

    const expectedSecret = Deno.env.get(config.secretEnv);
    if (!expectedSecret || secret !== expectedSecret) {
      console.error("Secret inválido");
      return jsonResp({ error: "unauthorized" }, 401);
    }
    console.log("Secret validado com sucesso");

    // Parse body — OneCode wraps in { data: { object, action, payload } }
    const body = await req.json();
    const event = body?.data ?? body;
    const onecodeObject = event?.object ?? null;
    const onecodeAction = event?.action ?? null;
    const payload = event?.payload ?? event;

    console.log("Event:", body?.data ? "data" : "root", "Object:", onecodeObject, "Action:", onecodeAction);
    console.log("Payload keys:", Object.keys(payload ?? {}));

    // Extract IDs from payload
    const messageId = String(payload?.id ?? "");
    const ticketIdRaw = payload?.ticketId ?? null;
    const ticketIdNum = ticketIdRaw ? Number(ticketIdRaw) : null;

    console.log("MessageId:", messageId, "TicketId:", ticketIdNum);

    // 1) Always persist raw event
    console.log("Persistindo em onecode_webhook_events");
    const eventRow = {
      source,
      onecode_object: onecodeObject,
      onecode_action: onecodeAction,
      message_id: messageId || null,
      ticket_id: ticketIdNum,
      payload_json: body,
      processed: false,
      error_message: null as string | null,
    };

    // If not messages.create, mark as processed immediately
    if (onecodeObject !== "messages" || onecodeAction !== "create") {
      console.log("Evento ignorado (não é messages.create), marcando processed=true");
      eventRow.processed = true;
    }

    // If messages.create but missing required IDs, log error but still return 200
    if (onecodeObject === "messages" && onecodeAction === "create" && (!messageId || !ticketIdRaw)) {
      console.error("messages.create sem id ou ticketId");
      eventRow.error_message = "Missing id or ticketId in payload";
    }

    const { data: insertedEvent, error: eventError } = await supabase
      .from("onecode_webhook_events")
      .insert(eventRow)
      .select("id")
      .single();

    if (eventError) {
      console.error("Erro ao inserir evento:", JSON.stringify(eventError));
      return jsonResp({ ok: true, warning: "event_log_failed", detail: eventError.message });
    }

    const eventId = insertedEvent.id;
    console.log("Evento salvo, id:", eventId);

    // 2) Process messages.create — persist to onecode_messages_raw
    if (onecodeObject === "messages" && onecodeAction === "create" && messageId && ticketIdRaw) {
      const processPromise = (async () => {
        try {
          console.log("Persistindo em onecode_messages_raw");
          const ticket = payload?.ticket ?? {};
          const row = {
            onecode_message_id: messageId,
            ticket_id: String(ticketIdRaw),
            contact_id: payload?.contactId ? String(payload.contactId) : null,
            from_me: Boolean(payload?.fromMe ?? payload?.from_me ?? false),
            body: payload?.body ?? payload?.text ?? null,
            created_at_onecode: payload?.createdAt ?? payload?.created_at ?? null,
            whatsapp_id: payload?.whatsappId ?? payload?.wid ?? null,
            user_id: ticket?.userId ? String(ticket.userId) : null,
            user_name: ticket?.user?.name ?? ticket?.userName ?? null,
            payload_json: body,
            organizacao_id: config.organizacaoId,
            is_group: Boolean(ticket?.isGroup ?? false),
          };

          const { error: upsertError } = await supabase
            .from("onecode_messages_raw")
            .upsert(row, { onConflict: "onecode_message_id", ignoreDuplicates: true });

          if (upsertError) {
            console.error("Upsert error:", JSON.stringify(upsertError));
            throw upsertError;
          }

          console.log("Mensagem salva, marcando processed=true");
          await supabase
            .from("onecode_webhook_events")
            .update({ processed: true, error_message: null })
            .eq("id", eventId);
        } catch (procError: any) {
          console.error("Processing error:", procError.message ?? String(procError));
          await supabase
            .from("onecode_webhook_events")
            .update({ processed: false, error_message: procError.message ?? String(procError) })
            .eq("id", eventId);
        }
      })();

      if (typeof (globalThis as any).EdgeRuntime?.waitUntil === "function") {
        (globalThis as any).EdgeRuntime.waitUntil(processPromise);
      } else {
        processPromise.catch((e) => console.error("Background error:", e));
      }
    }

    // 3) Process tickets.update — trigger scoring when ticket is closed
    if (onecodeObject === "tickets" && onecodeAction === "update") {
      const closedTicketId = String(payload?.id ?? payload?.ticketId ?? "");
      const ticketStatus = String(payload?.status ?? "").toLowerCase();
      console.log("Ticket update detected. TicketId:", closedTicketId, "Status:", ticketStatus);

      if (["closed", "resolved"].includes(ticketStatus) && closedTicketId) {
        // Check if already scored (idempotency)
        const { data: existingScore } = await supabase
          .from("onecode_ticket_scores")
          .select("id")
          .eq("ticket_id", closedTicketId)
          .maybeSingle();

        if (existingScore) {
          console.log("Score already exists for ticket", closedTicketId, "— skipping");
          await supabase
            .from("onecode_webhook_events")
            .update({ processed: true, error_message: null })
            .eq("id", eventId);
        } else {
          console.log("Score triggered for ticket", closedTicketId);

          const scorePromise = (async () => {
            try {
              const scoreUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/onecode-score-ticket`;
              const res = await fetch(scoreUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({ ticket_id: closedTicketId }),
              });

              const resBody = await res.text();
              console.log("Score response:", res.status, resBody);

              await supabase
                .from("onecode_webhook_events")
                .update({ processed: true, error_message: res.ok ? null : `Score failed: ${res.status}` })
                .eq("id", eventId);
            } catch (scoreErr: any) {
              console.error("Score error:", scoreErr.message ?? String(scoreErr));
              await supabase
                .from("onecode_webhook_events")
                .update({ processed: false, error_message: scoreErr.message ?? String(scoreErr) })
                .eq("id", eventId);
            }
          })();

          if (typeof (globalThis as any).EdgeRuntime?.waitUntil === "function") {
            (globalThis as any).EdgeRuntime.waitUntil(scorePromise);
          } else {
            scorePromise.catch((e) => console.error("Background score error:", e));
          }
        }
      } else {
        console.log("Ticket not closed, ignoring. Status:", ticketStatus);
        await supabase
          .from("onecode_webhook_events")
          .update({ processed: true, error_message: null })
          .eq("id", eventId);
      }
    }

    console.log("Retornando 200 OK");
    return jsonResp({ ok: true, source, event_id: eventId });
  } catch (err: any) {
    console.error("Erro geral webhook:", err.message ?? String(err));
    console.error("Stack:", err.stack ?? "no stack");
    return jsonResp({ error: err.message ?? "Unknown error" }, 500);
  }
});
