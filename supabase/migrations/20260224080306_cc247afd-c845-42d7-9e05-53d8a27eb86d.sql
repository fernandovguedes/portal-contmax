
-- Add organizacao_id to onecode_messages_raw
ALTER TABLE public.onecode_messages_raw
  ADD COLUMN organizacao_id uuid REFERENCES public.organizacoes(id);

-- Backfill existing rows to contmax (default tenant)
UPDATE public.onecode_messages_raw
  SET organizacao_id = 'd84e2150-0ae0-4462-880c-da8cec89e96a'
  WHERE organizacao_id IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE public.onecode_messages_raw
  ALTER COLUMN organizacao_id SET NOT NULL;

-- Add index
CREATE INDEX idx_onecode_messages_org ON public.onecode_messages_raw(organizacao_id);

-- Add organizacao_id to onecode_ticket_scores
ALTER TABLE public.onecode_ticket_scores
  ADD COLUMN organizacao_id uuid REFERENCES public.organizacoes(id);

-- Backfill existing rows to contmax
UPDATE public.onecode_ticket_scores
  SET organizacao_id = 'd84e2150-0ae0-4462-880c-da8cec89e96a'
  WHERE organizacao_id IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE public.onecode_ticket_scores
  ALTER COLUMN organizacao_id SET NOT NULL;

-- Add index
CREATE INDEX idx_onecode_scores_org ON public.onecode_ticket_scores(organizacao_id);
