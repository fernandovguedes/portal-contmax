
-- Re-create tables that were rolled back in the first migration

-- 1.1: organizacoes updated_at (may already exist from partial apply)
ALTER TABLE public.organizacoes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Trigger (create only if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_organizacoes_updated_at'
  ) THEN
    CREATE TRIGGER update_organizacoes_updated_at
      BEFORE UPDATE ON public.organizacoes
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 1.2: tenant_integrations
CREATE TABLE IF NOT EXISTS public.tenant_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  provider text NOT NULL,
  base_url text NOT NULL DEFAULT 'https://api.acessorias.com',
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage tenant_integrations' AND tablename = 'tenant_integrations'
  ) THEN
    CREATE POLICY "Admins can manage tenant_integrations"
      ON public.tenant_integrations FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_tenant_integrations_updated_at'
  ) THEN
    CREATE TRIGGER update_tenant_integrations_updated_at
      BEFORE UPDATE ON public.tenant_integrations
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 1.3: user_tenants
CREATE TABLE IF NOT EXISTS public.user_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage user_tenants' AND tablename = 'user_tenants'
  ) THEN
    CREATE POLICY "Admins can manage user_tenants"
      ON public.user_tenants FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own tenant memberships' AND tablename = 'user_tenants'
  ) THEN
    CREATE POLICY "Users can read own tenant memberships"
      ON public.user_tenants FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Helper function
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.user_tenants ut
    JOIN public.organizacoes o ON o.id = ut.tenant_id
    WHERE ut.user_id = _user_id
      AND o.slug = _tenant_slug
      AND ut.role = 'admin'
  )
$$;

-- 1.4: empresas sync columns
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_key text,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb,
  ADD COLUMN IF NOT EXISTS hash_payload text,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_empresas_tenant_cnpj ON public.empresas(organizacao_id, cnpj);

-- 1.5: sync_jobs
CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  provider text NOT NULL,
  entity text NOT NULL DEFAULT 'companies',
  status text NOT NULL DEFAULT 'running',
  total_read integer NOT NULL DEFAULT 0,
  total_created integer NOT NULL DEFAULT 0,
  total_updated integer NOT NULL DEFAULT 0,
  total_skipped integer NOT NULL DEFAULT 0,
  total_errors integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_by_user_id uuid,
  error_message text
);

ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read sync_jobs' AND tablename = 'sync_jobs') THEN
    CREATE POLICY "Admins can read sync_jobs" ON public.sync_jobs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can insert sync_jobs' AND tablename = 'sync_jobs') THEN
    CREATE POLICY "Admins can insert sync_jobs" ON public.sync_jobs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update sync_jobs' AND tablename = 'sync_jobs') THEN
    CREATE POLICY "Admins can update sync_jobs" ON public.sync_jobs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- 1.6: sync_logs
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id uuid NOT NULL REFERENCES public.sync_jobs(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read sync_logs' AND tablename = 'sync_logs') THEN
    CREATE POLICY "Admins can read sync_logs" ON public.sync_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sync_logs_job_id ON public.sync_logs(sync_job_id);
