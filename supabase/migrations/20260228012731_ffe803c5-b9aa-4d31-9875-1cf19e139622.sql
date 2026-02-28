-- Clean up all stuck running/pending jobs
UPDATE public.integration_jobs 
SET status = 'error', 
    error_message = 'Cleanup: jobs stuck at 50% before fix deploy', 
    finished_at = now(), 
    progress = 0
WHERE status IN ('running', 'pending');

-- Clean up ghost running states in tenant_integrations
UPDATE public.tenant_integrations 
SET last_status = 'idle', 
    last_error = NULL
WHERE last_status = 'running';