CREATE TABLE public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  "to" text NOT NULL,
  body text NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  ticket_id text,
  response_raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read whatsapp_logs"
  ON public.whatsapp_logs FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert whatsapp_logs"
  ON public.whatsapp_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);