

# Flag `numero_questor_confirmado` para filtro correto

## Problema

- `externalSource === 'acessorias'` mostra TODAS as empresas synced, inclusive as que ja tem numero real
- `numero === 0` nao funciona para P&G (la nenhuma empresa tem zero)
- Nao existe hoje um campo que distinga "numero real preenchido por usuario" de "numero sequencial automatico"

## Solucao

Adicionar coluna `numero_questor_confirmado` (boolean, default `false`) na tabela `empresas`. Empresas existentes serao marcadas como `true` (ja tem numero). Apenas novas empresas vindas do sync terao `false`, aparecendo no filtro ate um usuario confirmar o numero.

## Alteracoes

### 1. Migracao SQL

```sql
ALTER TABLE empresas 
  ADD COLUMN numero_questor_confirmado boolean NOT NULL DEFAULT false;

-- Marcar TODAS as empresas existentes como confirmadas
UPDATE empresas SET numero_questor_confirmado = true;
```

Resultado: empresas existentes nao aparecem no filtro. Apenas novas synced (que entrarao com `false`) aparecerao.

### 2. Sync functions -- setar `false` para novas empresas

Nos arquivos `supabase/functions/sync-acessorias/index.ts` e `supabase/functions/sync-acessorias-cron/index.ts`, adicionar `numero_questor_confirmado: false` no INSERT de novas empresas. No UPDATE de empresas existentes, NAO alterar esse campo (para nao resetar empresas ja confirmadas).

### 3. Tipo TypeScript -- `src/types/fiscal.ts`

Adicionar na interface `Empresa`:

```typescript
numeroQuestorConfirmado?: boolean;
```

### 4. Hook -- `src/hooks/useEmpresas.ts`

- Adicionar `numero_questor_confirmado` na string COLUMNS
- No `rowToEmpresa`: mapear `row.numero_questor_confirmado` para `numeroQuestorConfirmado`
- No `empresaToRow`: mapear `empresa.numeroQuestorConfirmado` para `numero_questor_confirmado`

### 5. Formulario -- `src/components/EmpresaFormDialog.tsx`

Quando o usuario salvar/editar uma empresa, enviar `numeroQuestorConfirmado: true` no objeto de dados. Isso garante que ao editar o numero, a empresa sai do filtro.

### 6. Filtro -- `src/pages/Clientes.tsx`

Trocar:

```typescript
const matchesNumero = !semNumeroFilter || e.externalSource === 'acessorias';
```

Para:

```typescript
const matchesNumero = !semNumeroFilter || (e.externalSource === 'acessorias' && !e.numeroQuestorConfirmado);
```

## Resultado esperado

- Empresas existentes (synced ou manuais): NAO aparecem no filtro (todas marcadas `true`)
- Nova empresa vinda do sync: APARECE no filtro (`false` por default)
- Usuario edita numero da empresa synced: some do filtro (flag vira `true`)
- Empresas manuais: nunca aparecem (sem `externalSource`)

## Arquivos afetados

1. Nova migracao SQL
2. `supabase/functions/sync-acessorias/index.ts`
3. `supabase/functions/sync-acessorias-cron/index.ts`
4. `src/types/fiscal.ts`
5. `src/hooks/useEmpresas.ts`
6. `src/components/EmpresaFormDialog.tsx`
7. `src/pages/Clientes.tsx`

