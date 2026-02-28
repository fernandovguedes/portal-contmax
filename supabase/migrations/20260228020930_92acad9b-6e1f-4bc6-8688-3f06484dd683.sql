
-- 1. Create unique index on onecode_message_id
CREATE UNIQUE INDEX IF NOT EXISTS onecode_messages_raw_onecode_message_id_key 
ON public.onecode_messages_raw (onecode_message_id);

-- 2. Reprocess pending messages.create events into onecode_messages_raw
INSERT INTO public.onecode_messages_raw (
  onecode_message_id,
  ticket_id,
  contact_id,
  from_me,
  body,
  created_at_onecode,
  whatsapp_id,
  user_id,
  user_name,
  payload_json,
  organizacao_id,
  is_group
)
SELECT
  e.message_id,
  COALESCE((e.payload_json->'data'->'payload'->>'ticketId')::text, (e.payload_json->'payload'->>'ticketId')::text, (e.payload_json->>'ticketId')::text),
  COALESCE((e.payload_json->'data'->'payload'->>'contactId')::text, (e.payload_json->'payload'->>'contactId')::text, (e.payload_json->>'contactId')::text),
  COALESCE(
    (e.payload_json->'data'->'payload'->>'fromMe')::boolean,
    (e.payload_json->'payload'->>'fromMe')::boolean,
    (e.payload_json->>'fromMe')::boolean,
    (e.payload_json->'data'->'payload'->>'from_me')::boolean,
    false
  ),
  COALESCE(
    e.payload_json->'data'->'payload'->>'body',
    e.payload_json->'payload'->>'body',
    e.payload_json->>'body',
    e.payload_json->'data'->'payload'->>'text',
    e.payload_json->'payload'->>'text'
  ),
  COALESCE(
    (e.payload_json->'data'->'payload'->>'createdAt')::timestamptz,
    (e.payload_json->'payload'->>'createdAt')::timestamptz,
    (e.payload_json->>'createdAt')::timestamptz
  ),
  COALESCE(
    e.payload_json->'data'->'payload'->>'whatsappId',
    e.payload_json->'payload'->>'whatsappId',
    e.payload_json->>'whatsappId',
    e.payload_json->'data'->'payload'->>'wid',
    e.payload_json->'payload'->>'wid'
  ),
  COALESCE(
    (e.payload_json->'data'->'payload'->'ticket'->'userId')::text,
    (e.payload_json->'payload'->'ticket'->'userId')::text
  ),
  COALESCE(
    e.payload_json->'data'->'payload'->'ticket'->'user'->>'name',
    e.payload_json->'payload'->'ticket'->'user'->>'name',
    e.payload_json->'data'->'payload'->'ticket'->>'userName',
    e.payload_json->'payload'->'ticket'->>'userName'
  ),
  e.payload_json,
  'd84e2150-0ae0-4462-880c-da8cec89e96a'::uuid,
  COALESCE(
    (e.payload_json->'data'->'payload'->'ticket'->>'isGroup')::boolean,
    (e.payload_json->'payload'->'ticket'->>'isGroup')::boolean,
    false
  )
FROM public.onecode_webhook_events e
WHERE e.onecode_object = 'messages'
  AND e.onecode_action = 'create'
  AND e.processed = false
  AND e.message_id IS NOT NULL
  AND e.message_id != ''
ON CONFLICT (onecode_message_id) DO NOTHING;

-- 3. Mark reprocessed events as processed
UPDATE public.onecode_webhook_events
SET processed = true, error_message = null
WHERE onecode_object = 'messages'
  AND onecode_action = 'create'
  AND processed = false
  AND message_id IS NOT NULL
  AND message_id != '';
