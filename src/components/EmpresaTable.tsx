import { useRef, useCallback, useMemo } from "react";
import { Empresa, MesKey, StatusEntrega, StatusExtrato, StatusQuestor, calcularDistribuicaoSocios, isMesFechamentoTrimestre, MESES_FECHAMENTO_TRIMESTRE, getMesesTrimestre, isMesDctfPosFechamento, getTrimestreFechamentoAnterior, calcularFaturamentoTrimestre } from "@/types/fiscal";
import type { WhatsAppLogInfo } from "@/hooks/useWhatsAppLogs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, ExtratoBadge, QuestorBadge } from "@/components/StatusBadge";
import { DistribuicaoSociosPopover } from "@/components/DistribuicaoSociosPopover";
import { FaturamentoPopover } from "@/components/FaturamentoPopover";
import { ReinfAlert } from "@/components/ReinfAlert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, FileText, FileX, DollarSign, Archive, RotateCcw, MessageCircle, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CustomFixedScrollbar } from "@/components/CustomFixedScrollbar";

function isElegivel(empresa: Empresa, mes: MesKey): boolean {
  const dados = empresa.meses[mes];
  return dados.extratoEnviado === "nao" && !!empresa.whatsapp && empresa.whatsapp.startsWith("55") && empresa.whatsapp.length >= 12;
}

function getMotivoBloqueio(empresa: Empresa, mes: MesKey): string | null {
  const dados = empresa.meses[mes];
  if (dados.extratoEnviado !== "nao") return "Extrato já enviado";
  if (!empresa.whatsapp || !empresa.whatsapp.startsWith("55") || empresa.whatsapp.length < 12) return "WhatsApp não cadastrado";
  return null;
}

interface EmpresaTableProps {
  empresas: Empresa[];
  mesSelecionado: MesKey;
  canEdit?: boolean;
  onEdit?: (empresa: Empresa) => void;
  onFaturamento?: (empresa: Empresa) => void;
  onDelete?: (id: string) => void;
  onBaixar?: (empresa: Empresa) => void;
  onReativar?: (empresa: Empresa) => void;
  onStatusChange: (empresaId: string, mesTrimestre: typeof MESES_FECHAMENTO_TRIMESTRE[number], campo: keyof Empresa["obrigacoes"]["marco"], valor: StatusEntrega) => void;
  onExtratoChange: (empresaId: string, mes: MesKey, valor: StatusExtrato) => void;
  onMesFieldChange: (empresaId: string, mes: MesKey, campo: string, valor: any) => void;
  onSendWhatsApp?: (empresa: Empresa, isResend?: boolean) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  whatsappLogs?: Map<string, WhatsAppLogInfo>;
}

const LIMITE_DISTRIBUICAO_SOCIO = 50000;

function getMesFechamentoTrimestre(mes: MesKey): typeof MESES_FECHAMENTO_TRIMESTRE[number] {
  if (["janeiro", "fevereiro", "marco"].includes(mes)) return "marco";
  if (["abril", "maio", "junho"].includes(mes)) return "junho";
  if (["julho", "agosto", "setembro"].includes(mes)) return "setembro";
  return "dezembro";
}

function calcularDistribuicaoTrimestral(empresa: Empresa, mesFechamento: MesKey): number {
  const meses = getMesesTrimestre(mesFechamento);
  const totalFaturamento = meses.reduce((sum, m) => sum + empresa.meses[m].faturamentoTotal, 0);
  return totalFaturamento * 0.75;
}

export function EmpresaTable({ empresas, mesSelecionado, canEdit = true, onEdit, onFaturamento, onDelete, onBaixar, onReativar, onStatusChange, onExtratoChange, onMesFieldChange, onSendWhatsApp, selectedIds, onSelectionChange, whatsappLogs }: EmpresaTableProps) {
  const isFechamento = isMesFechamentoTrimestre(mesSelecionado);
  const mesTrimestre = getMesFechamentoTrimestre(mesSelecionado);
  const isDctfPos = isMesDctfPosFechamento(mesSelecionado);
  const trimestreAnterior = getTrimestreFechamentoAnterior(mesSelecionado);
  const colCount = 10 + (isFechamento ? 5 : 0) + (isDctfPos ? 1 : 0);

  const containerRef = useRef<HTMLDivElement>(null);

  const elegiveis = useMemo(() => empresas.filter((e) => isElegivel(e, mesSelecionado)), [empresas, mesSelecionado]);

  const allElegiveisSelected = elegiveis.length > 0 && selectedIds ? elegiveis.every((e) => selectedIds.has(e.id)) : false;
  const someSelected = selectedIds ? elegiveis.some((e) => selectedIds.has(e.id)) : false;

  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;
    if (allElegiveisSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(elegiveis.map((e) => e.id)));
    }
  }, [allElegiveisSelected, elegiveis, onSelectionChange]);

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectionChange(next);
  }, [onSelectionChange, selectedIds]);

  return (
    <div className="max-h-[calc(100vh-220px)] overflow-y-auto overflow-x-hidden rounded-xl border shadow-sm table-zebra bg-muted text-primary-foreground">
      <div ref={containerRef} className="overflow-x-auto">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow className="header-gradient text-primary-foreground hover:bg-transparent [&>th]:text-primary-foreground/90 [&>th]:font-semibold">
              {onSelectionChange && (
                <TableHead className="w-10 text-center">
                  <Checkbox
                    checked={allElegiveisSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Selecionar todos elegíveis"
                    className="border-primary-foreground/50 data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary"
                  />
                </TableHead>
              )}
              <TableHead className="w-12">Nº</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead className="w-20 text-center">Regime</TableHead>
              <TableHead className="w-10 text-center">NF</TableHead>
              <TableHead className="text-center">Extrato</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
              <TableHead className="text-center">Lanç. Questor</TableHead>
              <TableHead className="text-right">Dist. Lucros</TableHead>
              {isFechamento &&
              <>
                  <TableHead className="text-right">Dist. Trimestral</TableHead>
                  <TableHead className="text-center">Lanç. Fiscal</TableHead>
                  <TableHead className="text-center">REINF</TableHead>
                  <TableHead className="text-center">DCTF Web</TableHead>
                  <TableHead className="text-center">MIT</TableHead>
                </>
              }
              {isDctfPos &&
              <TableHead className="text-center">DCTF S/Mov</TableHead>
              }
              <TableHead className="w-24 text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empresas.length === 0 &&
            <TableRow>
                <TableCell colSpan={colCount} className="h-24 text-center text-muted-foreground">
                  Nenhuma empresa cadastrada.
                </TableCell>
              </TableRow>
            }
            {empresas.map((empresa) => {
              const mes = empresa.meses[mesSelecionado];
              const sociosComDistribuicao = calcularDistribuicaoSocios(empresa.socios, mes.distribuicaoLucros);
              const temAlerta = sociosComDistribuicao.some((s) => (s.distribuicaoLucros ?? 0) > LIMITE_DISTRIBUICAO_SOCIO);

              const distribuicaoTrimestral = isFechamento ? calcularDistribuicaoTrimestral(empresa, mesSelecionado) : 0;
              const sociosTrimestrais = isFechamento ? calcularDistribuicaoSocios(empresa.socios, distribuicaoTrimestral) : [];
              const temAlertaTrimestral = sociosTrimestrais.some((s) => (s.distribuicaoLucros ?? 0) > LIMITE_DISTRIBUICAO_SOCIO);

              const fatTrimestreAnterior = trimestreAnterior ? calcularFaturamentoTrimestre(empresa, trimestreAnterior) : 0;
              const reinfObrigatoria = fatTrimestreAnterior > 0;

              return (
                <TableRow key={empresa.id} className={temAlerta || temAlertaTrimestral ? "bg-destructive/5" : ""}>
                  {onSelectionChange && (() => {
                    const elegivel = isElegivel(empresa, mesSelecionado);
                    const motivo = getMotivoBloqueio(empresa, mesSelecionado);
                    return (
                      <TableCell className="text-center">
                        {elegivel ? (
                          <Checkbox
                            checked={selectedIds?.has(empresa.id) ?? false}
                            onCheckedChange={(v) => handleSelectOne(empresa.id, !!v)}
                          />
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Checkbox disabled className="opacity-30" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{motivo}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                    );
                  })()}
                  <TableCell className="font-medium">{empresa.numero}</TableCell>
                  <TableCell className="font-medium max-w-[180px] truncate">
                    <div className="flex items-center gap-2">
                      <span className={empresa.dataBaixa ? "text-destructive" : ""}>{empresa.nome}</span>
                      {empresa.dataBaixa &&
                      <Badge variant="destructive" className="text-[9px] px-1.5 whitespace-nowrap">
                          BAIXADA EM {format(new Date(empresa.dataBaixa), "dd/MM/yyyy")}
                        </Badge>
                      }
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={empresa.regimeTributario === "simples_nacional" ? "secondary" : "outline"} className="text-[10px] px-1.5">
                      {empresa.regimeTributario === "simples_nacional" ? "SN" : "LP"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          {empresa.emiteNotaFiscal ?
                          <FileText className="h-4 w-4 text-success mx-auto" /> :

                          <FileX className="h-4 w-4 text-muted-foreground mx-auto" />
                          }
                        </TooltipTrigger>
                        <TooltipContent>
                          {empresa.emiteNotaFiscal ? "Emite NF" : "Não emite NF"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-center">
                    <ExtratoSelect
                      value={mes.extratoEnviado}
                      onChange={(v) => onExtratoChange(empresa.id, mesSelecionado, v)} />

                  </TableCell>
                  <TableCell className="text-right">
                    <FaturamentoPopover dados={mes} />
                  </TableCell>
                  <TableCell className="text-center">
                    <QuestorSelect
                      value={mes.lancadoQuestor}
                      onChange={(v) => onMesFieldChange(empresa.id, mesSelecionado, "lancadoQuestor", v)} />

                  </TableCell>
                  <TableCell className="text-right">
                    <DistribuicaoSociosPopover
                      socios={empresa.socios}
                      distribuicaoTotal={mes.distribuicaoLucros}
                      label="Mensal" />

                  </TableCell>
                  {isFechamento &&
                  <>
                      <TableCell className="text-right">
                        <DistribuicaoSociosPopover
                        socios={empresa.socios}
                        distribuicaoTotal={distribuicaoTrimestral}
                        label="Trimestral"
                        isTrimestral
                        detalhesMensais={getMesesTrimestre(mesSelecionado).map((m) => ({
                          mes: m,
                          faturamento: empresa.meses[m].faturamentoTotal,
                          distribuicao: empresa.meses[m].faturamentoTotal * 0.75
                        }))} />

                      </TableCell>
                      <TableCell className="text-center">
                        <StatusSelect
                        value={empresa.obrigacoes[mesTrimestre].lancamentoFiscal}
                        onChange={(v) => onStatusChange(empresa.id, mesTrimestre, "lancamentoFiscal", v)} />

                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <StatusSelect
                          value={empresa.obrigacoes[mesTrimestre].reinf}
                          onChange={(v) => onStatusChange(empresa.id, mesTrimestre, "reinf", v)} />

                          <ReinfAlert empresa={empresa} mesFechamento={mesTrimestre} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusSelect
                        value={empresa.obrigacoes[mesTrimestre].dcftWeb}
                        onChange={(v) => onStatusChange(empresa.id, mesTrimestre, "dcftWeb", v)} />

                      </TableCell>
                      <TableCell className="text-center">
                        {empresa.regimeTributario === "lucro_presumido" ?
                      <StatusSelect
                        value={empresa.obrigacoes[mesTrimestre].mit}
                        onChange={(v) => onStatusChange(empresa.id, mesTrimestre, "mit", v)} /> :


                      <span className="text-muted-foreground text-xs">—</span>
                      }
                      </TableCell>
                    </>
                  }
                  {isDctfPos &&
                  <TableCell className="text-center">
                      {reinfObrigatoria ?
                    <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] text-destructive font-medium">REINF enviada</span>
                          <StatusSelect
                        value={mes.dctfWebSemMovimento ?? "pendente"}
                        onChange={(v) => onMesFieldChange(empresa.id, mesSelecionado, "dctfWebSemMovimento", v)}
                        options={[
                        { value: "ok", label: "✅ OK" },
                        { value: "pendente", label: "❌ Pendente" }]
                        } />

                        </div> :

                    <span className="text-muted-foreground text-xs">—</span>
                    }
                    </TableCell>
                  }
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {onSendWhatsApp && (() => {
                        const logInfo = whatsappLogs?.get(empresa.id);
                        if (mes.extratoEnviado === "nao" && logInfo) {
                          // Already sent - show resend warning
                          const sentDate = format(new Date(logInfo.sentAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => onSendWhatsApp(empresa, true)} className="text-amber-500 hover:text-amber-600">
                                    <AlertTriangle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Enviado em {sentDate} por {logInfo.sentBy}. Clique para reenviar.</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        }
                        if (mes.extratoEnviado === "nao") {
                          return (
                            <Button variant="ghost" size="icon" onClick={() => onSendWhatsApp(empresa)} title="Enviar WhatsApp" className="text-green-600 hover:text-green-700">
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          );
                        }
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button variant="ghost" size="icon" disabled className="opacity-30">
                                    <MessageCircle className="h-4 w-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Extrato já enviado</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })()}
                      {onFaturamento &&
                      <Button variant="ghost" size="icon" onClick={() => onFaturamento(empresa)} title="Faturamento">
                          <DollarSign className="h-4 w-4" />
                        </Button>
                      }
                      {canEdit && onEdit &&
                      <Button variant="ghost" size="icon" onClick={() => onEdit(empresa)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      }
                      {canEdit && onReativar && onBaixar && (
                      empresa.dataBaixa ?
                      <Button variant="ghost" size="icon" onClick={() => onReativar(empresa)} title="Reativar empresa" className="text-success hover:text-success">
                            <RotateCcw className="h-4 w-4" />
                          </Button> :

                      <Button variant="ghost" size="icon" onClick={() => onBaixar(empresa)} title="Baixar empresa" className="text-warning hover:text-warning">
                            <Archive className="h-4 w-4" />
                          </Button>)

                      }
                      {canEdit && onDelete &&
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete(empresa.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                    </div>
                  </TableCell>
                </TableRow>);

            })}
          </TableBody>
        </Table>
      </div>

      <CustomFixedScrollbar
        targetRef={containerRef}
        watch={`${mesSelecionado}-${isFechamento}-${isDctfPos}-${empresas.length}`} />

    </div>);

}

function StatusSelect({ value, onChange, options }: {value: StatusEntrega;onChange: (v: StatusEntrega) => void;options?: {value: string;label: string;}[];}) {
  const defaultOptions = [
  { value: "ok", label: "✅ OK" },
  { value: "pendente", label: "❌ Pendente" },
  { value: "nao_aplicavel", label: "➖ N/A" }];

  const items = options ?? defaultOptions;
  return (
    <Select value={value} onValueChange={(v) => onChange(v as StatusEntrega)}>
      <SelectTrigger className="h-8 w-[110px] mx-auto border-0 bg-transparent p-0 focus:ring-0 [&>svg]:ml-1">
        <StatusBadge status={value} />
      </SelectTrigger>
      <SelectContent>
        {items.map((opt) =>
        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        )}
      </SelectContent>
    </Select>);

}

function ExtratoSelect({ value, onChange }: {value: StatusExtrato;onChange: (v: StatusExtrato) => void;}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as StatusExtrato)}>
      <SelectTrigger className="h-8 w-[130px] mx-auto border-0 bg-transparent p-0 focus:ring-0 [&>svg]:ml-1">
        <ExtratoBadge status={value} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="sim">✅ Enviado</SelectItem>
        <SelectItem value="nao">❌ Não Enviado</SelectItem>
        <SelectItem value="sem_faturamento">➖ Sem Faturamento</SelectItem>
      </SelectContent>
    </Select>);

}

function QuestorSelect({ value, onChange }: {value: StatusQuestor;onChange: (v: StatusQuestor) => void;}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as StatusQuestor)}>
      <SelectTrigger className="h-8 w-[120px] mx-auto border-0 bg-transparent p-0 focus:ring-0 [&>svg]:ml-1">
        <QuestorBadge status={value} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ok">✅ OK</SelectItem>
        <SelectItem value="sem_faturamento">➖ Sem Faturamento</SelectItem>
        <SelectItem value="pendente">❌ Pendente</SelectItem>
      </SelectContent>
    </Select>);

}