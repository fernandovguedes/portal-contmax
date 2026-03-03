import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { IrpfCase, IrpfStatus } from "@/types/irpf";
import { STATUS_CONFIG, RESPONSAVEIS } from "@/types/irpf";

interface Props {
  cases: IrpfCase[];
  docCounts: Record<string, number>;
  canEdit: boolean;
  orgSlug: string;
  onInlineUpdate: (caseId: string, field: string, value: any) => void;
}

const PAGE_SIZE = 30;

export function IrpfDeclaracoesTable({ cases, docCounts, canEdit, orgSlug, onInlineUpdate }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [origemFilter, setOrigemFilter] = useState<string>("todos");
  const [responsavelFilter, setResponsavelFilter] = useState<string>("todos");
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [search, statusFilter, origemFilter, responsavelFilter]);

  const filtered = cases.filter(c => {
    const matchSearch = !search || 
      (c.personNome?.toLowerCase().includes(search.toLowerCase())) ||
      (c.personCpf?.includes(search));
    const matchStatus = statusFilter === "todos" || c.status === statusFilter;
    const matchOrigem = origemFilter === "todos" || c.personSource === origemFilter;
    const matchResp = responsavelFilter === "todos" || c.responsavel === responsavelFilter;
    return matchSearch && matchStatus && matchOrigem && matchResp;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar nome ou CPF..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={origemFilter} onValueChange={setOrigemFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas Origens</SelectItem>
            <SelectItem value="PG">P&G</SelectItem>
            <SelectItem value="AVULSO">Avulso</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {RESPONSAVEIS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto shadow-sm table-zebra">
        <Table>
          <TableHeader>
            <TableRow className="header-gradient text-primary-foreground hover:bg-transparent [&>th]:text-primary-foreground/90 [&>th]:font-semibold">
              <TableHead>Nome</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead className="w-20">Origem</TableHead>
              <TableHead className="w-28">Responsável</TableHead>
              <TableHead className="w-28">Valor</TableHead>
              <TableHead className="w-28">Data Pgto</TableHead>
              <TableHead className="w-36">Status</TableHead>
              <TableHead className="w-16 text-center">Docs</TableHead>
              <TableHead className="w-16">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  Nenhuma declaração encontrada.
                </TableCell>
              </TableRow>
            )}
            {paginated.map(c => {
              const sc = STATUS_CONFIG[c.status];
              const dc = docCounts[c.id] || 0;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.personNome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.personCpf}</TableCell>
                  <TableCell>
                    <Badge variant={c.personSource === "PG" ? "default" : "secondary"} className="text-[10px]">
                      {c.personSource === "PG" ? "P&G" : "Avulso"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Select value={c.responsavel} onValueChange={v => onInlineUpdate(c.id, "responsavel", v)}>
                        <SelectTrigger className="h-7 text-xs w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RESPONSAVEIS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : <span className="text-sm">{c.responsavel}</span>}
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Input
                        className="h-7 text-xs w-24"
                        defaultValue={c.valorCobrado || ""}
                        onBlur={e => {
                          const v = parseFloat(e.target.value) || 0;
                          if (v !== c.valorCobrado) onInlineUpdate(c.id, "valorCobrado", v);
                        }}
                        placeholder="R$"
                      />
                    ) : <span className="text-sm">R$ {c.valorCobrado?.toFixed(2) || "0,00"}</span>}
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Input
                        className="h-7 text-xs w-24"
                        defaultValue={c.dataPagamento || ""}
                        onBlur={e => {
                          if (e.target.value !== (c.dataPagamento || "")) onInlineUpdate(c.id, "dataPagamento", e.target.value);
                        }}
                        placeholder="dd/mm/aaaa"
                      />
                    ) : <span className="text-sm">{c.dataPagamento || "—"}</span>}
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Select value={c.status} onValueChange={v => onInlineUpdate(c.id, "status", v)}>
                        <SelectTrigger className="h-7 text-xs w-full">
                          <Badge className={`${sc.className} text-[10px]`}>{sc.label}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              <Badge className={`${v.className} text-[10px]`}>{v.label}</Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : <Badge className={`${sc.className} text-[10px]`}>{sc.label}</Badge>}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs">{dc}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/irpf/${orgSlug}/${c.id}`)}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-3">
          <span className="text-sm text-muted-foreground">{filtered.length} declarações · Página {safePage} de {totalPages}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}>
              Próxima <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
