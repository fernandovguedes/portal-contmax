import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IrpfDependentesEditor } from "./IrpfDependentesEditor";
import type { IrpfCase, IrpfDependente } from "@/types/irpf";

interface Props {
  caseData: IrpfCase;
  onChange: (field: string, value: any) => void;
  disabled?: boolean;
}

const ESTADOS_CIVIS = [
  { value: "Solteiro", label: "Solteiro(a)" },
  { value: "Casado", label: "Casado(a)" },
  { value: "Divorciado", label: "Divorciado(a)" },
  { value: "Viúvo", label: "Viúvo(a)" },
  { value: "União Estável", label: "União Estável" },
];

export function IrpfInformacoesContribuinte({ caseData, onChange, disabled }: Props) {
  const showConjuge = caseData.estadoCivil === "Casado" || caseData.estadoCivil === "União Estável";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Informações do Contribuinte</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Senha gov.br</Label>
            <Input
              value={caseData.senhaGovbr || ""}
              onChange={e => onChange("senhaGovbr", e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>Estado civil</Label>
            <Select
              value={caseData.estadoCivil || ""}
              onValueChange={v => onChange("estadoCivil", v)}
              disabled={disabled}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {ESTADOS_CIVIS.map(ec => (
                  <SelectItem key={ec.value} value={ec.value}>{ec.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showConjuge && (
            <div className="space-y-2">
              <Label>CPF do cônjuge</Label>
              <Input
                value={caseData.cpfConjuge || ""}
                onChange={e => onChange("cpfConjuge", e.target.value)}
                disabled={disabled}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Valores recebidos com apostas em {caseData.anoBase}</Label>
            <Input
              value={caseData.valorApostas || ""}
              onChange={e => onChange("valorApostas", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Endereço completo</Label>
          <Textarea
            value={caseData.enderecoCompleto || ""}
            onChange={e => onChange("enderecoCompleto", e.target.value)}
            disabled={disabled}
            rows={2}
          />
        </div>

        <IrpfDependentesEditor
          dependentes={caseData.dependentes || []}
          onChange={(deps: IrpfDependente[]) => onChange("dependentes", deps)}
          disabled={disabled}
        />
      </CardContent>
    </Card>
  );
}
