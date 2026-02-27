import { Socio, calcularDistribuicaoSocios, MES_LABELS, MesKey } from "@/types/fiscal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DetalheMensal {
  mes: MesKey;
  faturamento: number;
  distribuicao: number;
}

interface DistribuicaoSociosPopoverProps {
  socios: Socio[];
  distribuicaoTotal: number;
  label?: string;
  isTrimestral?: boolean;
  detalhesMensais?: DetalheMensal[];
}

const LIMITE_ALERTA = 50000;

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DistribuicaoSociosPopover({ socios, distribuicaoTotal, label, isTrimestral, detalhesMensais }: DistribuicaoSociosPopoverProps) {
  const sociosComDistribuicao = calcularDistribuicaoSocios(socios, distribuicaoTotal);
  const temAlerta = sociosComDistribuicao.some(s => (s.distribuicaoLucros ?? 0) > LIMITE_ALERTA);

  if (distribuicaoTotal === 0) {
    return (
      <span className="text-muted-foreground text-sm">R$ 0,00</span>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={`h-auto p-1 gap-2 font-medium ${isTrimestral ? "text-primary" : "text-accent"} hover:text-accent`}>
          {formatCurrency(distribuicaoTotal)}
          {temAlerta ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <Users className="h-3.5 w-3.5 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">
              {isTrimestral ? "Distribuição Trimestral por Sócio" : "Distribuição por Sócio"}
            </h4>
            <span className="text-xs text-muted-foreground">75% do faturamento</span>
          </div>

          {/* Detalhamento mensal no trimestre */}
          {isTrimestral && detalhesMensais && detalhesMensais.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-2 space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-1">Detalhamento por mês</p>
              {detalhesMensais.map((d) => (
                <div key={d.mes} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{MES_LABELS[d.mes]}</span>
                  <div className="flex gap-3">
                    <span className="text-muted-foreground">Fat: {formatCurrency(d.faturamento)}</span>
                    <span className="font-medium">Dist: {formatCurrency(d.distribuicao)}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                <span className="font-medium">Total trimestre</span>
                <div className="flex gap-3">
                  <span className="text-muted-foreground font-medium">Fat: {formatCurrency(detalhesMensais.reduce((s, d) => s + d.faturamento, 0))}</span>
                  <span className="font-semibold text-primary">Dist: {formatCurrency(distribuicaoTotal)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {sociosComDistribuicao.map((socio, i) => {
              const valor = socio.distribuicaoLucros ?? 0;
              const acima50k = valor > LIMITE_ALERTA;
              return (
                <div 
                  key={i} 
                  className={`flex items-center justify-between p-2 rounded-md ${acima50k ? "bg-destructive/10 border border-destructive/20" : "bg-muted/50"}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{socio.nome || "Sócio sem nome"}</p>
                    <p className="text-xs text-muted-foreground">{socio.percentual}% · CPF: {socio.cpf || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${acima50k ? "text-destructive" : "text-foreground"}`}>
                      {formatCurrency(valor)}
                    </p>
                    {acima50k && (
                      <p className="text-xs text-destructive flex items-center gap-1 justify-end">
                        <AlertTriangle className="h-3 w-3" /> Acima de R$ 50k
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pt-2 border-t flex justify-between text-sm">
            <span className="text-muted-foreground">Total {isTrimestral ? "trimestral" : "distribuído"}:</span>
            <span className={`font-semibold ${isTrimestral ? "text-primary" : "text-accent"}`}>
              {formatCurrency(distribuicaoTotal)}
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
