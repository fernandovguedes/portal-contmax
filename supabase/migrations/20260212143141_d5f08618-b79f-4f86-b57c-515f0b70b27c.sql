
-- Table: honorarios_config (global settings)
CREATE TABLE public.honorarios_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salario_minimo numeric NOT NULL DEFAULT 1618.00,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.honorarios_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read honorarios_config"
  ON public.honorarios_config FOR SELECT
  USING (true);

CREATE POLICY "Users with edit access can manage honorarios_config"
  ON public.honorarios_config FOR ALL
  USING (has_module_edit_access(auth.uid(), 'honorarios-contmax'));

-- Insert default config
INSERT INTO public.honorarios_config (salario_minimo) VALUES (1618.00);

-- Trigger for updated_at
CREATE TRIGGER update_honorarios_config_updated_at
  BEFORE UPDATE ON public.honorarios_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Table: honorarios_empresas
CREATE TABLE public.honorarios_empresas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  fiscal_percentual numeric NOT NULL DEFAULT 0,
  contabil_percentual numeric NOT NULL DEFAULT 0,
  pessoal_valor numeric NOT NULL DEFAULT 0,
  emitir_nf text NOT NULL DEFAULT '',
  nao_emitir_boleto boolean NOT NULL DEFAULT false,
  meses jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX honorarios_empresas_empresa_id_unique ON public.honorarios_empresas(empresa_id);

ALTER TABLE public.honorarios_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read honorarios_empresas"
  ON public.honorarios_empresas FOR SELECT
  USING (true);

CREATE POLICY "Users with edit access can insert honorarios_empresas"
  ON public.honorarios_empresas FOR INSERT
  WITH CHECK (has_module_edit_access(auth.uid(), 'honorarios-contmax'));

CREATE POLICY "Users with edit access can update honorarios_empresas"
  ON public.honorarios_empresas FOR UPDATE
  USING (has_module_edit_access(auth.uid(), 'honorarios-contmax'));

CREATE POLICY "Users with edit access can delete honorarios_empresas"
  ON public.honorarios_empresas FOR DELETE
  USING (has_module_edit_access(auth.uid(), 'honorarios-contmax'));

CREATE TRIGGER update_honorarios_empresas_updated_at
  BEFORE UPDATE ON public.honorarios_empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the module
INSERT INTO public.modules (nome, slug, descricao, icone, ordem, organizacao_id)
VALUES (
  'Honorários Mensal Contmax',
  'honorarios-contmax',
  'Controle de honorários mensais das empresas Contmax',
  'DollarSign',
  3,
  'd84e2150-0ae0-4462-880c-da8cec89e96a'
);
