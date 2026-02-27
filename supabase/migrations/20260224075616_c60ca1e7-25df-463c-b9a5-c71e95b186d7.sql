
-- Table: onecode_messages_raw
CREATE TABLE public.onecode_messages_raw (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  onecode_message_id text UNIQUE NOT NULL,
  ticket_id text NOT NULL,
  contact_id text,
  from_me boolean NOT NULL,
  body text,
  created_at_onecode timestamptz,
  whatsapp_id text,
  user_id text,
  user_name text,
  payload_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onecode_messages_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read onecode_messages_raw"
  ON public.onecode_messages_raw FOR SELECT
  USING (true);

CREATE INDEX idx_onecode_messages_ticket ON public.onecode_messages_raw (ticket_id);

-- Table: onecode_ticket_scores
CREATE TABLE public.onecode_ticket_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id text NOT NULL,
  user_id text,
  user_name text,
  clareza numeric(3,1),
  cordialidade numeric(3,1),
  objetividade numeric(3,1),
  resolucao numeric(3,1),
  conformidade numeric(3,1),
  score_final numeric(4,1),
  feedback text,
  scored_at timestamptz NOT NULL DEFAULT now(),
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onecode_ticket_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read onecode_ticket_scores"
  ON public.onecode_ticket_scores FOR SELECT
  USING (true);

CREATE INDEX idx_onecode_scores_ticket ON public.onecode_ticket_scores (ticket_id);
CREATE INDEX idx_onecode_scores_scored_at ON public.onecode_ticket_scores (scored_at);
