

# Ajustes no Modulo IRPF

## 1. Remover coluna "Responsavel" do IRPF Contmax

A tabela de declaracoes e o detalhe do IRPF Contmax nao terao a coluna/campo "Responsavel". Para isso:

**Arquivo: `src/components/irpf/IrpfDeclaracoesTable.tsx`**
- Receber prop `showResponsavel` (default `true`)
- Quando `false`, esconder a coluna "Responsavel" na tabela e o filtro de responsavel

**Arquivo: `src/pages/Irpf.tsx`**
- Passar `showResponsavel={orgSlug !== "contmax"}` para o componente

**Arquivo: `src/pages/IrpfDetalhe.tsx`**
- Condicionar a exibicao do campo "Responsavel" ao orgSlug (esconder para contmax)

## 2. Redistribuir responsaveis nas declaracoes P&G

Atualmente no P&G: 519 atribuidas a Pedro e 12 a Grazi (531 total). Precisam ficar divididas igualitariamente (~265/266).

**Acao via SQL (usando insert tool)**:
- Ordenar todos os 531 cases de P&G por `created_at`
- Atribuir alternadamente: registros impares para Grazi, pares para Pedro (ou vice-versa)
- Resultado: ~265 Grazi, ~266 Pedro

```sql
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM irpf_cases
  WHERE tenant_id = '30e6da4c-ed58-47ce-8a83-289b58ca15ab'
)
UPDATE irpf_cases SET responsavel = CASE 
  WHEN (SELECT rn FROM numbered WHERE numbered.id = irpf_cases.id) % 2 = 1 THEN 'Grazi'
  ELSE 'Pedro'
END
WHERE tenant_id = '30e6da4c-ed58-47ce-8a83-289b58ca15ab';
```

## Resumo de arquivos

| Arquivo | Alteracao |
|---|---|
| `src/components/irpf/IrpfDeclaracoesTable.tsx` | Prop `showResponsavel`, esconder coluna e filtro |
| `src/pages/Irpf.tsx` | Passar prop baseada no orgSlug |
| `src/pages/IrpfDetalhe.tsx` | Esconder campo responsavel para contmax |
| SQL (insert tool) | Redistribuir responsaveis no P&G |

