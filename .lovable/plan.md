

## Problema Identificado

Seu email `fernandov.guedes@gmail.com` tem dois registros na tabela `profiles`:
- Um perfil antigo (criado manualmente) que possui a role `admin`
- Um perfil novo (criado via `auth.users`) que nao possui role `admin`

A role de admin esta vinculada ao perfil errado.

## Plano de Correcao

### Passo 1: Adicionar role admin ao usuario correto
Inserir a role `admin` para o user_id `6a53df87-dbd5-46b3-bf52-1febeafb2312` (o que existe no `auth.users`).

### Passo 2: Resetar a senha
Usar a edge function `reset-user-password` ou atualizar diretamente via migration para definir uma nova senha para o usuario.

Como a edge function precisa de autenticacao admin (que voce ainda nao tem), a solucao mais direta e usar uma migracao SQL para:
- Atualizar a senha via `auth.users`
- Garantir a role admin no perfil correto

### Passo 3: Limpar perfil duplicado
Remover o perfil orfao (`8ac5d683...`) que nao tem usuario correspondente no `auth.users`, e migrar a role admin dele para o perfil correto.

### Detalhes Tecnicos

Migration SQL:
```sql
-- 1. Adicionar role admin ao usuario correto (auth.users)
INSERT INTO public.user_roles (user_id, role)
VALUES ('6a53df87-dbd5-46b3-bf52-1febeafb2312', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Remover role admin do perfil orfao
DELETE FROM public.user_roles
WHERE user_id = '8ac5d683-d908-441f-a15a-573b9cec6612';

-- 3. Remover perfil orfao
DELETE FROM public.profiles
WHERE id = '8ac5d683-d908-441f-a15a-573b9cec6612';
```

Para a senha, sera necessario redefini-la pelo painel do Supabase:
- Acessar Authentication > Users no dashboard
- Localizar `fernandov.guedes@gmail.com`
- Usar "Send password reset" ou definir uma nova senha

Apos isso, voce podera fazer login normalmente com acesso admin.

