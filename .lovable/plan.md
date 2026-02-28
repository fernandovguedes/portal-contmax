
# Filtrar empresas ativas + Baixar inativas automaticamente

## Problema atual

O sync do Acessorias processa ~38.000 empresas (1.900+ paginas), incluindo inativas. Isso e lento e desnecessario. Alem disso, quando uma empresa e baixada no Acessorias, o portal nao reflete essa mudanca.

## Solucao em duas partes

### 1. Empresas ativas: processar normalmente (criar/atualizar)

Manter o fluxo atual de insert/update apenas para empresas com `Status === "Ativa"`.

### 2. Empresas inativas: baixar automaticamente no portal

Quando o sync encontra uma empresa com Status diferente de "Ativa" e ela **ja existe no portal sem `data_baixa`**, preencher `data_baixa` com a data atual, mantendo a lista sincronizada.

Empresas inativas que **nao existem** no portal serao simplesmente ignoradas (nao faz sentido criar uma empresa ja baixada).

### Logica no loop de processamento

```text
Para cada empresa da API:
  totalRead++
  
  SE status != "Ativa":
    Buscar no banco por CNPJ
    SE existe E nao tem data_baixa:
      UPDATE data_baixa = hoje
      totalUpdated++
    SENAO:
      totalSkipped++
    continue
  
  (fluxo normal de create/update para ativas)
```

### Arquivos modificados

**`supabase/functions/sync-acessorias/index.ts`** (funcao principal)
- Adicionar filtro de status apos `totalRead++`
- Para inativas existentes no portal: setar `data_baixa`
- Para inativas sem cadastro: skip

**`supabase/functions/sync-acessorias-cron/index.ts`** (versao cron)
- Mesma logica de filtro de status

### Impacto

- Velocidade: o processamento pesado (hash + 3 queries de busca) so roda para empresas ativas
- Para inativas, apenas 1 query leve de busca por CNPJ e necessaria (e so quando existe match)
- A lista do portal ficara sempre sincronizada com o Acessorias: empresas baixadas la serao baixadas aqui automaticamente
- Nenhuma mudanca no banco de dados (o campo `data_baixa` ja existe na tabela `empresas`)

### Detalhes tecnicos

- O campo `Status` vem em PascalCase da API do Acessorias (confirmado em diagnosticos anteriores)
- A busca para inativas usa apenas o match por CNPJ formatado (query unica, sem as 3 queries de fallback)
- O `synced_at` e atualizado tambem nas empresas baixadas para registrar que foram vistas no sync
- Contadores: inativas baixadas contam como `totalUpdated`, inativas ignoradas contam como `totalSkipped`
