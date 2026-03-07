
# Badge de Origem dinamico por tenant no IRPF

## Contexto

Atualmente os badges de origem mostram labels fixos baseados no campo `source` ("P&G", "Contmax", "Avulso"). O pedido e que o label reflita o tenant atual, nao o source.

## Logica

| source | Tenant P&G | Tenant Contmax |
|--------|-----------|----------------|
| PG | "P&G" (laranja/default) | "Contmax" (azul) |
| CONTMAX | "Contmax" (default) | "Contmax" (azul) |
| AVULSO | "Avulso" (cinza/secondary) | "Avulso" (cinza/secondary) |

Ou seja: quando `source !== "AVULSO"`, o badge mostra o nome do tenant atual (baseado no `orgSlug`), nao o source.

## Alteracoes

### 1. `src/components/irpf/IrpfDeclaracoesTable.tsx`
- Adicionar prop `orgSlug: string` ao componente
- Substituir a logica do badge de origem:
  - Se `AVULSO`: badge "Avulso" cinza (variant `secondary`)
  - Senao: se `orgSlug === "contmax"` -> badge "Contmax" com classe azul; se `orgSlug === "pg"` -> badge "P&G" com classe laranja
- Tambem no filtro de origem: ajustar os labels dos SelectItems para refletir o tenant

### 2. `src/components/irpf/IrpfPessoasTable.tsx`
- Adicionar prop `orgSlug: string`
- Mesma logica de badge: source nao-AVULSO mostra nome do tenant, AVULSO mostra "Avulso"

### 3. `src/pages/Irpf.tsx`
- Passar `orgSlug` para ambos os componentes (ja esta disponivel via useParams)

### Detalhes tecnicos

Classes CSS para os badges:
- P&G (laranja): `bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300`
- Contmax (azul): `bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`
- Avulso (cinza): variant `secondary` (ja existente)

Helper para gerar label e classe:
```typescript
function origemBadge(source: string, orgSlug: string) {
  if (source === "AVULSO") return { label: "Avulso", className: "", variant: "secondary" };
  if (orgSlug === "contmax") return { label: "Contmax", className: "bg-blue-100 text-blue-800 ...", variant: undefined };
  return { label: "P&G", className: "bg-orange-100 text-orange-800 ...", variant: undefined };
}
```
