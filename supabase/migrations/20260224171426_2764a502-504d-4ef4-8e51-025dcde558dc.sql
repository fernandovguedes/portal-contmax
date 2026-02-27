
-- Drop the existing unique constraint that blocks multiple contracts per company
DROP INDEX IF EXISTS idx_bc_contracts_tenant_company;

-- Create a partial unique index: only ONE non-legacy contract per (tenant_id, portal_company_id)
CREATE UNIQUE INDEX idx_bc_contracts_tenant_company_primary
ON bc_contracts (tenant_id, portal_company_id)
WHERE legacy = false;
