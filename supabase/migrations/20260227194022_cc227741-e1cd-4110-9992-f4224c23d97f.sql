-- 1. Adicionar role admin ao usuario correto
INSERT INTO public.user_roles (user_id, role)
SELECT '6a53df87-dbd5-46b3-bf52-1febeafb2312', 'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = '6a53df87-dbd5-46b3-bf52-1febeafb2312' AND role = 'admin'
);

-- 2. Remover role admin do perfil orfao
DELETE FROM public.user_roles
WHERE user_id = '8ac5d683-d908-441f-a15a-573b9cec6612';

-- 3. Remover perfil orfao
DELETE FROM public.profiles
WHERE id = '8ac5d683-d908-441f-a15a-573b9cec6612';