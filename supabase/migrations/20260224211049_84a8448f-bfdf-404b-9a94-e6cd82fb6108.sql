
-- ============================================
-- 1. Criar tabela integration_providers
-- ============================================
CREATE TABLE public.integration_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_global BOOLEAN NOT NULL DEFAULT true,
  config_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read integration_providers"
  ON public.integration_providers FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage integration_providers"
  ON public.integration_providers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- 2. Evoluir tabela tenant_integrations
-- ============================================
ALTER TABLE public.tenant_integrations
  ADD COLUMN provider_id UUID REFERENCES public.integration_providers(id),
  ADD COLUMN last_run TIMESTAMP WITH TIME ZONE,
  ADD COLUMN last_status TEXT,
  ADD COLUMN last_error TEXT,
  ADD COLUMN plan_feature_code TEXT,
  ADD COLUMN config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Unique constraint (only when provider_id is set)
CREATE UNIQUE INDEX uq_tenant_provider ON public.tenant_integrations (tenant_id, provider_id) WHERE provider_id IS NOT NULL;

-- ============================================
-- 3. Evoluir tabela integration_logs
-- ============================================
ALTER TABLE public.integration_logs
  ADD COLUMN provider_slug TEXT,
  ADD COLUMN execution_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN payload JSONB,
  ADD COLUMN response JSONB;

CREATE INDEX idx_integration_logs_tenant_integration ON public.integration_logs (tenant_id, integration);

-- ============================================
-- 4. Seed: integration_providers
-- ============================================
INSERT INTO public.integration_providers (name, slug, description, category, is_global, config_schema) VALUES
  ('Acessórias', 'acessorias', 'Sincronização de empresas e obrigações fiscais via API Acessórias', 'fiscal', true,
   '[{"key":"base_url","label":"URL Base","type":"text","required":true}]'::jsonb),
  ('BomControle', 'bomcontrole', 'Gestão de contratos e faturas via API BomControle', 'financeiro', true,
   '[{"key":"base_url","label":"URL Base","type":"text","required":true}]'::jsonb),
  ('OneCode', 'onecode', 'Integração de mensagens e contatos WhatsApp via OneCode', 'messaging', true,
   '[{"key":"api_url","label":"URL da API","type":"text","required":true},{"key":"webhook_url","label":"URL do Webhook","type":"text","required":false}]'::jsonb);

-- ============================================
-- 5. Vincular tenant_integrations existentes aos providers
-- ============================================
UPDATE public.tenant_integrations ti
SET provider_id = ip.id,
    config = jsonb_build_object('base_url', ti.base_url)
FROM public.integration_providers ip
WHERE ti.provider = ip.slug;

-- ============================================
-- 6. Inserir módulo Integrações
-- ============================================
INSERT INTO public.modules (nome, slug, descricao, icone, ativo, ordem)
VALUES ('Integrações', 'integracoes', 'Gerenciamento central de integrações API', 'Settings', true, 90);
