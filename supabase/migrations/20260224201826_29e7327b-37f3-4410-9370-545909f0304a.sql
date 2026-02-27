
-- 1. Add columns to empresas
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS onecode_contact_id text,
  ADD COLUMN IF NOT EXISTS whatsapp_synced_at timestamptz;

-- 2. Create onecode_contact_match_log
CREATE TABLE public.onecode_contact_match_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  contact_id text NOT NULL,
  contact_name text NOT NULL,
  company_id uuid,
  similarity_score numeric NOT NULL,
  status text NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onecode_contact_match_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read onecode_contact_match_log"
  ON public.onecode_contact_match_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Create onecode_contact_review
CREATE TABLE public.onecode_contact_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  contact_id text NOT NULL,
  contact_name text NOT NULL,
  contact_phone text,
  suggested_company_id uuid NOT NULL,
  suggested_company_name text NOT NULL,
  similarity_score numeric NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  resolved_action text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onecode_contact_review ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read onecode_contact_review"
  ON public.onecode_contact_review FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update onecode_contact_review"
  ON public.onecode_contact_review FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Create integration_logs
CREATE TABLE public.integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  integration text NOT NULL,
  status text NOT NULL,
  total_processados integer NOT NULL DEFAULT 0,
  total_matched integer NOT NULL DEFAULT 0,
  total_review integer NOT NULL DEFAULT 0,
  total_ignored integer NOT NULL DEFAULT 0,
  execution_time_ms integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read integration_logs"
  ON public.integration_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
