import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { ComparativoData } from "@/types/comparativo";
import { ChartTooltip } from "./CustomTooltip";

interface Props {
  data: ComparativoData;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

export function MonthlyPISCOFINSChart({ data }: Props) {
  const chartData = MONTH_KEYS.map((k, i) => ({
    name: MONTHS[i],
    "Presumido (PIS+COFINS)": data.lucroPresumido.pis[k] + data.lucroPresumido.cofins[k],
    "Real (PIS+COFINS)": data.lucroReal.pis[k] + data.lucroReal.cofins[k],
  }));

  return (
    <Card className="chart-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">PIS + COFINS — Mensal</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" className="text-xs" />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
            <Tooltip content={<ChartTooltip />} />
            <Legend />
            <Bar dataKey="Presumido (PIS+COFINS)" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Real (PIS+COFINS)" fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
