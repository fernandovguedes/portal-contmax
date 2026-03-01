

# Dashboard + Filtros + Exportar Excel no Honorarios Mensal

## Visao Geral

Adicionar ao modulo de Honorarios Mensal:
1. **Cards KPI** acima da tabela: Total Empresas, Total Mes (soma), Total Mes Pago
2. **Filtros** ao lado da busca: Boleto (Sim/Nao/Todos), Emitir NF (Sim/Nao/Todos), Somente pgtos em aberto
3. **Botao Exportar Excel** com os dados filtrados

## Componentes

### 1. Novo componente `src/components/HonorariosDashboard.tsx`

Recebe as empresas ja filtradas pelo mes, o `calcularValores` e `getMesData` do hook. Renderiza 3 cards no estilo ja existente em `DashboardSummary.tsx`:

- **Total Empresas**: quantidade de empresas na lista filtrada
- **Total Mes**: soma de `totalMes` de todas as empresas (formatado em BRL)
- **Total Pago**: soma de `totalMes` das empresas onde `data_pagamento` esta preenchida, com contagem (ex: "R$ 15.230,00 (12 de 25)")

Usa Card/CardHeader/CardContent, icones do lucide (Building2, DollarSign, CheckCircle2), com gradientes e border-l-4 seguindo o padrao visual existente.

### 2. Filtros na pagina `src/pages/Honorarios.tsx`

Adicionar estados:
- `filtroBoleto`: `"todos" | "sim" | "nao"` (default: `"todos"`)
- `filtroNF`: `"todos" | "sim" | "nao"` (default: `"todos"`)
- `somenteAberto`: `boolean` (default: `false`)

Aplicar filtros sobre a lista `filtered` existente:
- **Boleto = Sim**: `!emp.nao_emitir_boleto`
- **Boleto = Nao**: `emp.nao_emitir_boleto`
- **Emitir NF = Sim**: `emp.emitir_nf` nao vazio
- **Emitir NF = Nao**: `emp.emitir_nf` vazio
- **Somente aberto**: `!getMesData(emp, mes).data_pagamento`

UI dos filtros: renderizar ao lado do campo de busca usando `Select` para Boleto e NF, e um `Switch` ou `Checkbox` para "Somente em aberto". Tudo compacto numa linha.

### 3. Botao Exportar Excel

Nova funcao `exportHonorariosExcel` em `src/lib/exportExcel.ts` (ou inline no componente).

Gera uma planilha com as colunas da tabela atual (Razao Social, Fiscal %, Contabil %, Pessoal R$, Valor Fisc+Cont, N Func, Valor Func, Serv. Extras, Total Mes, Boleto, Data Pgto, Emitir NF) usando a lib `xlsx` ja instalada.

Botao com icone `Download` posicionado junto aos filtros/busca.

### 4. Alteracoes em `src/pages/Honorarios.tsx`

- Importar `HonorariosDashboard`
- Adicionar estados dos filtros
- Estender a cadeia de `.filter()` com os novos filtros
- Renderizar `<HonorariosDashboard>` entre os tabs e a tabela
- Renderizar controles de filtro na barra de acoes
- Adicionar botao Exportar Excel

## Detalhes tecnicos

- Os KPIs sao computados sobre a lista **ja filtrada** (mesma lista que alimenta a tabela)
- A exportacao usa `xlsx` (`import * as XLSX from "xlsx"`) ja presente no projeto
- Os filtros Select usam o componente `@/components/ui/select` existente
- O checkbox "Somente em aberto" usa `@/components/ui/checkbox`
- Nenhuma alteracao no banco de dados e necessaria
