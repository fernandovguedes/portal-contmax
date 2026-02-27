
-- Tabela de empresas (dados compartilhados entre todos os usuários)
CREATE TABLE public.empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero SERIAL,
  nome TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  data_abertura TEXT,
  data_cadastro TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD'),
  regime_tributario TEXT NOT NULL DEFAULT 'simples_nacional',
  emite_nota_fiscal BOOLEAN NOT NULL DEFAULT true,
  socios JSONB NOT NULL DEFAULT '[]'::jsonb,
  meses JSONB NOT NULL DEFAULT '{}'::jsonb,
  obrigacoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Todos os usuários autenticados podem ler
CREATE POLICY "Authenticated users can read empresas"
ON public.empresas FOR SELECT
TO authenticated
USING (true);

-- Todos os usuários autenticados podem inserir
CREATE POLICY "Authenticated users can insert empresas"
ON public.empresas FOR INSERT
TO authenticated
WITH CHECK (true);

-- Todos os usuários autenticados podem atualizar
CREATE POLICY "Authenticated users can update empresas"
ON public.empresas FOR UPDATE
TO authenticated
USING (true);

-- Todos os usuários autenticados podem deletar
CREATE POLICY "Authenticated users can delete empresas"
ON public.empresas FOR DELETE
TO authenticated
USING (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_empresas_updated_at
BEFORE UPDATE ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
