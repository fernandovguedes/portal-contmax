
-- Drop existing permissive policies for write operations
DROP POLICY "Authenticated users can insert empresas" ON public.empresas;
DROP POLICY "Authenticated users can update empresas" ON public.empresas;
DROP POLICY "Authenticated users can delete empresas" ON public.empresas;

-- Recreate with edit permission check
CREATE POLICY "Users with edit access can insert empresas"
ON public.empresas FOR INSERT
WITH CHECK (public.has_module_edit_access(auth.uid(), 'controle-fiscal'));

CREATE POLICY "Users with edit access can update empresas"
ON public.empresas FOR UPDATE
USING (public.has_module_edit_access(auth.uid(), 'controle-fiscal'));

CREATE POLICY "Users with edit access can delete empresas"
ON public.empresas FOR DELETE
USING (public.has_module_edit_access(auth.uid(), 'controle-fiscal'));
