

## Redefinir senha diretamente via Edge Function

Como os links de reset do Supabase nao estao funcionando (erro "Email link is invalid or has expired" nos logs), vou criar uma edge function temporaria para definir sua senha sem precisar de autenticacao.

### Passo 1: Criar edge function temporaria
Criar `set-password-noauth` que usa uma chave secreta interna (SUPABASE_SERVICE_ROLE_KEY) para atualizar a senha do usuario diretamente, sem exigir login.

### Passo 2: Coletar sua senha
Vou pedir que voce informe a senha desejada no chat. A funcao vai atualizar a senha do usuario `6a53df87-dbd5-46b3-bf52-1febeafb2312` (fernandov.guedes@gmail.com).

### Passo 3: Chamar a funcao e definir a senha
Executar a edge function para aplicar a nova senha.

### Passo 4: Limpar
Remover a edge function temporaria apos uso, por seguranca.

### Detalhes Tecnicos

A edge function `set-password-noauth/index.ts`:
- Aceita POST com `{ "password": "...", "secret": "..." }`
- Valida um token secreto hardcoded para evitar uso indevido
- Usa `supabase.auth.admin.updateUserById()` com o service role key
- Atualiza a senha do user_id fixo (`6a53df87...`)
- Sera deletada apos o uso

