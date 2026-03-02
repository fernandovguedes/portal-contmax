

# Filtro "Sem Nº Questor" -- Mostrar todas empresas do sync

## Decisao

O filtro mostrara todas as empresas vindas do sync (`external_source = 'acessorias'`), independente do numero atual. Isso porque o numero atribuido automaticamente pelo sequencial do banco nao e um numero Questor real.

## Alteracao

### Arquivo: `src/pages/Clientes.tsx`

Uma unica linha -- trocar:

```
const matchesNumero = !semNumeroFilter || e.numero === 0;
```

Para:

```
const matchesNumero = !semNumeroFilter || e.externalSource === 'acessorias';
```

### Resultado esperado

- **P&G**: 511 empresas synced aparecerao no filtro
- **Contmax**: 300 empresas synced aparecerao no filtro (incluindo ACOS NACIONAL com numero 10001)
- Empresas cadastradas manualmente (sem `external_source`) nao aparecerao no filtro

### Nenhuma outra alteracao necessaria

O campo `externalSource` ja existe no tipo `Empresa` e ja e mapeado no hook `useEmpresas`. Apenas 1 linha em 1 arquivo.

