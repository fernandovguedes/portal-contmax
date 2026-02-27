import { useState } from "react";
import { Empresa, MesKey, MES_LABELS, StatusExtrato, StatusQuestor, MesesData, calcularFaturamento } from "@/types/fiscal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FaturamentoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa: Empresa;
  mesSelecionado: MesKey;
  onUpdate: (id: string, data: Partial<Empresa>) => void;
}

export function FaturamentoFormDialog({ open, onOpenChange, empresa, mesSelecionado, onUpdate }: FaturamentoFormDialogProps) {
  const m = mesSelecionado;
  const [mesData, setMesData] = useState({ ...empresa.meses[m] });

  const updateField = (field: string, value: number | StatusExtrato | StatusQuestor) => {
    setMesData((prev) => {
      const updated = { ...prev, [field]: value };
      if (typeof value === "number") {
        return calcularFaturamento({
          extratoEnviado: updated.extratoEnviado,
          faturamentoNacional: updated.faturamentoNacional,
          faturamentoNotaFiscal: updated.faturamentoNotaFiscal,
          faturamentoExterior: updated.faturamentoExterior,
          faturamentoAlugueis: updated.faturamentoAlugueis || 0,
          lancadoQuestor: updated.lancadoQuestor,
        });
      }
      return updated;
    });
  };

  const handleSave = () => {
    onUpdate(empresa.id, {
      meses: { ...empresa.meses, [m]: mesData },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Faturamento {MES_LABELS[m]} — {empresa.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Envio do Extrato Bancário</Label>
              <Select value={mesData.extratoEnviado} onValueChange={(v) => updateField("extratoEnviado", v as StatusExtrato)}>
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
              <Select value={mesData.lancadoQuestor} onValueChange={(v) => updateField("lancadoQuestor", v as StatusQuestor)}>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fat. Nacional (R$)</Label>
              <Input type="number" value={mesData.faturamentoNacional || ""} onChange={(e) => updateField("faturamentoNacional", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fat. Nota Fiscal (R$)</Label>
              <Input type="number" value={mesData.faturamentoNotaFiscal || ""} onChange={(e) => updateField("faturamentoNotaFiscal", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fat. Exterior (R$)</Label>
              <Input type="number" value={mesData.faturamentoExterior || ""} onChange={(e) => updateField("faturamentoExterior", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fat. Aluguéis (R$)</Label>
              <Input type="number" value={mesData.faturamentoAlugueis || ""} onChange={(e) => updateField("faturamentoAlugueis", Number(e.target.value))} />
            </div>
          </div>
          <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
            <p className="text-sm text-muted-foreground">
              <strong>Total:</strong> <span className="font-semibold text-foreground">{mesData.faturamentoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Distribuição Lucros (75%):</strong> <span className="font-semibold text-accent">{mesData.distribuicaoLucros.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
