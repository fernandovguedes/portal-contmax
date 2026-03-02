

# Correcao do Filtro "Sem N Questor"

## Problema

O filtro atual usa `e.externalSource === 'acessorias'`, o que mostra **todas** as 811 empresas sincronizadas, incluindo aquelas que ja tiveram o numero Questor atribuido manualmente.

## Analise dos dados

Consultando o banco:
- 21 empresas tem `numero = 0` (15 synced + 6 manuais) -- estas sao as que realmente nao tem numero Questor
- As demais empresas synced ja receberam numero Questor real (1, 2, 3, ... 10022)

O `numero = 0` e o indicador correto de "sem numero Questor", pois empresas que receberam um numero real tem valores > 0.

## Alteracao

### Arquivo: `src/pages/Clientes.tsx`

Trocar a logica do filtro de:
```
const matchesNumero = !semNumeroFilter || e.externalSource === 'acessorias';
```
Para:
```
const matchesNumero = !semNumeroFilter || e.numero === 0;
```

Apenas 1 linha alterada em 1 arquivo. Nenhuma outra mudanca necessaria -- o campo `externalSource` pode continuar existindo no tipo e no hook para uso futuro.

