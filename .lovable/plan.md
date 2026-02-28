

# Fix: Erros de build nas Edge Functions

## Problema

Os erros de build sao problemas de tipagem TypeScript nas Edge Functions `close-bomcontrole-contracts` e `sync-acessorias-cron`. O `createClient` retorna um tipo generico que nao e compativel quando usado como `ReturnType<typeof createClient>` em parametros de funcao. Isso faz o TypeScript inferir `never` para os dados retornados do banco, bloqueando o build do preview.

## Solucao

Trocar o tipo dos parametros `supabase` de `ReturnType<typeof createClient>` para `any` nas funcoes auxiliares de ambos os arquivos. Isso e seguro porque sao Edge Functions server-side com service role key.

### Arquivos

**1. `supabase/functions/close-bomcontrole-contracts/index.ts`**
- Linha 75: `fetchAllContracts(supabase: ReturnType<typeof createClient>, ...)` -> `fetchAllContracts(supabase: any, ...)`

**2. `supabase/functions/sync-acessorias-cron/index.ts`**
- Linha 22: `updateJobProgress(supabase: ReturnType<typeof createClient>, ...)` -> `updateJobProgress(supabase: any, ...)`
- Linha 36: `runSync(supabase: ReturnType<typeof createClient>, ...)` -> `runSync(supabase: any, ...)`
- Linha 233: `processTenant(supabase: ReturnType<typeof createClient>, ...)` -> `processTenant(supabase: any, ...)`

Isso resolve todos os ~40 erros de build e o preview voltara a funcionar.

