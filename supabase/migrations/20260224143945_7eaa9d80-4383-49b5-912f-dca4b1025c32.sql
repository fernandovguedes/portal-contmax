
ALTER TABLE public.bc_contracts
  ADD COLUMN legacy boolean NOT NULL DEFAULT false,
  ADD COLUMN closed_at timestamptz,
  ADD COLUMN closed_competencia text;
