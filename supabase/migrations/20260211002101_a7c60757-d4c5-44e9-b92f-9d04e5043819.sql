
-- Create organizacoes table
CREATE TABLE public.organizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organizacoes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read organizacoes"
ON public.organizacoes FOR SELECT
USING (true);

CREATE POLICY "Admins can manage organizacoes"
ON public.organizacoes FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert initial organizations
INSERT INTO public.organizacoes (nome, slug) VALUES ('P&G', 'pg'), ('Contmax', 'contmax');

-- Add organizacao_id to empresas (nullable first)
ALTER TABLE public.empresas ADD COLUMN organizacao_id uuid REFERENCES public.organizacoes(id);

-- Set all existing empresas to P&G
UPDATE public.empresas SET organizacao_id = (SELECT id FROM public.organizacoes WHERE slug = 'pg');

-- Make NOT NULL
ALTER TABLE public.empresas ALTER COLUMN organizacao_id SET NOT NULL;

-- Add organizacao_id to modules (nullable, not all modules need a client base)
ALTER TABLE public.modules ADD COLUMN organizacao_id uuid REFERENCES public.organizacoes(id);

-- Set controle-fiscal module to P&G
UPDATE public.modules SET organizacao_id = (SELECT id FROM public.organizacoes WHERE slug = 'pg') WHERE slug = 'controle-fiscal';
