ALTER TABLE public.whatsapp_logs
  ADD COLUMN batch_id uuid,
  ADD COLUMN batch_index integer,
  ADD COLUMN batch_total integer;