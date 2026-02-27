import { DadosMensais } from "@/types/fiscal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface FaturamentoPopoverProps {
  dados: DadosMensais;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FaturamentoPopover({ dados }: FaturamentoPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-right font-medium hover:underline cursor-pointer underline-offset-2 decoration-dashed">
          {fmt(dados.faturamentoTotal)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Detalhamento</p>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nacional</span>
            <span className="font-medium">{fmt(dados.faturamentoNacional)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nota Fiscal</span>
            <span className="font-medium">{fmt(dados.faturamentoNotaFiscal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Exterior</span>
            <span className="font-medium">{fmt(dados.faturamentoExterior)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Aluguéis</span>
            <span className="font-medium">{fmt(dados.faturamentoAlugueis || 0)}</span>
          </div>
          <div className="border-t pt-1.5 flex justify-between font-semibold">
            <span>Total</span>
            <span>{fmt(dados.faturamentoTotal)}</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
