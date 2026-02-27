-- Add is_group column to onecode_messages_raw
ALTER TABLE public.onecode_messages_raw 
  ADD COLUMN is_group boolean NOT NULL DEFAULT false;

-- Backfill existing messages based on OneCode payload
UPDATE public.onecode_messages_raw
SET is_group = COALESCE(
  (payload_json->'data'->'payload'->'ticket'->>'isGroup')::boolean,
  false
)
WHERE is_group = false;