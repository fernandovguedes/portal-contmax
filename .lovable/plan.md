
# Modulo IRPF -- Ajuste Multi-Tenant por Organizacao

## Problema Identificado

O plano original tinha um unico modulo "irpf" com um seletor de organizacao no topo da pagina. Isso nao funciona porque:
- Usuarios colaboradores podem ter acesso apenas a PG OU Contmax
- O controle de permissao via `useModulePermissions` precisa de um slug por org (como `clientes-pg` / `clientes-contmax`)
- A rota precisa incluir o slug da org para que o sistema saiba de qual tenant estamos falando

## Solucao

Seguir o mesmo padrao de Clientes:
- Rota: `/irpf/:orgSlug` (ex: `/irpf/pg`, `/irpf/contmax`)
- Modulos separados: `irpf-pg` e `irpf-contmax` na tabela `modules`
- Permissao: `useModulePermissions(`irpf-${orgSlug}`)`
- Cada pessoa/case filtrado por `tenant_id` resolvido a partir do slug da URL

## Alteracoes em Relacao ao Plano Anterior

### 1. Dados: Criar modulos irpf-pg e irpf-contmax

Inserir na tabela `modules`:
- `irpf-pg` (nome: "IRPF P&G", organizacao_id: P&G uuid, icone: FileText, ativo: true)
- `irpf-contmax` (nome: "IRPF Contmax", organizacao_id: Contmax uuid, icone: FileText, ativo: true)

Atualizar ou desativar o modulo "irpf" generico existente (slug `irpf`).

### 2. Roteamento

No `App.tsx`:
- `/irpf/:orgSlug` -- pagina principal (lista declaracoes/pessoas)
- `/irpf/:orgSlug/:caseId` -- detalhe da declaracao

No `Portal.tsx` (MODULE_ROUTES):
- `"irpf-pg": "/irpf/pg"`
- `"irpf-contmax": "/irpf/contmax"`

### 3. Pagina principal (src/pages/Irpf.tsx)

- Extrair `orgSlug` da URL via `useParams`
- Resolver `tenant_id` a partir do slug (query `organizacoes` por slug, mesmo padrao de Clientes.tsx)
- Usar `useModulePermissions(`irpf-${orgSlug}`)` para controle de edicao
- **Remover** o seletor de organizacao do topo (a org ja vem da URL)
- Manter seletor de ano-base

### 4. Dialog "Nova Pessoa"

- Tab "Cliente P&G" so aparece se `orgSlug === 'pg'` (busca pg_socios_view filtrada pelo tenant)
- Tab "Cliente Contmax" so aparece se `orgSlug === 'contmax'` (busca empresas da Contmax)
- Tab "Avulso" sempre disponivel
- Ao criar pessoa, `tenant_id` vem do org resolvido pela URL

### 5. Hooks (useIrpf, useIrpfDocuments)

- Recebem `tenantId` (resolvido pela pagina a partir do slug)
- Todas as queries filtram por `tenant_id`

### 6. RLS

As policies existentes ja usam `tenant_id` nas tabelas `irpf_cases`, `irpf_people` e `irpf_documents`. As policies de modulo precisam ser atualizadas para aceitar os novos slugs `irpf-pg` e `irpf-contmax` alem de `irpf`:

```sql
-- Atualizar policies de INSERT/UPDATE/DELETE para aceitar os 3 slugs
has_module_edit_access(auth.uid(), 'irpf') 
OR has_module_edit_access(auth.uid(), 'irpf-pg')
OR has_module_edit_access(auth.uid(), 'irpf-contmax')
```

Mesma logica para `has_module_access` nas policies de SELECT/INSERT.

### 7. Storage bucket

Manter o plano original: bucket `irpf-docs` privado, path `tenant/{tenant_id}/case/{case_id}/{doc_type}/{uuid}.{ext}`. As storage policies tambem precisam aceitar os 3 slugs.

## Estrutura de Arquivos (mesma do plano anterior)

```text
src/
  types/irpf.ts
  hooks/useIrpf.ts
  hooks/useIrpfDocuments.ts
  pages/Irpf.tsx                         -- recebe orgSlug da URL
  pages/IrpfDetalhe.tsx                  -- recebe orgSlug + caseId da URL
  components/irpf/
    IrpfDashboardCards.tsx
    IrpfDeclaracoesTable.tsx
    IrpfPessoasTable.tsx
    IrpfNovaPessoaDialog.tsx
    IrpfDocumentChecklist.tsx
    IrpfDependentesEditor.tsx
    IrpfInformacoesContribuinte.tsx
```

## Arquivos Modificados

1. `src/App.tsx` -- rotas `/irpf/:orgSlug` e `/irpf/:orgSlug/:caseId`
2. `src/pages/Portal.tsx` -- MODULE_ROUTES com `irpf-pg` e `irpf-contmax`

## Migracoes SQL

1. Criar bucket `irpf-docs` + storage policies (aceitar slugs irpf, irpf-pg, irpf-contmax)
2. Atualizar RLS policies de irpf_cases, irpf_people, irpf_documents para aceitar os novos slugs

## Dados (via insert tool)

1. Inserir modulos `irpf-pg` e `irpf-contmax` na tabela `modules`
2. Desativar modulo `irpf` generico

## Ordem de Implementacao

1. SQL: bucket storage + atualizar RLS policies
2. Dados: inserir modulos irpf-pg/irpf-contmax
3. Tipos TypeScript
4. Hooks
5. Componentes
6. Paginas
7. Roteamento (App.tsx, Portal.tsx)

## Resumo da Diferenca vs Plano Anterior

| Aspecto | Plano anterior | Plano atualizado |
|---|---|---|
| Rota | `/irpf` | `/irpf/:orgSlug` |
| Modulo | 1 (`irpf`) | 2 (`irpf-pg`, `irpf-contmax`) |
| Seletor org | Dropdown no topo | Vem da URL |
| Permissao | `useModulePermissions("irpf")` | `useModulePermissions(`irpf-${orgSlug}`)` |
| Visibilidade | Todos veem tudo | Colaborador ve so seu org |
| Tab "Nova Pessoa" PG | Sempre visivel | So se orgSlug === 'pg' |
