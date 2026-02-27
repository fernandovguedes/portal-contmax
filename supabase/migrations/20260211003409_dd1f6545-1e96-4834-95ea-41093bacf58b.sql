
-- Update RLS policies on empresas to accept both controle-fiscal and clientes-pg module slugs

DROP POLICY IF EXISTS "Users with edit access can insert empresas" ON public.empresas;
DROP POLICY IF EXISTS "Users with edit access can update empresas" ON public.empresas;
DROP POLICY IF EXISTS "Users with edit access can delete empresas" ON public.empresas;

CREATE POLICY "Users with edit access can insert empresas"
ON public.empresas
FOR INSERT
WITH CHECK (
  has_module_edit_access(auth.uid(), 'controle-fiscal') OR
  has_module_edit_access(auth.uid(), 'clientes-pg')
);

CREATE POLICY "Users with edit access can update empresas"
ON public.empresas
FOR UPDATE
USING (
  has_module_edit_access(auth.uid(), 'controle-fiscal') OR
  has_module_edit_access(auth.uid(), 'clientes-pg')
);

CREATE POLICY "Users with edit access can delete empresas"
ON public.empresas
FOR DELETE
USING (
  has_module_edit_access(auth.uid(), 'controle-fiscal') OR
  has_module_edit_access(auth.uid(), 'clientes-pg')
);
