

# Filtro "Sem Numero Questor" no modulo Clientes

## Objetivo

Adicionar um filtro checkbox nos modulos Clientes P&G e Contmax para buscar empresas que nao tem o numero do Questor preenchido.

## Alteracoes

### Arquivo: `src/pages/Clientes.tsx`

Como ambas as organizacoes (P&G e Contmax) usam o mesmo componente `Clientes.tsx` (diferenciado pelo parametro `orgSlug`), basta uma unica alteracao neste arquivo.

1. **Novo estado**: adicionar `semNumeroQuestorFilter` (boolean, default `false`)
2. **Logica de filtro**: quando ativo, mostrar apenas empresas onde `e.numero` e falsy (0, null, undefined)
3. **UI**: adicionar um checkbox/label ao lado dos filtros existentes (regime, busca, data), seguindo o mesmo padrao visual dos filtros do modulo fiscal -- um `Checkbox` com icone e texto dentro de um label estilizado
4. **Reset de pagina**: incluir o novo filtro no `useEffect` que reseta a paginacao

### Detalhes tecnicos

Estado:
```
const [semNumeroFilter, setSemNumeroFilter] = useState(false);
```

Filtro adicionado ao `filtered`:
```
const matchesNumero = !semNumeroFilter || !e.numero;
return matchesSearch && matchesRegime && matchesDataCadastro && matchesNumero;
```

UI (inserida na barra de filtros, antes do Select de regime):
```
<label className="flex items-center gap-1.5 text-sm cursor-pointer border rounded-md px-3 py-1.5 bg-card hover:bg-muted/50 transition-colors">
  <Checkbox checked={semNumeroFilter} onCheckedChange={(v) => setSemNumeroFilter(!!v)} />
  <FileX className="h-3.5 w-3.5 text-muted-foreground" />
  <span className="text-muted-foreground">Sem N Questor</span>
</label>
```

Nenhuma alteracao no banco de dados e necessaria.

### Nota sobre os erros de build

Os erros de build listados sao todos em edge functions (`sync-acessorias`, `sync-onecode-contacts`) e nao estao relacionados a esta alteracao. Eles existem por incompatibilidade de tipos do Supabase client nessas funcoes e serao tratados separadamente.

