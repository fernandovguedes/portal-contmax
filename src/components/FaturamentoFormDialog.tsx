import { useState } from "react";
import { Empresa, MesKey, MES_LABELS, StatusExtrato, StatusQuestor, NotaFiscal, calcularFaturamento } from "@/types/fiscal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronDown, ChevronUp, Receipt } from "lucide-react";

interface FaturamentoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa: Empresa;
  mesSelecionado: MesKey;
  onUpdate: (id: string, data: Partial<Empresa>) => void;
}

export function FaturamentoFormDialog({
  open,
  onOpenChange,
  empresa,
  mesSelecionado,
  onUpdate,
}: FaturamentoFormDialogProps) {
  const m = mesSelecionado;
  const dadosIniciais = empresa.meses[m];

  // Garante retrocompatibilidade: se não há notasFiscais mas há valor, cria array inicial
  const notasIniciais: NotaFiscal[] =
    dadosIniciais.notasFiscais && dadosIniciais.notasFiscais.length > 0
      ? dadosIniciais.notasFiscais
      : dadosIniciais.faturamentoNotaFiscal > 0
      ? [{ id: crypto.randomUUID(), valor: dadosIniciais.faturamentoNotaFiscal, descricao: "" }]
      : [];

  const [mesData, setMesData] = useState({ ...dadosIniciais, notasFiscais: notasIniciais });
  const [notasExpandidas, setNotasExpandidas] = useState(true);

  // ─── Helpers para campos simples ───────────────────────────────────────────
  const updateField = (field: string, value: number | StatusExtrato | StatusQuestor) => {
    setMesData((prev) => {
      const updated = { ...prev, [field]: value };
      if (typeof value === "number") {
        return calcularFaturamento({
          ...updated,
          // faturamentoNotaFiscal será recalculado dentro de calcularFaturamento
          // a partir de notasFiscais, se houver
        });
      }
      return updated;
    });
  };

  // ─── Helpers para notas fiscais ────────────────────────────────────────────
  const adicionarNota = () => {
    const novas: NotaFiscal[] = [
      ...(mesData.notasFiscais || []),
      { id: crypto.randomUUID(), valor: 0, descricao: "" },
    ];
    recalcularComNotas(novas);
  };

  const removerNota = (id: string) => {
    const novas = (mesData.notasFiscais || []).filter((n) => n.id !== id);
    recalcularComNotas(novas);
  };

  const atualizarNota = (id: string, campo: keyof NotaFiscal, valor: string | number) => {
    const novas = (mesData.notasFiscais || []).map((n) =>
      n.id === id ? { ...n, [campo]: valor } : n
    );
    recalcularComNotas(novas);
  };

  const recalcularComNotas = (notas: NotaFiscal[]) => {
    setMesData((prev) => {
      const updated = { ...prev, notasFiscais: notas };
      return calcularFaturamento(updated);
    });
  };

  // ─── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    onUpdate(empresa.id, {
      meses: { ...empresa.meses, [m]: mesData },
    });
    onOpenChange(false);
  };

  // ─── Totais para exibição ──────────────────────────────────────────────────
  const totalNF = (mesData.notasFiscais || []).reduce((s, n) => s + (n.valor || 0), 0);
  const qtdNotas = (mesData.notasFiscais || []).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Faturamento {MES_LABELS[m]} — {empresa.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Envio do Extrato Bancário</Label>
              <Select
                value={mesData.extratoEnviado}
                onValueChange={(v) => updateField("extratoEnviado", v as StatusExtrato)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">✅ Sim</SelectItem>
                  <SelectItem value="nao">❌ Não</SelectItem>
                  <SelectItem value="sem_faturamento">➖ Sem Faturamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Lançado no Questor</Label>
              <Select
                value={mesData.lancadoQuestor}
                onValueChange={(v) => updateField("lancadoQuestor", v as StatusQuestor)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ok">✅ OK</SelectItem>
                  <SelectItem value="sem_faturamento">➖ Sem Faturamento</SelectItem>
                  <SelectItem value="pendente">❌ Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fat. Nacional, Exterior, Aluguéis */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fat. Nacional (R$)</Label>
              <Input
                type="number"
                value={mesData.faturamentoNacional || ""}
                onChange={(e) => updateField("faturamentoNacional", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fat. Exterior (R$)</Label>
              <Input
                type="number"
                value={mesData.faturamentoExterior || ""}
                onChange={(e) => updateField("faturamentoExterior", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fat. Aluguéis (R$)</Label>
              <Input
                type="number"
                value={mesData.faturamentoAlugueis || ""}
                onChange={(e) => updateField("faturamentoAlugueis", Number(e.target.value))}
              />
            </div>
          </div>

          {/* ── Seção de Notas Fiscais ── */}
          <div className="rounded-lg border border-border overflow-hidden">
            {/* Cabeçalho da seção */}
            <button
              type="button"
              onClick={() => setNotasExpandidas((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-medium"
            >
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <span>Notas Fiscais</span>
                {qtdNotas > 0 && (
                  <span className="bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
                    {qtdNotas} {qtdNotas === 1 ? "nota" : "notas"} ·{" "}
                    {totalNF.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                )}
              </div>
              {notasExpandidas ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {notasExpandidas && (
              <div className="p-3 space-y-2">
                {(mesData.notasFiscais || []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Nenhuma nota fiscal adicionada.
                  </p>
                )}

                {(mesData.notasFiscais || []).map((nf, idx) => (
                  <div key={nf.id} className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground mt-2">
                      {idx + 1}
                    </div>
                    <div className="flex-1 grid grid-cols-[130px_1fr_auto] gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                        <Input
                          type="number"
                          placeholder="0,00"
                          value={nf.valor || ""}
                          onChange={(e) => atualizarNota(nf.id, "valor", Number(e.target.value))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Referente a</Label>
                        <Input
                          type="text"
                          placeholder="Ex: Serviços contábeis mensais"
                          value={nf.descricao}
                          onChange={(e) => atualizarNota(nf.id, "descricao", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-end pb-0.5">
                        <button
                          type="button"
                          onClick={() => removerNota(nf.id)}
                          className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={adicionarNota}
                  className="w-full mt-1 border-dashed text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar Nota Fiscal
                </Button>
              </div>
            )}
          </div>

          {/* Totais */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
            <p className="text-sm text-muted-foreground">
              <strong>Total:</strong>{" "}
              <span className="font-semibold text-foreground">
                {mesData.faturamentoTotal.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Distribuição Lucros (75%):</strong>{" "}
              <span className="font-semibold text-accent">
                {mesData.distribuicaoLucros.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
