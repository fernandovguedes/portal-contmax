import { useState, useCallback, useEffect } from "react";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useWhatsAppLogs } from "@/hooks/useWhatsAppLogs";
import { getCompetenciaAtual } from "@/lib/formatUtils";
import { Empresa, MesKey, MES_LABELS, StatusEntrega, StatusExtrato, RegimeTributario } from "@/types/fiscal";
import { filtrarEmpresasVisiveis } from "@/lib/empresaUtils";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSummary } from "@/components/DashboardSummary";
import { EmpresaTable } from "@/components/EmpresaTable";
import { FaturamentoFormDialog } from "@/components/FaturamentoFormDialog";
import { WhatsAppConfirmDialog } from "@/components/WhatsAppConfirmDialog";
import { WhatsAppBatchBar } from "@/components/WhatsAppBatchBar";
import { WhatsAppBatchConfirmDialog } from "@/components/WhatsAppBatchConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Download, AlertTriangle, FileText, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import {
  isMesFechamentoTrimestre,
  calcularFaturamentoTrimestre,
  isMesDctfPosFechamento,
  getTrimestreFechamentoAnterior,
} from "@/types/fiscal";
import { exportToExcel } from "@/lib/exportExcel";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { AppHeader } from "@/components/AppHeader";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const { canEdit } = useModulePermissions("controle-fiscal");
  const { toast } = useToast();

  const [organizacaoId, setOrganizacaoId] = useState<string | undefined>();
  useEffect(() => {
    supabase
      .from("modules")
      .select("organizacao_id")
      .eq("slug", "controle-fiscal")
      .single()
      .then(({ data }) => {
        if (data?.organizacao_id) setOrganizacaoId(data.organizacao_id);
      });
  }, []);

  const { empresas, loading, updateEmpresa } = useEmpresas(organizacaoId);
  const [mesSelecionado, setMesSelecionado] = useState<MesKey>("janeiro");
  const competencia = getCompetenciaAtual(mesSelecionado);
  const { logsMap: whatsappLogs, invalidate: invalidateWhatsAppLogs } = useWhatsAppLogs(competencia);
  const [search, setSearch] = useState("");
  const [regimeFilter, setRegimeFilter] = useState<RegimeTributario | "todos">("todos");
  const [reinfFilter, setReinfFilter] = useState(false);
  const [nfFilter, setNfFilter] = useState(false);
  const [exteriorFilter, setExteriorFilter] = useState(false);
  const [alugueisFilter, setAlugueisFilter] = useState(false);
  const [dctfSmFilter, setDctfSmFilter] = useState(false);
  const [questorFilter, setQuestorFilter] = useState(false);
  const [extratoPendenteFilter, setExtratoPendenteFilter] = useState(false);
  const [faturamentoEmpresa, setFaturamentoEmpresa] = useState<Empresa | null>(null);
  const [whatsappEmpresa, setWhatsappEmpresa] = useState<Empresa | null>(null);
  const [whatsappIsResend, setWhatsappIsResend] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);

  // Clear selection when month changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [mesSelecionado]);

  const isFechamento = isMesFechamentoTrimestre(mesSelecionado);
  const isDctfPos = isMesDctfPosFechamento(mesSelecionado);
  const trimestreAnterior = getTrimestreFechamentoAnterior(mesSelecionado);

  const visibleEmpresas = filtrarEmpresasVisiveis(empresas, mesSelecionado);

  const filtered = visibleEmpresas.filter((e) => {
    const matchesSearch = e.nome.toLowerCase().includes(search.toLowerCase()) || e.cnpj.includes(search);
    const matchesRegime = regimeFilter === "todos" || e.regimeTributario === regimeFilter;

    let matchesReinf = true;
    if (reinfFilter && isFechamento) {
      const fatTrimestre = calcularFaturamentoTrimestre(e, mesSelecionado);
      matchesReinf = fatTrimestre > 0;
    }

    let matchesNfExterior = true;
    if (nfFilter || exteriorFilter || alugueisFilter) {
      const dados = e.meses[mesSelecionado];
      const passNf = !nfFilter || dados.faturamentoNotaFiscal > 0;
      const passExt = !exteriorFilter || dados.faturamentoExterior > 0;
      const passAlug = !alugueisFilter || (dados.faturamentoAlugueis || 0) > 0;
      matchesNfExterior = passNf && passExt && passAlug;
    }

    let matchesDctfSm = true;
    if (dctfSmFilter && isDctfPos && trimestreAnterior) {
      const fatTrimAnterior = calcularFaturamentoTrimestre(e, trimestreAnterior);
      matchesDctfSm = fatTrimAnterior > 0;
    }

    let matchesQuestor = true;
    if (questorFilter) {
      const dados = e.meses[mesSelecionado];
      matchesQuestor = dados.lancadoQuestor === "pendente";
    }

    let matchesExtratoPendente = true;
    if (extratoPendenteFilter) {
      const dados = e.meses[mesSelecionado];
      matchesExtratoPendente = dados.extratoEnviado === "nao";
    }

    return (
      matchesSearch &&
      matchesRegime &&
      matchesReinf &&
      matchesNfExterior &&
      matchesDctfSm &&
      matchesQuestor &&
      matchesExtratoPendente
    );
  });

  const handleFaturamento = useCallback((empresa: Empresa) => {
    setFaturamentoEmpresa(empresa);
  }, []);

  const handleStatusChange = useCallback(
    (empresaId: string, mes: MesKey, campo: keyof Empresa["obrigacoes"]["marco"], valor: StatusEntrega) => {
      const empresa = empresas.find((e) => e.id === empresaId);
      if (!empresa) return;
      updateEmpresa(empresaId, {
        obrigacoes: {
          ...empresa.obrigacoes,
          [mes]: { ...empresa.obrigacoes[mes], [campo]: valor },
        },
      });
    },
    [empresas, updateEmpresa],
  );

  const handleExtratoChange = useCallback(
    (empresaId: string, mes: MesKey, valor: StatusExtrato) => {
      const empresa = empresas.find((e) => e.id === empresaId);
      if (!empresa) return;
      updateEmpresa(empresaId, {
        meses: {
          ...empresa.meses,
          [mes]: { ...empresa.meses[mes], extratoEnviado: valor },
        },
      });
    },
    [empresas, updateEmpresa],
  );

  const handleMesFieldChange = useCallback(
    (empresaId: string, mes: MesKey, campo: string, valor: any) => {
      const empresa = empresas.find((e) => e.id === empresaId);
      if (!empresa) return;
      updateEmpresa(empresaId, {
        meses: {
          ...empresa.meses,
          [mes]: { ...empresa.meses[mes], [campo]: valor },
        },
      });
    },
    [empresas, updateEmpresa],
  );

  const handleSendWhatsApp = useCallback(
    (empresa: Empresa, isResend?: boolean) => {
      if (!empresa.whatsapp) {
        toast({
          title: "WhatsApp não cadastrado",
          description: "Esta empresa não possui número de WhatsApp cadastrado.",
          variant: "destructive",
        });
        return;
      }
      setWhatsappIsResend(!!isResend);
      setWhatsappEmpresa(empresa);
    },
    [toast],
  );

  const handleWhatsAppConfirm = useCallback(
    async (opts?: { is_resend?: boolean; resend_reason?: string }) => {
      if (!whatsappEmpresa) return;
      const comp = `${MES_LABELS[mesSelecionado]}/2026`;
      const body = `Olá, ${whatsappEmpresa.nome}! Identificamos que o extrato de ${comp} ainda não foi enviado. Pode nos encaminhar por gentileza? Lembramos que caso não seja enviado, as declarações mensais serão entregues sem movimento.`;

      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          to: whatsappEmpresa.whatsapp,
          body,
          empresa_id: whatsappEmpresa.id,
          ticketStrategy: "create",
          competencia,
          message_type: "extrato_nao_enviado",
          is_resend: opts?.is_resend || false,
          resend_reason: opts?.resend_reason || null,
        },
      });

      if (error || data?.error) {
        toast({
          title: "Erro ao enviar",
          description: data?.error || "Falha na comunicação com o serviço de mensagens.",
          variant: "destructive",
        });
        throw new Error("send failed");
      }

      toast({ title: "Mensagem enviada", description: `WhatsApp enviado para ${whatsappEmpresa.nome}.` });
      invalidateWhatsAppLogs();
    },
    [whatsappEmpresa, mesSelecionado, competencia, toast, invalidateWhatsAppLogs],
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Controle Fiscal"
        subtitle="Contmax · 2026"
        showBack
        showLogout
        breadcrumbs={[{ label: "Portal", href: "/" }, { label: "Controle Fiscal" }]}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => exportToExcel(filtered, mesSelecionado)}
            className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
          >
            <Download className="mr-1 h-4 w-4" /> Excel
          </Button>
        }
      />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <DashboardSummary empresas={filtered} mesSelecionado={mesSelecionado} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={mesSelecionado} onValueChange={(v) => setMesSelecionado(v as MesKey)}>
            <TabsList>
              {(Object.keys(MES_LABELS) as MesKey[]).map((m) => (
                <TabsTrigger key={m} value={m}>
                  {MES_LABELS[m]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer border rounded-md px-3 py-1.5 bg-card hover:bg-muted/50 transition-colors">
              <Checkbox checked={nfFilter} onCheckedChange={(v) => setNfFilter(!!v)} />
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Nota Fiscal</span>
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer border rounded-md px-3 py-1.5 bg-card hover:bg-muted/50 transition-colors">
              <Checkbox checked={exteriorFilter} onCheckedChange={(v) => setExteriorFilter(!!v)} />
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Exterior</span>
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer border rounded-md px-3 py-1.5 bg-card hover:bg-muted/50 transition-colors">
              <Checkbox checked={alugueisFilter} onCheckedChange={(v) => setAlugueisFilter(!!v)} />
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Aluguéis</span>
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer border rounded-md px-3 py-1.5 bg-card hover:bg-muted/50 transition-colors">
              <Checkbox checked={questorFilter} onCheckedChange={(v) => setQuestorFilter(!!v)} />
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Lanç. Questor</span>
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer border rounded-md px-3 py-1.5 bg-card hover:bg-muted/50 transition-colors">
              <Checkbox checked={extratoPendenteFilter} onCheckedChange={(v) => setExtratoPendenteFilter(!!v)} />
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Extrato Pendente</span>
            </label>
            {isFechamento && (
              <label className="flex items-center gap-1.5 text-sm cursor-pointer border rounded-md px-3 py-1.5 bg-card hover:bg-muted/50 transition-colors">
                <Checkbox checked={reinfFilter} onCheckedChange={(v) => setReinfFilter(!!v)} />
                <AlertTriangle className="h-3.5 w-3.5 text-accent" />
                <span className="text-muted-foreground">REINF obrigatória</span>
              </label>
            )}
            {isDctfPos && (
              <label className="flex items-center gap-1.5 text-sm cursor-pointer border rounded-md px-3 py-1.5 bg-card hover:bg-muted/50 transition-colors">
                <Checkbox checked={dctfSmFilter} onCheckedChange={(v) => setDctfSmFilter(!!v)} />
                <FileText className="h-3.5 w-3.5 text-accent" />
                <span className="text-muted-foreground">DCTF S/Mov</span>
              </label>
            )}
            <Select value={regimeFilter} onValueChange={(v) => setRegimeFilter(v as RegimeTributario | "todos")}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Regime" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Regimes</SelectItem>
                <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
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
          </div>
        </div>

        {extratoPendenteFilter && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Filtro ativo:</span>
            <span className="bg-muted rounded px-2 py-0.5">Extrato Pendente</span>
          </div>
        )}

        <EmpresaTable
          empresas={filtered}
          mesSelecionado={mesSelecionado}
          canEdit={false}
          onFaturamento={handleFaturamento}
          onStatusChange={handleStatusChange}
          onExtratoChange={handleExtratoChange}
          onMesFieldChange={handleMesFieldChange}
          onSendWhatsApp={handleSendWhatsApp}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          whatsappLogs={whatsappLogs}
        />
      </main>

      <WhatsAppBatchBar
        selectedCount={selectedIds.size}
        mesSelecionado={mesSelecionado}
        onSend={() => setBatchDialogOpen(true)}
        onClear={() => setSelectedIds(new Set())}
      />

      <WhatsAppBatchConfirmDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        empresas={filtered.filter((e) => selectedIds.has(e.id))}
        mesSelecionado={mesSelecionado}
        whatsappLogs={whatsappLogs}
        onComplete={() => {
          setSelectedIds(new Set());
          setBatchDialogOpen(false);
          invalidateWhatsAppLogs();
        }}
      />

      {faturamentoEmpresa && (
        <FaturamentoFormDialog
          key={faturamentoEmpresa.id}
          open={!!faturamentoEmpresa}
          onOpenChange={(open) => {
            if (!open) setFaturamentoEmpresa(null);
          }}
          empresa={faturamentoEmpresa}
          mesSelecionado={mesSelecionado}
          onUpdate={updateEmpresa}
        />
      )}

      {whatsappEmpresa && (
        <WhatsAppConfirmDialog
          open={!!whatsappEmpresa}
          onOpenChange={(open) => {
            if (!open) {
              setWhatsappEmpresa(null);
              setWhatsappIsResend(false);
            }
          }}
          empresa={whatsappEmpresa}
          mesSelecionado={mesSelecionado}
          onConfirm={handleWhatsAppConfirm}
          isResend={whatsappIsResend}
          sentInfo={whatsappIsResend ? whatsappLogs.get(whatsappEmpresa.id) : undefined}
        />
      )}
    </div>
  );
};

export default Index;
