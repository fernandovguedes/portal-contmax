import { useState, useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CustomFixedScrollbar } from "@/components/CustomFixedScrollbar";
import { ServicosExtrasPopover } from "@/components/ServicosExtrasPopover";
import type { HonorarioEmpresa, MesKey, HonorarioMesData } from "@/hooks/useHonorarios";

interface Props {
  empresas: HonorarioEmpresa[];
  mes: MesKey;
  salarioMinimo: number;
  canEdit: boolean;
  calcularValores: (empresa: HonorarioEmpresa, mes: MesKey) => {
    valorFiscalContabil: number;
    valorFuncionarios: number;
    totalMes: number;
  };
  getMesData: (empresa: HonorarioEmpresa, mes: MesKey) => HonorarioMesData;
  onUpdateMes: (id: string, mes: MesKey, field: keyof HonorarioMesData | Partial<HonorarioMesData>, value?: any) => void;
  onEdit: (empresa: HonorarioEmpresa) => void;
  onDelete: (id: string) => void;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function InlineNumericCell({
  value,
  onCommit,
  canEdit,
  isCurrency = false,
}: {
  value: number;
  onCommit: (v: number) => void;
  canEdit: boolean;
  isCurrency?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value.toString());

  const commit = () => {
    setEditing(false);
    const num = parseFloat(tempValue.replace(",", ".")) || 0;
    if (num !== value) onCommit(num);
  };

  if (!canEdit) {
    return <span className="text-xs">{isCurrency ? formatCurrency(value) : value}</span>;
  }

  if (editing) {
    return (
      <Input
        autoFocus
        className="h-7 w-20 text-xs"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      />
    );
  }

  return (
    <span
      className="text-xs cursor-pointer hover:bg-muted px-1 py-0.5 rounded"
      onClick={() => { setTempValue(value.toString()); setEditing(true); }}
    >
      {isCurrency ? formatCurrency(value) : value || "—"}
    </span>
  );
}

function InlineTextCell({
  value,
  onCommit,
  canEdit,
}: {
  value: string;
  onCommit: (v: string) => void;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const commit = () => {
    setEditing(false);
    if (tempValue !== value) onCommit(tempValue);
  };

  if (!canEdit) {
    return <span className="text-xs">{value || "—"}</span>;
  }

  if (editing) {
    return (
      <Input
        autoFocus
        className="h-7 w-32 text-xs"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      />
    );
  }

  return (
    <span
      className="text-xs cursor-pointer hover:bg-muted px-1 py-0.5 rounded"
      onClick={() => { setTempValue(value); setEditing(true); }}
    >
      {value || "—"}
    </span>
  );
}

export function HonorariosTable({ empresas, mes, salarioMinimo, canEdit, calcularValores, getMesData, onUpdateMes, onEdit, onDelete }: Props) {
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; nome: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const colCount = canEdit ? 13 : 12;

  return (
    <>
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto overflow-x-hidden rounded-xl border bg-card shadow-sm table-zebra">
        <div ref={containerRef} className="overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow className="header-gradient text-primary-foreground hover:bg-transparent [&>th]:text-primary-foreground/90 [&>th]:font-semibold">
                <TableHead className="min-w-[220px] max-w-[260px] text-xs">Razão Social</TableHead>
                <TableHead className="text-xs text-center w-16">Fiscal %</TableHead>
                <TableHead className="text-xs text-center w-16">Contábil %</TableHead>
                <TableHead className="text-xs text-center w-20">Pessoal R$</TableHead>
                <TableHead className="text-xs text-center w-28">Valor Fisc+Cont</TableHead>
                <TableHead className="text-xs text-center w-16">Nº Func</TableHead>
                <TableHead className="text-xs text-center w-24">Valor Func</TableHead>
                <TableHead className="text-xs text-center w-24">Serv. Extras</TableHead>
                <TableHead className="text-xs text-center w-24 font-bold">Total Mês</TableHead>
                <TableHead className="text-xs text-center w-20">Boleto</TableHead>
                <TableHead className="text-xs text-center min-w-[140px]">Data Pgto</TableHead>
                <TableHead className="text-xs text-center min-w-[120px]">Emitir NF</TableHead>
                {canEdit && <TableHead className="text-xs text-center w-16">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {empresas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colCount} className="text-center text-muted-foreground py-8">
                    Nenhuma empresa cadastrada neste módulo.
                  </TableCell>
                </TableRow>
              ) : (
                empresas.map((emp) => {
                  const mesData = getMesData(emp, mes);
                  const { valorFiscalContabil, valorFuncionarios, totalMes } = calcularValores(emp, mes);
                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="text-xs font-medium truncate max-w-[260px]">{emp.empresa_nome}</TableCell>
                      <TableCell className="text-xs text-center">{emp.fiscal_percentual}%</TableCell>
                      <TableCell className="text-xs text-center">{emp.contabil_percentual}%</TableCell>
                      <TableCell className="text-xs text-center">{formatCurrency(emp.pessoal_valor)}</TableCell>
                      <TableCell className="text-xs text-center font-medium">{formatCurrency(valorFiscalContabil)}</TableCell>
                      <TableCell className="text-center">
                        <InlineNumericCell
                          value={mesData.num_funcionarios}
                          onCommit={(v) => onUpdateMes(emp.id, mes, "num_funcionarios", v)}
                          canEdit={canEdit}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-center">{formatCurrency(valorFuncionarios)}</TableCell>
                      <TableCell className="text-center">
                        <ServicosExtrasPopover
                          items={mesData.servicos_extras_items ?? []}
                          totalValue={mesData.servicos_extras}
                          canEdit={canEdit}
                          onSave={(items) => {
                            const total = items.reduce((sum, i) => sum + i.valor, 0);
                            onUpdateMes(emp.id, mes, {
                              servicos_extras: total,
                              servicos_extras_items: items,
                            } as any);
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-center font-bold text-primary">{formatCurrency(totalMes)}</TableCell>
                      <TableCell className="text-xs text-center">
                        {emp.nao_emitir_boleto ? (
                          <span className="text-destructive font-medium">Não</span>
                        ) : (
                          <span className="text-muted-foreground">Sim</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <InlineTextCell
                          value={mesData.data_pagamento}
                          onCommit={(v) => onUpdateMes(emp.id, mes, "data_pagamento", v)}
                          canEdit={canEdit}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-center">{emp.emitir_nf || "—"}</TableCell>
                      {canEdit && (
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(emp)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm({ id: emp.id, nome: emp.empresa_nome })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <CustomFixedScrollbar
          targetRef={containerRef}
          watch={`${mes}-${empresas.length}`}
        />
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteConfirm?.nome}</strong> do módulo de honorários? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirm) {
                  onDelete(deleteConfirm.id);
                  setDeleteConfirm(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
