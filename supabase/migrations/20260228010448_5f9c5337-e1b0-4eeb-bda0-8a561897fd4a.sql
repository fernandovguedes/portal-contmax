-- Clean up stuck running/pending integration_jobs
UPDATE public.integration_jobs 
SET status = 'error', 
    error_message = 'Manual cleanup: job ficou preso em running', 
    finished_at = now(), 
    progress = 0
WHERE status IN ('running', 'pending');

-- Clean up ghost running states in tenant_integrations
UPDATE public.tenant_integrations 
SET last_status = 'error', 
    last_error = 'Manual cleanup: estado fantasma corrigido'
WHERE last_status = 'running';