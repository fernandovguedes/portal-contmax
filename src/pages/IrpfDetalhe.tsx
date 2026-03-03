import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { useIrpfDocuments } from "@/hooks/useIrpfDocuments";
import { AppHeader } from "@/components/AppHeader";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IrpfInformacoesContribuinte } from "@/components/irpf/IrpfInformacoesContribuinte";
import { IrpfDocumentChecklist } from "@/components/irpf/IrpfDocumentChecklist";
import { STATUS_CONFIG, RESPONSAVEIS } from "@/types/irpf";
import type { IrpfCase, IrpfStatus, IrpfSource } from "@/types/irpf";
import { toast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

export default function IrpfDetalhe() {
  const { orgSlug, caseId } = useParams<{ orgSlug: string; caseId: string }>();
  const navigate = useNavigate();
  const { canEdit } = useModulePermissions(`irpf-${orgSlug}`);

  const [orgInfo, setOrgInfo] = useState<{ id: string; nome: string } | null>(null);
  const [caseData, setCaseData] = useState<IrpfCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // local form state
  const [form, setForm] = useState<Partial<IrpfCase>>({});

  useEffect(() => {
    if (!orgSlug) return;
    supabase.from("organizacoes").select("id, nome").eq("slug", orgSlug).single()
      .then(({ data }) => { if (data) setOrgInfo(data); });
  }, [orgSlug]);

  const fetchCase = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("irpf_cases")
      .select("*, irpf_people!inner(nome, cpf, source, pg_empresa_id, empresas:pg_empresa_id(nome))")
      .eq("id", caseId)
      .single();

    if (error || !data) {
      toast({ title: "Erro ao carregar declaração", description: error?.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const person = data.irpf_people as any;
    const c: IrpfCase = {
      id: data.id,
      tenantId: data.tenant_id,
      irpfPersonId: data.irpf_person_id,
      anoBase: data.ano_base,
      status: data.status as IrpfStatus,
      responsavel: data.responsavel,
      valorCobrado: Number(data.valor_cobrado) || 0,
      dataPagamento: data.data_pagamento || undefined,
      regime: (data.regime as IrpfCase["regime"]) || undefined,
      senhaGovbr: data.senha_govbr || undefined,
      enderecoCompleto: data.endereco_completo || undefined,
      valorApostas: data.valor_apostas || undefined,
      estadoCivil: data.estado_civil || undefined,
      cpfConjuge: data.cpf_conjuge || undefined,
      dependentes: Array.isArray(data.dependentes) ? data.dependentes as any : [],
      observacoes: data.observacoes || undefined,
      personNome: person?.nome,
      personCpf: person?.cpf,
      personSource: person?.source as IrpfSource,
      personEmpresaNome: person?.empresas?.nome ?? undefined,
    };
    setCaseData(c);
    setForm(c);
    setLoading(false);
  }, [caseId]);

  useEffect(() => { fetchCase(); }, [fetchCase]);

  const { documents, uploadDocument, deleteDocument, getSignedUrl } = useIrpfDocuments(caseId, orgInfo?.id);

  const updateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!caseId) return;
    setSaving(true);
    const row: any = {};
    if (form.status !== undefined) row.status = form.status;
    if (form.responsavel !== undefined) row.responsavel = form.responsavel;
    if (form.valorCobrado !== undefined) row.valor_cobrado = form.valorCobrado;
    if (form.dataPagamento !== undefined) row.data_pagamento = form.dataPagamento;
    if (form.regime !== undefined) row.regime = form.regime;
    if (form.observacoes !== undefined) row.observacoes = form.observacoes;
    if (form.senhaGovbr !== undefined) row.senha_govbr = form.senhaGovbr;
    if (form.enderecoCompleto !== undefined) row.endereco_completo = form.enderecoCompleto;
    if (form.valorApostas !== undefined) row.valor_apostas = form.valorApostas;
    if (form.estadoCivil !== undefined) row.estado_civil = form.estadoCivil;
    if (form.cpfConjuge !== undefined) row.cpf_conjuge = form.cpfConjuge;
    if (form.dependentes !== undefined) row.dependentes = form.dependentes;

    const { error } = await supabase.from("irpf_cases").update(row).eq("id", caseId);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Salvo com sucesso" });
      await fetchCase();
    }
    setSaving(false);
  };

  if (loading || !orgInfo || !caseData) {
    return <LoadingSkeleton variant="portal" />;
  }

  const sc = STATUS_CONFIG[form.status as IrpfStatus] || STATUS_CONFIG.aguardando_docs;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={`${caseData.personNome} — IRPF ${caseData.anoBase}`}
        subtitle={`${caseData.personCpf} · ${orgInfo.nome}`}
        showBack
        backTo={`/irpf/${orgSlug}`}
        showLogout
        breadcrumbs={[
          { label: "Portal", href: "/" },
          { label: `IRPF ${orgInfo.nome}`, href: `/irpf/${orgSlug}` },
          { label: caseData.personNome || "" },
        ]}
        actions={
          canEdit ? (
            <Button onClick={handleSave} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Save className="h-4 w-4 mr-1" /> Salvar alterações
            </Button>
          ) : undefined
        }
      />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {/* Seção 1: Dados gerais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados Gerais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <p className="text-sm font-medium">{caseData.personNome}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">CPF</Label>
                <p className="text-sm font-medium">{caseData.personCpf}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Origem</Label>
                <Badge variant={caseData.personSource === "PG" ? "default" : "secondary"} className="text-[10px]">
                  {caseData.personSource === "PG" ? "P&G" : "Avulso"}
                </Badge>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ano-base</Label>
                <p className="text-sm font-medium">{caseData.anoBase}</p>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status || ""} onValueChange={v => updateField("status", v)} disabled={!canEdit}>
                  <SelectTrigger>
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
              </div>

              {orgSlug !== "contmax" && (
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={form.responsavel || ""} onValueChange={v => updateField("responsavel", v)} disabled={!canEdit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESPONSAVEIS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              )}

              <div className="space-y-2">
                <Label>Valor Cobrado (R$)</Label>
                <Input
                  type="number"
                  value={form.valorCobrado ?? ""}
                  onChange={e => updateField("valorCobrado", parseFloat(e.target.value) || 0)}
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-2">
                <Label>Data Pagamento</Label>
                <Input
                  value={form.dataPagamento || ""}
                  onChange={e => updateField("dataPagamento", e.target.value)}
                  disabled={!canEdit}
                  placeholder="dd/mm/aaaa"
                />
              </div>

              <div className="space-y-2">
                <Label>Regime</Label>
                <Select value={form.regime || ""} onValueChange={v => updateField("regime", v)} disabled={!canEdit}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completa">Completa</SelectItem>
                    <SelectItem value="simplificada">Simplificada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes || ""}
                onChange={e => updateField("observacoes", e.target.value)}
                disabled={!canEdit}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Seção 2: Informações do contribuinte */}
        <IrpfInformacoesContribuinte
          caseData={form as IrpfCase}
          onChange={updateField}
          disabled={!canEdit}
        />

        {/* Seção 3: Documentos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Checklist de Documentos</CardTitle>
          </CardHeader>
          <CardContent>
            <IrpfDocumentChecklist
              documents={documents}
              canEdit={canEdit}
              onUpload={uploadDocument}
              onDelete={deleteDocument}
              onView={getSignedUrl}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
