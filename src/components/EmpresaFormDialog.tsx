import { useState } from "react";
import { Empresa, MesKey, MES_LABELS, Socio, StatusExtrato, StatusQuestor, MesesData, ObrigacoesData, calcularFaturamento, RegimeTributario, REGIME_LABELS } from "@/types/fiscal";
// Note: Faturamento mensal is now handled by FaturamentoFormDialog
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";

interface EmpresaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa?: Empresa | null;
  onSave: (data: Omit<Empresa, "id" | "dataCadastro">) => void;
  onUpdate: (id: string, data: Partial<Empresa>) => void;
}

const emptyMes = () => ({
  extratoEnviado: "nao" as StatusExtrato,
  faturamentoNacional: 0,
  faturamentoNotaFiscal: 0,
  faturamentoExterior: 0,
  faturamentoAlugueis: 0,
  faturamentoTotal: 0,
  distribuicaoLucros: 0,
  lancadoQuestor: "pendente" as StatusQuestor,
});

const createEmptyMeses = (): MesesData => ({
  janeiro: emptyMes(), fevereiro: emptyMes(), marco: emptyMes(),
  abril: emptyMes(), maio: emptyMes(), junho: emptyMes(),
  julho: emptyMes(), agosto: emptyMes(), setembro: emptyMes(),
  outubro: emptyMes(), novembro: emptyMes(), dezembro: emptyMes(),
});

const emptyObrigacoes = () => ({
  lancamentoFiscal: "pendente" as const,
  reinf: "pendente" as const,
  dcftWeb: "pendente" as const,
  mit: "pendente" as const,
});

const createEmptyObrigacoes = (): ObrigacoesData => ({
  marco: emptyObrigacoes(),
  junho: emptyObrigacoes(),
  setembro: emptyObrigacoes(),
  dezembro: emptyObrigacoes(),
});

export function EmpresaFormDialog({ open, onOpenChange, empresa, onSave, onUpdate }: EmpresaFormDialogProps) {
  const isEditing = !!empresa;

  const [nome, setNome] = useState(empresa?.nome ?? "");
  const [numero, setNumero] = useState<number | "">(empresa?.numero ?? "");
  const [cnpj, setCnpj] = useState(empresa?.cnpj ?? "");
  const [inicioCompetencia, setInicioCompetencia] = useState(empresa?.inicioCompetencia ?? "");
  const [emiteNotaFiscal, setEmiteNotaFiscal] = useState(empresa?.emiteNotaFiscal ?? true);
  const [regimeTributario, setRegimeTributario] = useState<RegimeTributario>(empresa?.regimeTributario ?? "simples_nacional");
  const [socios, setSocios] = useState<Socio[]>(empresa?.socios ?? [{ nome: "", percentual: 100, cpf: "" }]);
  const [whatsapp, setWhatsapp] = useState(empresa?.whatsapp ?? "");
  const [meses] = useState<MesesData>(empresa?.meses ?? createEmptyMeses());

  const handleSave = () => {
    const data = {
      numero: typeof numero === "number" ? numero : 0,
      nome,
      cnpj,
      inicioCompetencia,
      regimeTributario,
      emiteNotaFiscal,
      whatsapp,
      socios,
      meses,
      obrigacoes: empresa?.obrigacoes ?? createEmptyObrigacoes(),
    };
    if (isEditing && empresa) {
      onUpdate(empresa.id, data);
    } else {
      onSave(data);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Número no Questor</Label>
              <Input type="number" value={numero} onChange={(e) => setNumero(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 123" />
            </div>
            <div className="space-y-2">
              <Label>Nome da Empresa</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Razão social" />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-2">
              <Label>Início da Competência</Label>
              <Input type="date" value={inicioCompetencia} onChange={(e) => setInicioCompetencia(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="5511999999999" />
              <p className="text-xs text-muted-foreground">Formato: 55 + DDD + Número (sem espaços)</p>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={emiteNotaFiscal} onCheckedChange={setEmiteNotaFiscal} id="emite-nf" />
              <Label htmlFor="emite-nf">Emite Nota Fiscal</Label>
            </div>
            <div className="space-y-2">
              <Label>Regime Tributário</Label>
              <Select value={regimeTributario} onValueChange={(v) => setRegimeTributario(v as RegimeTributario)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                  <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                  <SelectItem value="lucro_real">Lucro Real</SelectItem>
                  <SelectItem value="mei">MEI</SelectItem>
                  <SelectItem value="imunidade_tributaria">Imunidade Tributária</SelectItem>
                  <SelectItem value="pessoa_fisica">Pessoa Física</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sócios */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Sócios</Label>
              <Button variant="ghost" size="sm" onClick={() => setSocios((s) => [...s, { nome: "", percentual: 0, cpf: "" }])}>
                <Plus className="mr-1 h-3 w-3" /> Adicionar
              </Button>
            </div>
            {socios.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_140px_32px] gap-2 items-end">
                <Input placeholder="Nome" value={s.nome} onChange={(e) => {
                  const copy = [...socios]; copy[i] = { ...copy[i], nome: e.target.value }; setSocios(copy);
                }} />
                <Input placeholder="%" type="number" value={s.percentual || ""} onChange={(e) => {
                  const copy = [...socios]; copy[i] = { ...copy[i], percentual: Number(e.target.value) }; setSocios(copy);
                }} />
                <Input placeholder="CPF" value={s.cpf} onChange={(e) => {
                  const copy = [...socios]; copy[i] = { ...copy[i], cpf: e.target.value }; setSocios(copy);
                }} />
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setSocios((s) => s.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>{isEditing ? "Salvar" : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
