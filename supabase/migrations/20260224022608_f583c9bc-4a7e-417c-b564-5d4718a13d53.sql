
-- Criar índice único parcial que falhou na migração anterior (duplicado já removido)
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_tenant_cnpj_unique
  ON public.empresas(organizacao_id, cnpj)
  WHERE cnpj IS NOT NULL AND cnpj != '';
