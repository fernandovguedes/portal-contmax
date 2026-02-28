-- Clean up stuck OneCode Contmax job
UPDATE public.integration_jobs 
SET status = 'error', 
    error_message = 'Edge function foi morta pelo runtime (concorrência)', 
    finished_at = now(), 
    progress = 0
WHERE id = 'e59fba3c-c487-4f14-b3b0-7d345a1f50b6';

-- Also update tenant_integration status
UPDATE public.tenant_integrations 
SET last_status = 'error', 
    last_error = 'Função morta por concorrência, executar novamente'
WHERE provider = 'onecode' AND tenant_id = 'd84e2150-0ae0-4462-880c-da8cec89e96a';