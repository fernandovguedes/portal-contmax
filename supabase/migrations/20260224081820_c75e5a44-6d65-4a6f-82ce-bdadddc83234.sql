
-- Create table for raw webhook event auditing
CREATE TABLE public.onecode_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  source text,
  onecode_object text,
  onecode_action text,
  message_id text,
  ticket_id bigint,
  payload_json jsonb,
  processed boolean NOT NULL DEFAULT false,
  error_message text
);

-- Indexes for common queries
CREATE INDEX idx_onecode_webhook_events_processed ON public.onecode_webhook_events (processed) WHERE processed = false;
CREATE INDEX idx_onecode_webhook_events_received_at ON public.onecode_webhook_events (received_at DESC);
CREATE INDEX idx_onecode_webhook_events_message_id ON public.onecode_webhook_events (message_id) WHERE message_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.onecode_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only admins can read (for the error panel)
CREATE POLICY "Admins can read onecode_webhook_events"
  ON public.onecode_webhook_events
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- No client-side insert/update/delete — only service_role from edge functions

-- Ensure unique constraint on onecode_messages_raw.onecode_message_id (if not already)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'onecode_messages_raw_onecode_message_id_key'
  ) THEN
    ALTER TABLE public.onecode_messages_raw ADD CONSTRAINT onecode_messages_raw_onecode_message_id_key UNIQUE (onecode_message_id);
  END IF;
END $$;
