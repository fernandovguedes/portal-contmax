
-- Drop the overly permissive SELECT policy
DROP POLICY "Authenticated users can read whatsapp_logs" ON public.whatsapp_logs;

-- Create a scoped SELECT policy: admins OR users with module access to the empresa's org
CREATE POLICY "Users can read org-scoped whatsapp_logs"
ON public.whatsapp_logs FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.empresas e
    JOIN public.user_tenants ut ON ut.tenant_id = e.organizacao_id
    WHERE e.id = whatsapp_logs.empresa_id
      AND ut.user_id = auth.uid()
  )
);
