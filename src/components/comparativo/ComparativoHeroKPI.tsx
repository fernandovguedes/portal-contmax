import type { ComparativoData } from "@/types/comparativo";
import { formatBRL } from "@/lib/formatUtils";

interface Props {
  data: ComparativoData;
}

export function ComparativoHeroKPI({ data }: Props) {
  return (
    <div className="rounded-2xl gradient-hero glow-gain border border-primary/10 p-8 sm:p-10 text-center animate-fade-in">
      <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-3">
        Economia Total Anual com a Migração
      </p>
      <p className="text-5xl sm:text-6xl font-black font-mono text-primary tracking-tight">
        {formatBRL(data.economiaTotal)}
      </p>
      <p className="text-lg text-muted-foreground mt-3">
        Redução de <span className="font-bold text-primary">{data.percentualReducao.toFixed(1)}%</span> na carga tributária
      </p>
    </div>
  );
}
