import { Empresa, MESES_FECHAMENTO_TRIMESTRE, calcularFaturamentoTrimestre } from "@/types/fiscal";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ReinfAlertProps {
  empresa: Empresa;
  mesFechamento: typeof MESES_FECHAMENTO_TRIMESTRE[number];
}

export function ReinfAlert({ empresa, mesFechamento }: ReinfAlertProps) {
  const faturamentoTrimestre = calcularFaturamentoTrimestre(empresa, mesFechamento);
  const deveEntregar = faturamentoTrimestre > 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          {deveEntregar ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          )}
        </TooltipTrigger>
        <TooltipContent>
          {deveEntregar ? (
            <div className="text-xs">
               <p className="font-semibold text-destructive">⚠️ REINF obrigatória</p>
              <p>Faturamento trimestral: {faturamentoTrimestre.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
              <p className="text-muted-foreground">DCTFWeb também será exigida</p>
            </div>
          ) : (
            <p className="text-xs">Sem faturamento no trimestre - REINF não obrigatória</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
