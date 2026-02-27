
-- Add unique constraint on ticket_id for idempotency
ALTER TABLE public.onecode_ticket_scores
ADD CONSTRAINT onecode_ticket_scores_ticket_id_unique UNIQUE (ticket_id);
