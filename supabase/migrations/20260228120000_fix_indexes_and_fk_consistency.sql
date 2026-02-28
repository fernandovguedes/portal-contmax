-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Indexes on whatsapp_logs
--    empresa_id is used in WHERE/JOIN clauses when loading logs per company.
--    user_id is used in RLS policies and audit queries.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_empresa_id
  ON public.whatsapp_logs (empresa_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_user_id
  ON public.whatsapp_logs (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FK: integration_jobs.tenant_id → organizacoes.id
--    The column was created as uuid NOT NULL without a FK constraint.
--    Consistent with tenant_integrations, bc_contracts, bc_sync_log which all
--    use ON DELETE CASCADE for their tenant_id FK.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.integration_jobs
  ADD CONSTRAINT fk_integration_jobs_tenant
  FOREIGN KEY (tenant_id)
  REFERENCES public.organizacoes (id)
  ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS function consistency: has_module_edit_access must check m.ativo = true
--    same as has_module_access. Re-create explicitly to document and enforce.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_module_edit_access(_user_id uuid, _module_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.user_modules um
    JOIN public.modules m ON m.id = um.module_id
    WHERE um.user_id = _user_id
      AND m.slug = _module_slug
      AND um.can_edit = true
      AND m.ativo = true
  )
$$;
