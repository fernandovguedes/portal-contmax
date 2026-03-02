

# Filtro "Sem Numero Questor" - Correcao

## Problema

O campo `numero` na tabela `empresas` tem `DEFAULT nextval('empresas_numero_seq')`, ou seja, toda empresa criada via sync recebe automaticamente um numero sequencial. O filtro atual (`!e.numero`) nunca encontra resultados porque nenhuma empresa tem `numero` vazio.

## Abordagem

Empresas vindas do sync (`external_source = 'acessorias'`) nunca tiveram o numero do Questor atribuido manualmente -- o numero que possuem e apenas o auto-incremento do banco. Portanto, o filtro "Sem N Questor" deve identificar essas empresas.

## Alteracoes

### 1. Tipo `Empresa` em `src/types/fiscal.ts`

Adicionar campo opcional:
```
externalSource?: string;
```

### 2. Hook `src/hooks/useEmpresas.ts`

- Incluir `external_source` na constante `COLUMNS` da query
- Mapear `external_source` para `externalSource` no `rowToEmpresa`

### 3. Filtro em `src/pages/Clientes.tsx`

Trocar a logica do filtro de:
```
const matchesNumero = !semNumeroFilter || !e.numero;
```
Para:
```
const matchesNumero = !semNumeroFilter || e.externalSource === 'acessorias';
```

Isso mostra apenas empresas que vieram do sync (que nunca tiveram numero Questor real atribuido).

### Resumo

- Nenhuma alteracao no banco de dados
- 3 arquivos editados: `types/fiscal.ts`, `hooks/useEmpresas.ts`, `pages/Clientes.tsx`
- Logica simples: empresa synced = sem numero Questor real
