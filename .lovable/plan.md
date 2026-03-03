

# Importacao em Massa de Socios para IRPF

## Contexto

A tabela `irpf_people` esta vazia. A view `pg_socios_view` tem:
- **Contmax**: 423 registros (314 CPFs unicos)
- **P&G**: 603 registros (531 CPFs unicos)

Um mesmo socio pode aparecer em varias empresas. A constraint `unique(tenant_id, cpf)` impede duplicatas.

## Solucao

Adicionar um botao **"Importar Socios"** na pagina IRPF (ao lado do botao "Nova Pessoa"). Ao clicar:

1. Mostra um dialog de confirmacao com a contagem de socios que serao importados
2. Executa a importacao via SQL (INSERT ... ON CONFLICT DO NOTHING)
3. Para cada CPF unico, pega o primeiro registro da view (nome, cpf, empresa_id)
4. Cria `irpf_people` com `source = "PG"` ou `"CONTMAX"` conforme o orgSlug
5. **Opcionalmente** cria `irpf_cases` para o ano selecionado (com round-robin de responsavel)
6. Exibe toast com resultado (X pessoas importadas, Y ja existiam)

## Implementacao

### 1. Botao na pagina Irpf.tsx

Adicionar botao "Importar Socios" ao lado de "Nova Pessoa", visivel apenas para quem tem `canEdit`.

### 2. Dialog de confirmacao (IrpfImportarSociosDialog.tsx)

- Ao abrir, consulta `pg_socios_view` filtrada pelo `tenant_id` e conta CPFs unicos que NAO existem em `irpf_people`
- Checkbox: "Criar declaracoes para [ano selecionado]" (marcado por padrao)
- Botao "Importar" com loading state
- Progress feedback durante a importacao

### 3. Logica de importacao (no hook useIrpf.ts)

Nova funcao `bulkImportFromSocios`:

```text
1. Buscar todos os registros de pg_socios_view para o tenant
2. Agrupar por CPF (pegar primeiro registro de cada CPF unico)
3. Para cada CPF unico:
   a. INSERT em irpf_people (ON CONFLICT tenant_id+cpf ignorar)
   b. Se checkbox de criar cases marcado: INSERT em irpf_cases
4. Retornar contagem de criados vs ignorados
```

Como o Supabase JS nao tem ON CONFLICT nativo, a abordagem sera:
- Buscar CPFs ja existentes em irpf_people para o tenant
- Filtrar apenas os novos
- Fazer batch insert dos novos (em lotes de 50)
- Se criar cases, fazer batch insert dos cases

### 4. Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/pages/Irpf.tsx` | Adicionar botao "Importar Socios" e dialog |
| `src/hooks/useIrpf.ts` | Adicionar funcao `bulkImportFromSocios` |
| `src/components/irpf/IrpfImportarSociosDialog.tsx` | **Novo** - dialog de importacao |

## Detalhes Tecnicos

- Importacao em lotes de 50 registros para evitar timeout
- Source definido pelo orgSlug: `pg` -> `"PG"`, `contmax` -> `"CONTMAX"`
- `pg_empresa_id` e `pg_socio_cpf` preenchidos para manter o vinculo com a empresa
- Para socios com multiplas empresas, sera usado o primeiro registro (a pessoa pode estar vinculada a mais de uma empresa, mas na tabela irpf_people so precisa de uma referencia)
- O round-robin de responsavel funciona automaticamente via trigger no banco

