
-- Correcao 2: Restringir INSERT em profiles
-- O trigger handle_new_user usa SECURITY DEFINER (service_role), entao nao e afetado pelo RLS.
-- Restringimos para que somente o proprio usuario possa inserir seu perfil.
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Correcao 3: Adicionar politica UPDATE em user_modules para admins
CREATE POLICY "Admins can update user_modules"
ON public.user_modules
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));
