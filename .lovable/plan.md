

# Fix: Permitir digitar valores decimais com virgula nos Servicos Extras

## Problema

Ao digitar um valor como "65,60" no campo de valor dos servicos extras, o componente converte imediatamente a virgula para ponto e faz `parseFloat`, eliminando a virgula antes que o usuario termine de digitar. O campo mostra apenas "65" e nunca permite completar "65,60".

## Solucao

Manter o valor digitado como **string** no estado local durante a edicao, e so converter para numero no momento de **salvar**. Isso permite que o usuario digite livremente "65,60" ou "1.250,00".

### Alteracoes em `src/components/ServicosExtrasPopover.tsx`

1. Mudar `localItems` para usar um tipo intermediario com `valor` como `string` durante a edicao
2. No `handleOpen`, converter os valores numericos para string formatada (ex: `65.6` -> `"65,60"` ou simplesmente o numero como string)
3. No `Input` de valor, usar o valor string diretamente sem conversao
4. No `handleSave` e no calculo do `total`, converter as strings para numero usando `parseFloat(str.replace(",", "."))`

### Detalhes tecnicos

- Criar um tipo local `LocalItem` com `{ descricao: string; valor: string }`
- `handleOpen`: mapear items para `{ descricao, valor: item.valor ? String(item.valor).replace(".", ",") : "" }`
- `updateItem` para campo "valor": apenas gravar a string sem conversao
- `handleSave`: converter `valor` string -> numero antes de chamar `onSave`
- `total`: calcular com `parseFloat(item.valor.replace(",", ".")) || 0`

