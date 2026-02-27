
-- Create integration_jobs table for async job queue
CREATE TABLE public.integration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider_slug text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  started_at timestamptz,
  finished_at timestamptz,
  execution_time_ms integer,
  error_message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX idx_integration_jobs_tenant_provider ON public.integration_jobs (tenant_id, provider_slug);
CREATE INDEX idx_integration_jobs_status ON public.integration_jobs (status);

-- Enable RLS
ALTER TABLE public.integration_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: admins only, isolated by tenant
CREATE POLICY "Admins can read integration_jobs"
  ON public.integration_jobs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert integration_jobs"
  ON public.integration_jobs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update integration_jobs"
  ON public.integration_jobs FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.integration_jobs;
