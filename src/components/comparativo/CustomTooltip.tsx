import { formatBRL } from "@/lib/formatUtils";

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface Props {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

export function ChartTooltip({ active, payload, label }: Props) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-card/95 backdrop-blur-sm px-4 py-3 shadow-lg">
      <p className="text-xs font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">{formatBRL(p.value)}</span>
        </div>
      ))}
    </div>
  );
}
