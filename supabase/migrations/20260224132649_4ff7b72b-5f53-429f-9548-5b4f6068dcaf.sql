
-- Add unique constraint for upsert on bc_invoice_map (required by Supabase client onConflict)
ALTER TABLE public.bc_invoice_map ADD CONSTRAINT bc_invoice_map_tenant_company_comp_unique UNIQUE USING INDEX idx_bc_invoice_map_unique;
