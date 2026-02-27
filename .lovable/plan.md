
## Diagnosticar e Corrigir Sincronizacao Acessorias

### Problema Identificado

Analisei os dados e encontrei uma situacao contraditoria:

- **Ultima sync PG**: leu 4.780 registros da API, reportou TODOS como "ignorados" (skipped), 0 criados, 0 atualizados
- **Ultima sync Contmax**: leu 108.580 registros, mesma situacao - 0 criados, 0 atualizados
- **No banco**: as 519 empresas PG e 301 Contmax NAO possuem `hash_payload`, `synced_at` ou `external_source` - comprovando que o sync nunca modificou nenhum registro

Isso indica que o sync esta lendo dados da API mas nao esta criando nem atualizando registros no banco. O problema pode estar na logica de matching por CNPJ (formato diferente entre API e banco) ou na resposta da API.

### Plano de Acao

**1. Adicionar logging diagnostico detalhado na edge function `sync-acessorias`**

Na funcao `processBatch`, adicionar `console.log` nos primeiros 3 registros de cada batch para registrar:
- O CNPJ bruto vindo da API (`rawKey`)
- O CNPJ formatado (`formattedKey`)
- Se encontrou registro existente ou nao (`existing`)
- Se o hash eh diferente ou igual
- Se fez insert, update ou skip

Isso vai revelar exatamente onde o fluxo esta falhando.

**2. Corrigir potencial problema de matching de CNPJ**

Possivel causa: se a API retorna CNPJ em formato que nao resulta em 11 ou 14 digitos, o `formatCnpj` retorna o valor bruto, que pode nao bater com o formato armazenado no banco (ex: "59.220.274/0001-39").

A correcao sera normalizar o CNPJ para comparacao:
- Sempre comparar por digitos puros (sem pontuacao)
- Ou garantir que o formato seja consistente antes da query

**3. Investigar volume de dados da API**

Contmax com 108.580 registros eh um numero muito alto (301 empresas no banco). Isso sugere que:
- A API pode estar retornando dados duplicados em paginas diferentes
- Ou o endpoint `/companies/ListAll` retorna entidades que nao sao empresas

Adicionar log do `totalPages` retornado pela API e do tamanho do array por pagina.

**4. Executar sync de teste e analisar logs**

Apos o deploy da funcao com logs diagnosticos:
- Executar sync para PG
- Analisar os logs para entender o formato real dos dados da API
- Corrigir a logica de matching/insert conforme necessario

### Detalhes Tecnicos

**Arquivo:** `supabase/functions/sync-acessorias/index.ts`

Mudancas principais:
- Adicionar `console.log` nos 3 primeiros registros de cada batch com detalhes do rawKey, formattedKey, existing result
- Normalizar CNPJ para formato consistente antes da query (usar apenas digitos para busca e armazenar formatado)
- Adicionar log da resposta raw da API (primeiros registros + metadata de paginacao)
- Considerar alterar a query de busca para usar `external_key` (digitos puros) alem do `cnpj` formatado

**Nenhuma alteracao no banco** sera necessaria nesta etapa - o foco eh diagnosticar e corrigir a logica da edge function.
