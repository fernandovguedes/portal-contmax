
-- =============================================
-- BomControle Integration Tables
-- =============================================

-- 1. bc_contracts — maps portal companies to BomControle contract IDs
CREATE TABLE public.bc_contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id text NOT NULL,
  portal_company_id uuid NOT NULL,
  bc_contract_id integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_bc_contracts_tenant_company ON public.bc_contracts (tenant_id, portal_company_id);
CREATE INDEX idx_bc_contracts_tenant ON public.bc_contracts (tenant_id);

ALTER TABLE public.bc_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bc_contracts"
  ON public.bc_contracts FOR SELECT
  USING (true);

CREATE POLICY "Users with honorarios edit can manage bc_contracts"
  ON public.bc_contracts FOR ALL
  USING (has_module_edit_access(auth.uid(), 'honorarios-contmax'));

-- 2. bc_invoice_map — tracks invoice resolution per company/month
CREATE TABLE public.bc_invoice_map (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id text NOT NULL,
  portal_company_id uuid NOT NULL,
  competencia text NOT NULL,
  bc_contract_id integer NOT NULL,
  bc_invoice_id integer NOT NULL,
  due_date text,
  last_synced_value numeric,
  synced_at timestamp with time zone,
  status text NOT NULL DEFAULT 'synced',
  message text,
  paid boolean NOT NULL DEFAULT false,
  payment_date text,
  payment_value numeric,
  last_payment_sync_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_bc_invoice_map_unique ON public.bc_invoice_map (tenant_id, portal_company_id, competencia);
CREATE INDEX idx_bc_invoice_map_competencia ON public.bc_invoice_map (tenant_id, competencia);
CREATE INDEX idx_bc_invoice_map_unpaid ON public.bc_invoice_map (paid, competencia) WHERE paid = false;

ALTER TABLE public.bc_invoice_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bc_invoice_map"
  ON public.bc_invoice_map FOR SELECT
  USING (true);

CREATE POLICY "Users with honorarios edit can manage bc_invoice_map"
  ON public.bc_invoice_map FOR ALL
  USING (has_module_edit_access(auth.uid(), 'honorarios-contmax'));

-- 3. bc_sync_log — audit trail for all BC API calls
CREATE TABLE public.bc_sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id text NOT NULL,
  competencia text,
  portal_company_id uuid,
  action text NOT NULL,
  ok boolean NOT NULL DEFAULT true,
  duration_ms integer,
  request_json jsonb,
  response_json jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_bc_sync_log_tenant_date ON public.bc_sync_log (tenant_id, created_at DESC);

ALTER TABLE public.bc_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bc_sync_log"
  ON public.bc_sync_log FOR SELECT
  USING (true);

CREATE POLICY "Users with honorarios edit can insert bc_sync_log"
  ON public.bc_sync_log FOR INSERT
  WITH CHECK (has_module_edit_access(auth.uid(), 'honorarios-contmax'));
