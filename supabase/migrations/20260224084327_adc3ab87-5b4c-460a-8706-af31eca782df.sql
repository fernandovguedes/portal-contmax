
-- Add new columns for detailed evaluation
ALTER TABLE public.onecode_ticket_scores
ADD COLUMN IF NOT EXISTS pontos_fortes text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS pontos_melhoria text[] DEFAULT '{}';
