

# Corrigir Logs Divergentes entre Integrações e Clientes + Build Errors

## Problema 1: Dados diferentes entre os dois módulos

O módulo **Clientes** (SyncPanel) lê da tabela `sync_jobs` e mostra: total_read, total_created, total_updated, total_skipped, total_errors.

O módulo **Integrações** (IntegracaoDetalhe) lê da tabela `integration_logs` e mostra: total_processados, total_matched, total_ignored.

A edge function `sync-acessorias` grava em ambas as tabelas, mas com mapeamento diferente:
- `sync_jobs`: created, updated, skipped, errors separados
- `integration_logs`: total_processados = totalRead, total_matched = totalCreated + totalUpdated (somados), total_ignored = totalSkipped

Isso causa discrepância visual. O SyncPanel mostra apenas o último job (limit 1), enquanto o IntegracaoDetalhe mostra os últimos 100 logs.

Além disso, a `sync-acessorias` só grava em `integration_logs` quando chamada via `integrationJobId` (fluxo Integrações). Quando chamada diretamente pelo SyncPanel em Clientes, o `integrationJobId` é null e o `integration_logs` NÃO é populado.

### Solução

1. **SyncPanel**: Trocar a fonte de dados de `sync_jobs` para `integration_logs`, ou manter `sync_jobs` mas unificar a apresentação visual para mostrar as mesmas colunas/labels.

**Abordagem recomendada**: Fazer o SyncPanel ler `integration_logs` filtrado por `tenant_id` e `provider_slug = 'acessorias'`, e garantir que a `sync-acessorias` SEMPRE grave em `integration_logs` (mesmo sem `integrationJobId`). Assim ambos os módulos mostram a mesma fonte de dados.

**Alterações:**

- **`supabase/functions/sync-acessorias/index.ts`**: Mover a inserção em `integration_logs` para fora do bloco `if (integrationJobId)`, garantindo que sempre grave ao finalizar. Também corrigir os tipos (`ReturnType<typeof createClient>` → `any`) para resolver os build errors.

- **`src/hooks/useSyncAcessorias.ts`**: Trocar a query de `sync_jobs` para `integration_logs` filtrado por tenant_id e provider_slug `acessorias`, ou manter dual-read mas unificar labels.

- **`src/components/SyncPanel.tsx`**: Ajustar as colunas para usar os mesmos nomes que o IntegracaoDetalhe (Processados, Matched, Ignorados, Tempo) ou vice-versa.

## Problema 2: Build Errors nas Edge Functions

24 erros de tipo causados por:

1. **`sync-acessorias/index.ts`**: Uso de `ReturnType<typeof createClient>` causa inferência de tipo `never`. Conforme memória do projeto, deve usar `any`.

2. **`sync-onecode-contacts/index.ts`**: `.catch()` em queries PostgREST não existe. Deve usar `try/catch` ou remover.

### Alterações para build:

- **`sync-acessorias/index.ts`**: Trocar `ReturnType<typeof createClient>` por `any` em `updateSyncJobProgress`, `preloadEmpresas`, `processBatch`, `finalizeIntegrationJob`.

- **`sync-onecode-contacts/index.ts`** (linhas 379, 381): Remover `.catch(() => {})` das queries PostgREST, envolver em try/catch se necessário.

## Resumo das alterações

| Arquivo | Alteração |
|---|---|
| `sync-acessorias/index.ts` | Tipos `any`, sempre gravar `integration_logs` |
| `sync-onecode-contacts/index.ts` | Remover `.catch()` de queries PostgREST |
| `useSyncAcessorias.ts` | Ler de `integration_logs` ao invés de `sync_jobs` |
| `SyncPanel.tsx` | Unificar colunas com IntegracaoDetalhe |

