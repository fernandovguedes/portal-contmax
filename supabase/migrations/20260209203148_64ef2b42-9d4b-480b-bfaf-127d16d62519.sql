
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Modules table
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  descricao TEXT,
  icone TEXT DEFAULT 'LayoutDashboard',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

-- User-module access table
CREATE TABLE public.user_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id)
);
ALTER TABLE public.user_modules ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Security definer function to check module access
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id UUID, _module_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_modules um
    JOIN public.modules m ON m.id = um.module_id
    WHERE um.user_id = _user_id AND m.slug = _module_slug AND m.ativo = true
  ) OR public.has_role(_user_id, 'admin')
$$;

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Profiles: users can read their own, admins can read all
CREATE POLICY "Users can read own profile" ON public.profiles
FOR SELECT USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins can update all profiles" ON public.profiles
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert profiles" ON public.profiles
FOR INSERT WITH CHECK (true);

-- User roles: only admins can manage
CREATE POLICY "Admins can read all roles" ON public.user_roles
FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

CREATE POLICY "Admins can insert roles" ON public.user_roles
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Modules: authenticated users can read active modules
CREATE POLICY "Authenticated users can read modules" ON public.modules
FOR SELECT USING (true);

CREATE POLICY "Admins can manage modules" ON public.modules
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- User modules: admins manage, users can read own
CREATE POLICY "Users can read own modules" ON public.user_modules
FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert user_modules" ON public.user_modules
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user_modules" ON public.user_modules
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Seed: Insert Controle Fiscal as first module
INSERT INTO public.modules (nome, slug, descricao, icone, ordem)
VALUES ('Controle Fiscal', 'controle-fiscal', 'Gestão de obrigações fiscais e faturamento', 'FileText', 1);

-- Make current admin user an admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'fernandov.guedes@gmail.com'
ON CONFLICT DO NOTHING;

-- Create profile for existing user
INSERT INTO public.profiles (id, nome, email)
SELECT id, COALESCE(raw_user_meta_data->>'nome', 'Fernando'), email
FROM auth.users WHERE email = 'fernandov.guedes@gmail.com'
ON CONFLICT DO NOTHING;

-- Give admin access to all modules
INSERT INTO public.user_modules (user_id, module_id)
SELECT u.id, m.id FROM auth.users u, public.modules m
WHERE u.email = 'fernandov.guedes@gmail.com'
ON CONFLICT DO NOTHING;
