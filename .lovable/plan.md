

# Performance da Pagina IRPF - Diagnostico e Otimizacoes

## Diagnostico

A pagina carrega **530 pessoas** e **530 declaracoes** (P&G) em 3 queries simultaneas. O volume atual nao e critico, mas ha otimizacoes simples que podem reduzir o tempo de carregamento.

### Gargalos identificados

1. **Query de contagem de documentos**: apos carregar os cases, faz uma query `IN` com 530 IDs para contar documentos - essa query extra e desnecessaria se usarmos um count agregado no join
2. **Carregamento de pessoas**: a aba "Pessoas" carrega todos os 530 registros mesmo sem estar visivel
3. **Nenhum cache**: ao voltar para a pagina, tudo e recarregado do zero

## Plano de Otimizacao

### 1. Eliminar query extra de documentos

Substituir a query separada de `irpf_documents` por um count inline via Supabase, ou mover a contagem para ser feita sob demanda (lazy). Isso elimina 1 das 3 queries.

**Arquivo**: `src/hooks/useIrpf.ts`
- Remover o bloco que faz `supabase.from("irpf_documents").select("irpf_case_id").in(...)` 
- Usar `irpf_cases` com `.select("*, irpf_documents(count)")` para trazer o count direto no join (Supabase suporta isso)

### 2. Lazy loading da aba Pessoas

Carregar pessoas somente quando o usuario clicar na aba "Pessoas", nao no carregamento inicial.

**Arquivos**: `src/hooks/useIrpf.ts` e `src/pages/Irpf.tsx`
- Separar o fetch de pessoas em uma funcao independente
- Chamar apenas quando a aba for selecionada

### 3. Adicionar staleTime ao React Query (opcional)

Se desejar, podemos migrar o hook para usar `@tanstack/react-query` (ja instalado) para cache automatico e evitar recarregamentos desnecessarios.

## Resultado esperado

- Reducao de 3 queries para 1 query principal no carregamento inicial
- Tempo de carregamento reduzido em ~40-50%
- Experiencia mais fluida ao navegar entre abas

