
-- Add can_edit column to user_modules
ALTER TABLE public.user_modules ADD COLUMN can_edit boolean NOT NULL DEFAULT false;

-- Create function to check module edit access
CREATE OR REPLACE FUNCTION public.has_module_edit_access(_user_id uuid, _module_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.user_modules um
    JOIN public.modules m ON m.id = um.module_id
    WHERE um.user_id = _user_id AND m.slug = _module_slug AND um.can_edit = true AND m.ativo = true
  )
$$;
