import { useState, useCallback, useEffect } from "react";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { Empresa, RegimeTributario, Socio } from "@/types/fiscal";
import { supabase } from "@/integrations/supabase/client";
import { EmpresaFormDialog } from "@/components/EmpresaFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Search, Filter, Pencil, Trash2, Archive, RotateCcw, FileText, FileX, CalendarIcon, Users, Building2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { exportClientesToExcel } from "@/lib/exportExcel";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppHeader } from "@/components/AppHeader";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { SyncPanel } from "@/components/SyncPanel";
import { useUserRole } from "@/hooks/useUserRole";

export default function Clientes() {
  const navigate = useNavigate();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { canEdit } = useModulePermissions(`clientes-${orgSlug}`);

  const [orgInfo, setOrgInfo] = useState<{ id: string; nome: string } | null>(null);
  useEffect(() => {
    if (!orgSlug) return;
    supabase
      .from("organizacoes")
      .select("id, nome")
      .eq("slug", orgSlug)
      .single()
      .then(({ data }) => {
        if (data) setOrgInfo(data);
      });
  }, [orgSlug]);

  const { empresas, loading, refetch, addEmpresa, updateEmpresa, deleteEmpresa, baixarEmpresa, reativarEmpresa } = useEmpresas(orgInfo?.id);
  const { isAdmin } = useUserRole();

  const [search, setSearch] = useState("");
  const [regimeFilter, setRegimeFilter] = useState<RegimeTributario | "todos">("todos");
  const [dataCadastroInicio, setDataCadastroInicio] = useState<Date | undefined>();
  const [dataCadastroFim, setDataCadastroFim] = useState<Date | undefined>();
  const [dataCadastroAplicado, setDataCadastroAplicado] = useState<{ inicio?: Date; fim?: Date } | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; nome: string }>({ open: false, id: "", nome: "" });
  const [baixaDialog, setBaixaDialog] = useState<{ open: boolean; empresa: Empresa | null }>({ open: false, empresa: null });
  const [baixaDate, setBaixaDate] = useState<Date>(new Date());

  const filtered = empresas.filter((e) => {
    const matchesSearch = e.nome.toLowerCase().includes(search.toLowerCase()) || e.cnpj.includes(search);
    const matchesRegime = regimeFilter === "todos" || e.regimeTributario === regimeFilter;

    let matchesDataCadastro = true;
    if (dataCadastroAplicado) {
      const dc = e.dataCadastro;
      if (dataCadastroAplicado.inicio) {
        matchesDataCadastro = dc >= format(dataCadastroAplicado.inicio, "yyyy-MM-dd");
      }
      if (matchesDataCadastro && dataCadastroAplicado.fim) {
        const nextDay = new Date(dataCadastroAplicado.fim);
        nextDay.setDate(nextDay.getDate() + 1);
        matchesDataCadastro = dc < format(nextDay, "yyyy-MM-dd");
      }
    }

    return matchesSearch && matchesRegime && matchesDataCadastro;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(page, totalPages);
  const paginatedEmpresas = filtered.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, regimeFilter, dataCadastroAplicado]);
  

  // Keep selectedEmpresa in sync with empresas state
  useEffect(() => {
    if (selectedEmpresa) {
      const updated = empresas.find((e) => e.id === selectedEmpresa.id);
      if (updated) setSelectedEmpresa(updated);
      else setSelectedEmpresa(null);
    }
  }, [empresas]);

  const handleEdit = useCallback((empresa: Empresa) => {
    setSelectedEmpresa(null);
    setEditingEmpresa(empresa);
    setFormOpen(true);
  }, []);

  const handleNew = useCallback(() => {
    setEditingEmpresa(null);
    setFormOpen(true);
  }, []);

  if (loading || !orgInfo) {
    return <LoadingSkeleton variant="portal" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={`Clientes ${orgInfo.nome}`}
        subtitle={`Gerenciamento da base de clientes ${orgInfo.nome}`}
        showBack
        showLogout
        breadcrumbs={[{ label: "Portal", href: "/" }, { label: `Clientes ${orgInfo.nome}` }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => exportClientesToExcel(filtered, orgInfo.nome)}
            >
              <Download className="mr-1 h-4 w-4" /> Exportar Excel
            </Button>
            {canEdit && (
              <Button
                onClick={handleNew}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Plus className="mr-1 h-4 w-4" /> Nova Empresa
              </Button>
            )}
          </div>
        }
      />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {isAdmin && orgSlug && orgInfo && (
          <SyncPanel tenantSlug={orgSlug} tenantId={orgInfo.id} onSyncComplete={refetch} />
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={regimeFilter} onValueChange={(v) => setRegimeFilter(v as RegimeTributario | "todos")}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Regime" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Regimes</SelectItem>
              <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
              <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
              <SelectItem value="lucro_real">Lucro Real</SelectItem>
              <SelectItem value="mei">MEI</SelectItem>
              <SelectItem value="imunidade_tributaria">Imunidade Tributária</SelectItem>
              <SelectItem value="pessoa_fisica">Pessoa Física</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {/* Date range filter */}
          <span className="text-sm text-muted-foreground font-medium">Cadastro:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left font-normal", !dataCadastroInicio && "text-muted-foreground")}>
                <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                {dataCadastroInicio ? format(dataCadastroInicio, "dd/MM/yyyy") : "Data inicial"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dataCadastroInicio} onSelect={setDataCadastroInicio} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left font-normal", !dataCadastroFim && "text-muted-foreground")}>
                <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                {dataCadastroFim ? format(dataCadastroFim, "dd/MM/yyyy") : "Data final"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dataCadastroFim} onSelect={setDataCadastroFim} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="secondary" onClick={() => { if (dataCadastroInicio || dataCadastroFim) setDataCadastroAplicado({ inicio: dataCadastroInicio, fim: dataCadastroFim }); }} disabled={!dataCadastroInicio && !dataCadastroFim}>
            Aplicar
          </Button>
          {dataCadastroAplicado && (
            <Button size="sm" variant="ghost" onClick={() => { setDataCadastroAplicado(null); setDataCadastroInicio(undefined); setDataCadastroFim(undefined); }}>
              Limpar
            </Button>
          )}
        </div>

        {dataCadastroAplicado && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Filtro ativo:</span>
            <span className="bg-muted rounded px-2 py-0.5">
              Cadastro: {dataCadastroAplicado.inicio ? format(dataCadastroAplicado.inicio, "dd/MM/yyyy") : "∞"} — {dataCadastroAplicado.fim ? format(dataCadastroAplicado.fim, "dd/MM/yyyy") : "∞"}
            </span>
          </div>
        )}

        <div className="rounded-xl border bg-card overflow-x-auto shadow-sm table-zebra">
          <Table>
            <TableHeader>
              <TableRow className="header-gradient text-primary-foreground hover:bg-transparent [&>th]:text-primary-foreground/90 [&>th]:font-semibold">
                <TableHead className="w-12">Nº</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead className="w-20 text-center">Regime</TableHead>
                <TableHead className="w-10 text-center">NF</TableHead>
                <TableHead>Início Competência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEmpresas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Nenhuma empresa encontrada.
                  </TableCell>
                </TableRow>
              )}
              {paginatedEmpresas.map((empresa) => (
                <TableRow key={empresa.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedEmpresa(empresa)}>
                  <TableCell className="font-medium">{empresa.numero}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-primary underline-offset-2 hover:underline", empresa.dataBaixa && "text-destructive")}>
                        {empresa.nome}
                      </span>
                      {empresa.dataBaixa && (
                        <Badge variant="destructive" className="text-[9px] px-1.5 whitespace-nowrap">
                          BAIXADA EM {format(new Date(empresa.dataBaixa), "dd/MM/yyyy")}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{empresa.cnpj}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={empresa.regimeTributario === "simples_nacional" ? "secondary" : "outline"} className="text-[10px] px-1.5">
                      {({ simples_nacional: "SN", lucro_presumido: "LP", lucro_real: "LR", mei: "MEI", imunidade_tributaria: "IT", pessoa_fisica: "PF" } as Record<string, string>)[empresa.regimeTributario] ?? empresa.regimeTributario}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          {empresa.emiteNotaFiscal ? (
                            <FileText className="h-4 w-4 text-success mx-auto" />
                          ) : (
                            <FileX className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          {empresa.emiteNotaFiscal ? "Emite NF" : "Não emite NF"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-sm">{empresa.inicioCompetencia || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2 py-3">
            <span className="text-sm text-muted-foreground">
              {filtered.length} empresas · Página {safeCurrentPage} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safeCurrentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Detail Sheet - opens on company name click */}
      <Sheet open={!!selectedEmpresa} onOpenChange={(open) => { if (!open) setSelectedEmpresa(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedEmpresa && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {selectedEmpresa.nome}
                </SheetTitle>
                <SheetDescription>
                  {selectedEmpresa.cnpj}
                  {selectedEmpresa.dataBaixa && (
                    <Badge variant="destructive" className="ml-2 text-[9px] px-1.5">
                      BAIXADA EM {format(new Date(selectedEmpresa.dataBaixa), "dd/MM/yyyy")}
                    </Badge>
                  )}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Company Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados da Empresa</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nº Questor</span>
                      <p className="font-medium">{selectedEmpresa.numero}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Regime</span>
                      <p className="font-medium">{({ simples_nacional: "Simples Nacional", lucro_presumido: "Lucro Presumido", lucro_real: "Lucro Real", mei: "MEI", imunidade_tributaria: "Imunidade Tributária", pessoa_fisica: "Pessoa Física" } as Record<string, string>)[selectedEmpresa.regimeTributario] ?? selectedEmpresa.regimeTributario}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Emite NF</span>
                      <p className="font-medium">{selectedEmpresa.emiteNotaFiscal ? "Sim" : "Não"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Início Competência</span>
                      <p className="font-medium">{selectedEmpresa.inicioCompetencia || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">WhatsApp</span>
                      {selectedEmpresa.whatsapp ? (
                        <a href={`https://wa.me/${selectedEmpresa.whatsapp}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline block">
                          {selectedEmpresa.whatsapp}
                        </a>
                      ) : (
                        <p className="font-medium">—</p>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Sócios */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Sócios ({selectedEmpresa.socios?.length || 0})
                  </h3>
                  {(!selectedEmpresa.socios || selectedEmpresa.socios.length === 0) ? (
                    <p className="text-sm text-muted-foreground">Nenhum sócio cadastrado.</p>
                  ) : (
                    <div className="space-y-2">
                      {(selectedEmpresa.socios as Socio[]).map((socio, i) => (
                        <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                          <div>
                            <p className="font-medium">{socio.nome || "Sem nome"}</p>
                            {socio.cpf && <p className="text-xs text-muted-foreground">{socio.cpf}</p>}
                          </div>
                          <Badge variant="secondary" className="text-xs">{socio.percentual}%</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Actions */}
                {canEdit && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ações</h3>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" className="justify-start" onClick={() => handleEdit(selectedEmpresa)}>
                      <Pencil className="mr-2 h-4 w-4" /> Editar Empresa
                    </Button>
                    {selectedEmpresa.dataBaixa ? (
                      <Button variant="outline" className="justify-start text-success hover:text-success" onClick={() => {
                        reativarEmpresa(selectedEmpresa.id);
                      }}>
                        <RotateCcw className="mr-2 h-4 w-4" /> Reativar Empresa
                      </Button>
                    ) : (
                      <Button variant="outline" className="justify-start text-warning hover:text-warning" onClick={() => {
                        setBaixaDate(new Date());
                        setBaixaDialog({ open: true, empresa: selectedEmpresa });
                      }}>
                        <Archive className="mr-2 h-4 w-4" /> Baixar Empresa
                      </Button>
                    )}
                    <Button variant="outline" className="justify-start text-destructive hover:text-destructive" onClick={() => {
                      setDeleteConfirm({ open: true, id: selectedEmpresa.id, nome: selectedEmpresa.nome });
                    }}>
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir Empresa
                    </Button>
                  </div>
                </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm((prev) => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa <strong>{deleteConfirm.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteEmpresa(deleteConfirm.id);
                setDeleteConfirm({ open: false, id: "", nome: "" });
                setSelectedEmpresa(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EmpresaFormDialog
        key={editingEmpresa?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        empresa={editingEmpresa}
        onSave={addEmpresa}
        onUpdate={updateEmpresa}
      />

      <Dialog open={baixaDialog.open} onOpenChange={(open) => setBaixaDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Baixar Empresa</DialogTitle>
            <DialogDescription>
              Confirme a data de encerramento da empresa <strong>{baixaDialog.empresa?.nome}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Data da Baixa</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !baixaDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {baixaDate ? format(baixaDate, "dd/MM/yyyy") : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={baixaDate} onSelect={(d) => d && setBaixaDate(d)} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBaixaDialog({ open: false, empresa: null })}>Cancelar</Button>
            <Button variant="destructive" onClick={() => {
              if (baixaDialog.empresa) {
                baixarEmpresa(baixaDialog.empresa.id, format(baixaDate, "yyyy-MM-dd"));
                setBaixaDialog({ open: false, empresa: null });
              }
            }}>
              Confirmar Baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
