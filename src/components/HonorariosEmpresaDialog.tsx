import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { HonorarioEmpresa, MesKey } from "@/hooks/useHonorarios";
import { MES_LABELS } from "@/hooks/useHonorarios";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresasDisponiveis: { id: string; nome: string }[];
  editingEmpresa?: HonorarioEmpresa | null;
  onSave: (data: {
    empresa_id: string;
    fiscal_percentual: number;
    contabil_percentual: number;
    pessoal_valor: number;
    emitir_nf: string;
    nao_emitir_boleto: boolean;
    mes_inicial: string;
  }) => Promise<boolean>;
  onUpdate?: (id: string, data: Partial<{
    fiscal_percentual: number;
    contabil_percentual: number;
    pessoal_valor: number;
    emitir_nf: string;
    nao_emitir_boleto: boolean;
    mes_inicial: string;
  }>) => Promise<void>;
}

export function HonorariosEmpresaDialog({ open, onOpenChange, empresasDisponiveis, editingEmpresa, onSave, onUpdate }: Props) {
  const [empresaId, setEmpresaId] = useState("");
  const [fiscal, setFiscal] = useState("");
  const [contabil, setContabil] = useState("");
  const [pessoal, setPessoal] = useState("");
  const [emitirNf, setEmitirNf] = useState("");
  const [naoEmitirBoleto, setNaoEmitirBoleto] = useState(false);
  const [mesInicial, setMesInicial] = useState<MesKey>("janeiro");
  const [saving, setSaving] = useState(false);

  const isEditing = !!editingEmpresa;

  useEffect(() => {
    if (editingEmpresa) {
      setEmpresaId(editingEmpresa.empresa_id);
      setFiscal(editingEmpresa.fiscal_percentual.toString());
      setContabil(editingEmpresa.contabil_percentual.toString());
      setPessoal(editingEmpresa.pessoal_valor.toString());
      setEmitirNf(editingEmpresa.emitir_nf);
      setNaoEmitirBoleto(editingEmpresa.nao_emitir_boleto);
      setMesInicial(editingEmpresa.mes_inicial || "janeiro");
    } else {
      setEmpresaId("");
      setFiscal("");
      setContabil("");
      setPessoal("");
      setEmitirNf("");
      setNaoEmitirBoleto(false);
      setMesInicial("janeiro");
    }
  }, [editingEmpresa, open]);

  const handleSave = async () => {
    const fiscalNum = parseFloat(fiscal.replace(",", ".")) || 0;
    const contabilNum = parseFloat(contabil.replace(",", ".")) || 0;
    const pessoalNum = parseFloat(pessoal.replace(",", ".")) || 0;

    setSaving(true);
    if (isEditing && onUpdate) {
      await onUpdate(editingEmpresa.id, {
        fiscal_percentual: fiscalNum,
        contabil_percentual: contabilNum,
        pessoal_valor: pessoalNum,
        emitir_nf: emitirNf,
        nao_emitir_boleto: naoEmitirBoleto,
        mes_inicial: mesInicial,
      });
      onOpenChange(false);
    } else {
      if (!empresaId) { setSaving(false); return; }
      const ok = await onSave({
        empresa_id: empresaId,
        fiscal_percentual: fiscalNum,
        contabil_percentual: contabilNum,
        pessoal_valor: pessoalNum,
        emitir_nf: emitirNf,
        nao_emitir_boleto: naoEmitirBoleto,
        mes_inicial: mesInicial,
      });
      if (ok) onOpenChange(false);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Empresa" : "Cadastrar Empresa"}</DialogTitle>
          <DialogDescription>
            {isEditing ? `Editando: ${editingEmpresa.empresa_nome}` : "Selecione uma empresa da base Contmax e preencha os dados."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!isEditing && (
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {empresasDisponiveis.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Fiscal %</Label>
              <Input value={fiscal} onChange={(e) => setFiscal(e.target.value)} placeholder="55" />
            </div>
            <div className="space-y-2">
              <Label>Contábil %</Label>
              <Input value={contabil} onChange={(e) => setContabil(e.target.value)} placeholder="70" />
            </div>
            <div className="space-y-2">
              <Label>Pessoal R$</Label>
              <Input value={pessoal} onChange={(e) => setPessoal(e.target.value)} placeholder="41" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Emitir NF</Label>
              <Input value={emitirNf} onChange={(e) => setEmitirNf(e.target.value)} placeholder="SIM, SIM MUZYKANT, etc." />
            </div>
            <div className="space-y-2">
              <Label>Mês Inicial</Label>
              <Select value={mesInicial} onValueChange={(v) => setMesInicial(v as MesKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MES_LABELS) as MesKey[]).filter(m => m !== "fechamento").map((m) => (
                    <SelectItem key={m} value={m}>{MES_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={naoEmitirBoleto} onCheckedChange={(v) => setNaoEmitirBoleto(!!v)} />
            <span className="text-sm">Não Emitir Boleto</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{isEditing ? "Salvar" : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
