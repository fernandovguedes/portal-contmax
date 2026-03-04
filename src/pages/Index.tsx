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
import { Search, Filter, Download, AlertTriangle, FileText, Mail, Send, Loader2 } from "lucide-react";
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
import { enviarSaidasMes } from "@/services/questor-syn";

const ANO_COMPETENCIA = 2026;

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
      .then(({ data, error }) => {
        if (error) {
          toast({ title: "Erro ao carregar módulo", description: error.message, variant: "destructive" });
          return;
        }
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

  // Estado do envio ao Questor
  const [enviandoQuestor, setEnviandoQuestor] = useState(false);

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

  // Conta quantas empresas estão pendentes no mês selecionado
  const totalPendentes = visibleEmpresas.filter(
    (e) => e.meses[mesSelecionado].lancadoQuestor === "pendente" &&
    (
      e.meses[mesSelecionado].faturamentoNacional > 0 ||
      e.meses[mesSelecionado].faturamentoExterior > 0 ||
      (e.meses[mesSelecionado].faturamentoAlugueis || 0) > 0
    )
  ).length;

  const handleEnviarQuestor = useCallback(async () => {
    if (totalPendentes === 0) {
      toast({
        title: "Nenhuma empresa pendente",
        description: `Todas as empresas de ${MES_LABELS[mesSelecionado]} já foram lançadas no Questor.`,
      });
      return;
    }

    setEnviandoQuestor(true);
    try {
      const resultados = await enviarSaidasMes(mesSelecionado, ANO_COMPETENCIA);

      const sucesso = resultados.filter((r) => r.sucesso).length;
      const erros = resultados.filter((r) => !r.sucesso);

      if (erros.length === 0) {
        toast({
          title: "Envio concluído!",
          description: `${sucesso} lançamento(s) enviado(s) ao Questor com sucesso.`,
        });
      } else {
        toast({
          title: `${sucesso} enviado(s), ${erros.length} com erro`,
          description: erros.map((e) => `${e.empresa} (${e.tipo}): ${e.erro}`).join("\n"),
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Erro ao enviar ao Questor",
        description: err instanceof Error ? err.message : "Erro desconhecido.",
        variant: "destructive",
      });
    } finally {
      setEnviandoQuestor(false);
    }
  }, [mesSelecionado, totalPendentes, toast]);

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
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => exportToExcel(filtered, mesSelecionado)}
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            >
              <Download className="mr-1 h-4 w-4" /> Excel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEnviarQuestor}
              disabled={enviandoQuestor}
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            >
              {enviandoQuestor ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              {enviandoQuestor
                ? "Enviando..."
                : `Questor${totalPendentes > 0 ? ` (${totalPendentes})` : ""}`}
            </Button>
          </div>
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
"
    },
    "message": "Index.tsx atualizado com botão de envio ao Questor",
    "integration_name": null,
    "integration_icon_url": null,
    "icon_name": "file",
    "context": null,
    "display_content": {
      "type": "json_block",
      "json_block": "{"language": "typescript", "code": "import { useState, useCallback, useEffect } from \"react\";\nimport { useEmpresas } from \"@/hooks/useEmpresas\";\nimport { useWhatsAppLogs } from \"@/hooks/useWhatsAppLogs\";\nimport { getCompetenciaAtual } from \"@/lib/formatUtils\";\nimport { Empresa, MesKey, MES_LABELS, StatusEntrega, StatusExtrato, RegimeTributario } from \"@/types/fiscal\";\nimport { filtrarEmpresasVisiveis } from \"@/lib/empresaUtils\";\nimport { supabase } from \"@/integrations/supabase/client\";\nimport { DashboardSummary } from \"@/components/DashboardSummary\";\nimport { EmpresaTable } from \"@/components/EmpresaTable\";\nimport { FaturamentoFormDialog } from \"@/components/FaturamentoFormDialog\";\nimport { WhatsAppConfirmDialog } from \"@/components/WhatsAppConfirmDialog\";\nimport { WhatsAppBatchBar } from \"@/components/WhatsAppBatchBar\";\nimport { WhatsAppBatchConfirmDialog } from \"@/components/WhatsAppBatchConfirmDialog\";\nimport { Button } from \"@/components/ui/button\";\nimport { Input } from \"@/components/ui/input\";\nimport { Tabs, TabsList, TabsTrigger } from \"@/components/ui/tabs\";\nimport { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from \"@/components/ui/select\";\nimport { Search, Filter, Download, AlertTriangle, FileText, Mail, Send, Loader2 } from \"lucide-react\";\nimport { useNavigate } from \"react-router-dom\";\nimport { Checkbox } from \"@/components/ui/checkbox\";\nimport {\n  isMesFechamentoTrimestre,\n  calcularFaturamentoTrimestre,\n  isMesDctfPosFechamento,\n  getTrimestreFechamentoAnterior,\n} from \"@/types/fiscal\";\nimport { exportToExcel } from \"@/lib/exportExcel\";\nimport { useModulePermissions } from \"@/hooks/useModulePermissions\";\nimport { AppHeader } from \"@/components/AppHeader\";\nimport { LoadingSkeleton } from \"@/components/LoadingSkeleton\";\nimport { useToast } from \"@/hooks/use-toast\";\nimport { enviarSaidasMes } from \"@/services/questor-syn\";\n\nconst ANO_COMPETENCIA = 2026;\n\nconst Index = () => {\n  const navigate = useNavigate();\n  const { canEdit } = useModulePermissions(\"controle-fiscal\");\n  const { toast } = useToast();\n\n  const [organizacaoId, setOrganizacaoId] = useState<string | undefined>();\n  useEffect(() => {\n    supabase\n      .from(\"modules\")\n      .select(\"organizacao_id\")\n      .eq(\"slug\", \"controle-fiscal\")\n      .single()\n      .then(({ data, error }) => {\n        if (error) {\n          toast({ title: \"Erro ao carregar m\u00f3dulo\", description: error.message, variant: \"destructive\" });\n          return;\n        }\n        if (data?.organizacao_id) setOrganizacaoId(data.organizacao_id);\n      });\n  }, []);\n\n  const { empresas, loading, updateEmpresa } = useEmpresas(organizacaoId);\n  const [mesSelecionado, setMesSelecionado] = useState<MesKey>(\"janeiro\");\n  const competencia = getCompetenciaAtual(mesSelecionado);\n  const { logsMap: whatsappLogs, invalidate: invalidateWhatsAppLogs } = useWhatsAppLogs(competencia);\n  const [search, setSearch] = useState(\"\");\n  const [regimeFilter, setRegimeFilter] = useState<RegimeTributario | \"todos\">(\"todos\");\n  const [reinfFilter, setReinfFilter] = useState(false);\n  const [nfFilter, setNfFilter] = useState(false);\n  const [exteriorFilter, setExteriorFilter] = useState(false);\n  const [alugueisFilter, setAlugueisFilter] = useState(false);\n  const [dctfSmFilter, setDctfSmFilter] = useState(false);\n  const [questorFilter, setQuestorFilter] = useState(false);\n  const [extratoPendenteFilter, setExtratoPendenteFilter] = useState(false);\n  const [faturamentoEmpresa, setFaturamentoEmpresa] = useState<Empresa | null>(null);\n  const [whatsappEmpresa, setWhatsappEmpresa] = useState<Empresa | null>(null);\n  const [whatsappIsResend, setWhatsappIsResend] = useState(false);\n  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());\n  const [batchDialogOpen, setBatchDialogOpen] = useState(false);\n\n  // Estado do envio ao Questor\n  const [enviandoQuestor, setEnviandoQuestor] = useState(false);\n\n  // Clear selection when month changes\n  useEffect(() => {\n    setSelectedIds(new Set());\n  }, [mesSelecionado]);\n\n  const isFechamento = isMesFechamentoTrimestre(mesSelecionado);\n  const isDctfPos = isMesDctfPosFechamento(mesSelecionado);\n  const trimestreAnterior = getTrimestreFechamentoAnterior(mesSelecionado);\n\n  const visibleEmpresas = filtrarEmpresasVisiveis(empresas, mesSelecionado);\n\n  const filtered = visibleEmpresas.filter((e) => {\n    const matchesSearch = e.nome.toLowerCase().includes(search.toLowerCase()) || e.cnpj.includes(search);\n    const matchesRegime = regimeFilter === \"todos\" || e.regimeTributario === regimeFilter;\n\n    let matchesReinf = true;\n    if (reinfFilter && isFechamento) {\n      const fatTrimestre = calcularFaturamentoTrimestre(e, mesSelecionado);\n      matchesReinf = fatTrimestre > 0;\n    }\n\n    let matchesNfExterior = true;\n    if (nfFilter || exteriorFilter || alugueisFilter) {\n      const dados = e.meses[mesSelecionado];\n      const passNf = !nfFilter || dados.faturamentoNotaFiscal > 0;\n      const passExt = !exteriorFilter || dados.faturamentoExterior > 0;\n      const passAlug = !alugueisFilter || (dados.faturamentoAlugueis || 0) > 0;\n      matchesNfExterior = passNf && passExt && passAlug;\n    }\n\n    let matchesDctfSm = true;\n    if (dctfSmFilter && isDctfPos && trimestreAnterior) {\n      const fatTrimAnterior = calcularFaturamentoTrimestre(e, trimestreAnterior);\n      matchesDctfSm = fatTrimAnterior > 0;\n    }\n\n    let matchesQuestor = true;\n    if (questorFilter) {\n      const dados = e.meses[mesSelecionado];\n      matchesQuestor = dados.lancadoQuestor === \"pendente\";\n    }\n\n    let matchesExtratoPendente = true;\n    if (extratoPendenteFilter) {\n      const dados = e.meses[mesSelecionado];\n      matchesExtratoPendente = dados.extratoEnviado === \"nao\";\n    }\n\n    return (\n      matchesSearch &&\n      matchesRegime &&\n      matchesReinf &&\n      matchesNfExterior &&\n      matchesDctfSm &&\n      matchesQuestor &&\n      matchesExtratoPendente\n    );\n  });\n\n  // Conta quantas empresas est\u00e3o pendentes no m\u00eas selecionado\n  const totalPendentes = visibleEmpresas.filter(\n    (e) => e.meses[mesSelecionado].lancadoQuestor === \"pendente\" &&\n    (\n      e.meses[mesSelecionado].faturamentoNacional > 0 ||\n      e.meses[mesSelecionado].faturamentoExterior > 0 ||\n      (e.meses[mesSelecionado].faturamentoAlugueis || 0) > 0\n    )\n  ).length;\n\n  const handleEnviarQuestor = useCallback(async () => {\n    if (totalPendentes === 0) {\n      toast({\n        title: \"Nenhuma empresa pendente\",\n        description: `Todas as empresas de ${MES_LABELS[mesSelecionado]} j\u00e1 foram lan\u00e7adas no Questor.`,\n      });\n      return;\n    }\n\n    setEnviandoQuestor(true);\n    try {\n      const resultados = await enviarSaidasMes(mesSelecionado, ANO_COMPETENCIA);\n\n      const sucesso = resultados.filter((r) => r.sucesso).length;\n      const erros = resultados.filter((r) => !r.sucesso);\n\n      if (erros.length === 0) {\n        toast({\n          title: \"Envio conclu\u00eddo!\",\n          description: `${sucesso} lan\u00e7amento(s) enviado(s) ao Questor com sucesso.`,\n        });\n      } else {\n        toast({\n          title: `${sucesso} enviado(s), ${erros.length} com erro`,\n          description: erros.map((e) => `${e.empresa} (${e.tipo}): ${e.erro}`).join(\"\\n\"),\n          variant: \"destructive\",\n        });\n      }\n    } catch (err) {\n      toast({\n        title: \"Erro ao enviar ao Questor\",\n        description: err instanceof Error ? err.message : \"Erro desconhecido.\",\n        variant: \"destructive\",\n      });\n    } finally {\n      setEnviandoQuestor(false);\n    }\n  }, [mesSelecionado, totalPendentes, toast]);\n\n  const handleFaturamento = useCallback((empresa: Empresa) => {\n    setFaturamentoEmpresa(empresa);\n  }, []);\n\n  const handleStatusChange = useCallback(\n    (empresaId: string, mes: MesKey, campo: keyof Empresa[\"obrigacoes\"][\"marco\"], valor: StatusEntrega) => {\n      const empresa = empresas.find((e) => e.id === empresaId);\n      if (!empresa) return;\n      updateEmpresa(empresaId, {\n        obrigacoes: {\n          ...empresa.obrigacoes,\n          [mes]: { ...empresa.obrigacoes[mes], [campo]: valor },\n        },\n      });\n    },\n    [empresas, updateEmpresa],\n  );\n\n  const handleExtratoChange = useCallback(\n    (empresaId: string, mes: MesKey, valor: StatusExtrato) => {\n      const empresa = empresas.find((e) => e.id === empresaId);\n      if (!empresa) return;\n      updateEmpresa(empresaId, {\n        meses: {\n          ...empresa.meses,\n          [mes]: { ...empresa.meses[mes], extratoEnviado: valor },\n        },\n      });\n    },\n    [empresas, updateEmpresa],\n  );\n\n  const handleMesFieldChange = useCallback(\n    (empresaId: string, mes: MesKey, campo: string, valor: any) => {\n      const empresa = empresas.find((e) => e.id === empresaId);\n      if (!empresa) return;\n      updateEmpresa(empresaId, {\n        meses: {\n          ...empresa.meses,\n          [mes]: { ...empresa.meses[mes], [campo]: valor },\n        },\n      });\n    },\n    [empresas, updateEmpresa],\n  );\n\n  const handleSendWhatsApp = useCallback(\n    (empresa: Empresa, isResend?: boolean) => {\n      if (!empresa.whatsapp) {\n        toast({\n          title: \"WhatsApp n\u00e3o cadastrado\",\n          description: \"Esta empresa n\u00e3o possui n\u00famero de WhatsApp cadastrado.\",\n          variant: \"destructive\",\n        });\n        return;\n      }\n      setWhatsappIsResend(!!isResend);\n      setWhatsappEmpresa(empresa);\n    },\n    [toast],\n  );\n\n  const handleWhatsAppConfirm = useCallback(\n    async (opts?: { is_resend?: boolean; resend_reason?: string }) => {\n      if (!whatsappEmpresa) return;\n      const comp = `${MES_LABELS[mesSelecionado]}/2026`;\n      const body = `Ol\u00e1, ${whatsappEmpresa.nome}! Identificamos que o extrato de ${comp} ainda n\u00e3o foi enviado. Pode nos encaminhar por gentileza? Lembramos que caso n\u00e3o seja enviado, as declara\u00e7\u00f5es mensais ser\u00e3o entregues sem movimento.`;\n\n      const { data, error } = await supabase.functions.invoke(\"send-whatsapp\", {\n        body: {\n          to: whatsappEmpresa.whatsapp,\n          body,\n          empresa_id: whatsappEmpresa.id,\n          ticketStrategy: \"create\",\n          competencia,\n          message_type: \"extrato_nao_enviado\",\n          is_resend: opts?.is_resend || false,\n          resend_reason: opts?.resend_reason || null,\n        },\n      });\n\n      if (error || data?.error) {\n        toast({\n          title: \"Erro ao enviar\",\n          description: data?.error || \"Falha na comunica\u00e7\u00e3o com o servi\u00e7o de mensagens.\",\n          variant: \"destructive\",\n        });\n        throw new Error(\"send failed\");\n      }\n\n      toast({ title: \"Mensagem enviada\", description: `WhatsApp enviado para ${whatsappEmpresa.nome}.` });\n      invalidateWhatsAppLogs();\n    },\n    [whatsappEmpresa, mesSelecionado, competencia, toast, invalidateWhatsAppLogs],\n  );\n\n  return (\n    <div className=\"min-h-screen bg-background\">\n      <AppHeader\n        title=\"Controle Fiscal\"\n        subtitle=\"Contmax \u00b7 2026\"\n        showBack\n        showLogout\n        breadcrumbs={[{ label: \"Portal\", href: \"/\" }, { label: \"Controle Fiscal\" }]}\n        actions={\n          <div className=\"flex items-center gap-2\">\n            <Button\n              variant=\"ghost\"\n              size=\"sm\"\n              onClick={() => exportToExcel(filtered, mesSelecionado)}\n              className=\"text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10\"\n            >\n              <Download className=\"mr-1 h-4 w-4\" /> Excel\n            </Button>\n            <Button\n              variant=\"ghost\"\n              size=\"sm\"\n              onClick={handleEnviarQuestor}\n              disabled={enviandoQuestor}\n              className=\"text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10\"\n            >\n              {enviandoQuestor ? (\n                <Loader2 className=\"mr-1 h-4 w-4 animate-spin\" />\n              ) : (\n                <Send className=\"mr-1 h-4 w-4\" />\n              )}\n              {enviandoQuestor\n                ? \"Enviando...\"\n                : `Questor${totalPendentes > 0 ? ` (${totalPendentes})` : \"\"}`}\n            </Button>\n          </div>\n        }\n      />\n\n      <main className=\"mx-auto max-w-7xl space-y-6 px-4 py-6\">\n        <DashboardSummary empresas={filtered} mesSelecionado={mesSelecionado} />\n\n        <div className=\"flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between\">\n          <Tabs value={mesSelecionado} onValueChange={(v) => setMesSelecionado(v as MesKey)}>\n            <TabsList>\n              {(Object.keys(MES_LABELS) as MesKey[]).map((m) => (\n                <TabsTrigger key={m} value={m}>\n                  {MES_LABELS[m]}\n                </TabsTrigger>\n              ))}\n            </TabsList>\n          </Tabs>\n          <div className=\"flex items-center gap-2 flex-wrap\">\n            <label className=\"flex items-center gap-1.5 text-sm cursor-pointer border rounded-md px-3 py-1.5 bg-card hover:bg-muted/50 transition-colors\">\n              <Checkbox checked={nfFilter} onCheckedChange={(v) => setNfFilter(!!v)} />\n              <FileText className=\"h-3.5 w-3.5 text-muted-foreground\" />\n              <span className=\"text-muted-foreground\">Nota Fiscal</span>\n            </label>\n            <label className=\"flex items-center gap-1.5 text-sm cursor-pointer border rounded-md px-3 py-1.5 bg-card hover:bg-muted/50 transition-colors\">\n              <Checkbox checked={exteriorFilter} onCheckedChange={(v) => setExteriorFilter(!!v)} />\n              <FileText className=\"h-3.5 w-3.5 text-muted-foreground\" />\n              <span className=\"text-muted-foreground\">Exterior</span>\n            </label>\n            <label className=\"flex items-center gap-1.5 text-sm cursor-pointer border rounded-md px-3 py-1.5 bg-card hover:bg-muted/50 transition-colors\">\n              <Checkbox checked={alugueisFilter} onCheckedChange={(v) => setAlugueisFilter(!!v)} />\n              <FileText className=\"h-3.5 w-3.5 text-muted-foreground\" />\n              <span className=\"text-muted-foreground\">Alugu\u00e9is</span>\n            </label>\n            <label className=\"flex items-center gap-1.5 text-sm cursor-pointer border rounded-md px-3 py-1.5 bg-card hover:bg-muted/50 transition-colors\">\n              <Checkbox checked={questorFilter} onCheckedChange={(v) => setQuestorFilter(!!v)} />\n              <FileText className=\"h-3.5 w-3.5 text-muted-foreground\" />\n              <span className=\"text-muted-foreground\">Lan\u00e7. Questor</span>\n            </label>\n            <label className=\"flex items-center gap-1.5 text-sm cursor-pointer border rounded-md px-3 py-1.5 bg-card hover:bg-muted/50 transition-colors\">\n              <Checkbox checked={extratoPendenteFilter} onCheckedChange={(v) => setExtratoPendenteFilter(!!v)} />\n              <Mail className=\"h-3.5 w-3.5 text-muted-foreground\" />\n              <span className=\"text-muted-foreground\">Extrato Pendente</span>\n            </label>\n            {isFechamento && (\n              <label className=\"flex items-center gap-1.5 text-sm cursor-pointer border rounded-md px-3 py-1.5 bg-card hover:bg-muted/50 transition-colors\">\n                <Checkbox checked={reinfFilter} onCheckedChange={(v) => setReinfFilter(!!v)} />\n                <AlertTriangle className=\"h-3.5 w-3.5 text-accent\" />\n                <span className=\"text-muted-foreground\">REINF obrigat\u00f3ria</span>\n              </label>\n            )}\n            {isDctfPos && (\n              <label className=\"flex items-center gap-1.5 text-sm cursor-pointer border rounded-md px-3 py-1.5 bg-card hover:bg-muted/50 transition-colors\">\n                <Checkbox checked={dctfSmFilter} onCheckedChange={(v) => setDctfSmFilter(!!v)} />\n                <FileText className=\"h-3.5 w-3.5 text-accent\" />\n                <span className=\"text-muted-foreground\">DCTF S/Mov</span>\n              </label>\n            )}\n            <Select value={regimeFilter} onValueChange={(v) => setRegimeFilter(v as RegimeTributario | \"todos\")}>\n              <SelectTrigger className=\"w-[180px]\">\n                <Filter className=\"h-4 w-4 mr-1 text-muted-foreground\" />\n                <SelectValue placeholder=\"Regime\" />\n              </SelectTrigger>\n              <SelectContent>\n                <SelectItem value=\"todos\">Todos os Regimes</SelectItem>\n                <SelectItem value=\"simples_nacional\">Simples Nacional</SelectItem>\n                <SelectItem value=\"lucro_presumido\">Lucro Presumido</SelectItem>\n              </SelectContent>\n            </Select>\n            <div className=\"relative w-full sm:w-72\">\n              <Search className=\"absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground\" />\n              <Input\n                placeholder=\"Buscar empresa ou CNPJ...\"\n                value={search}\n                onChange={(e) => setSearch(e.target.value)}\n                className=\"pl-9\"\n              />\n            </div>\n          </div>\n        </div>\n\n        {extratoPendenteFilter && (\n          <div className=\"flex items-center gap-2 text-xs text-muted-foreground\">\n            <Filter className=\"h-3.5 w-3.5\" />\n            <span>Filtro ativo:</span>\n            <span className=\"bg-muted rounded px-2 py-0.5\">Extrato Pendente</span>\n          </div>\n        )}\n\n        <EmpresaTable\n          empresas={filtered}\n          mesSelecionado={mesSelecionado}\n          canEdit={false}\n          onFaturamento={handleFaturamento}\n          onStatusChange={handleStatusChange}\n          onExtratoChange={handleExtratoChange}\n          onMesFieldChange={handleMesFieldChange}\n          onSendWhatsApp={handleSendWhatsApp}\n          selectedIds={selectedIds}\n          onSelectionChange={setSelectedIds}\n          whatsappLogs={whatsappLogs}\n        />\n      </main>\n\n      <WhatsAppBatchBar\n        selectedCount={selectedIds.size}\n        mesSelecionado={mesSelecionado}\n        onSend={() => setBatchDialogOpen(true)}\n        onClear={() => setSelectedIds(new Set())}\n      />\n\n      <WhatsAppBatchConfirmDialog\n        open={batchDialogOpen}\n        onOpenChange={setBatchDialogOpen}\n        empresas={filtered.filter((e) => selectedIds.has(e.id))}\n        mesSelecionado={mesSelecionado}\n        whatsappLogs={whatsappLogs}\n        onComplete={() => {\n          setSelectedIds(new Set());\n          setBatchDialogOpen(false);\n          invalidateWhatsAppLogs();\n        }}\n      />\n\n      {faturamentoEmpresa && (\n        <FaturamentoFormDialog\n          key={faturamentoEmpresa.id}\n          open={!!faturamentoEmpresa}\n          onOpenChange={(open) => {\n            if (!open) setFaturamentoEmpresa(null);\n          }}\n          empresa={faturamentoEmpresa}\n          mesSelecionado={mesSelecionado}\n          onUpdate={updateEmpresa}\n        />\n      )}\n\n      {whatsappEmpresa && (\n        <WhatsAppConfirmDialog\n          open={!!whatsappEmpresa}\n          onOpenChange={(open) => {\n            if (!open) {\n              setWhatsappEmpresa(null);\n              setWhatsappIsResend(false);\n            }\n          }}\n          empresa={whatsappEmpresa}\n          mesSelecionado={mesSelecionado}\n          onConfirm={handleWhatsAppConfirm}\n          isResend={whatsappIsResend}\n          sentInfo={whatsappIsResend ? whatsappLogs.get(whatsappEmpresa.id) : undefined}\n        />\n      )}\n    </div>\n  );\n};\n\nexport default Index;\n", "filename": "/mnt/user-data/outputs/Index.tsx"}"
    },
    "approval_options": null,
    "approval_key": null,
    "is_mcp_app": null
  },
  {
    "start_timestamp": null,
    "stop_timestamp": null,
    "flags": null,
    "type": "tool_result",
    "tool_use_id": "toolu_01Kv1HuUhgupmMNf63p6mkZp",
    "name": "create_file",
    "content": [
      {
        "type": "text",
        "text": "File created successfully: /mnt/user-data/outputs/Index.tsx",
        "uuid": "9283fd12-e364-4143-a30f-5880ceb37aec