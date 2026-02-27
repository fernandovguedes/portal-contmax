import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { ComparativoData, TaxQuarterly, TaxMonthly } from "@/types/comparativo";
import { ChartTooltip } from "./CustomTooltip";

interface Props {
  data: ComparativoData;
}

function sumQuarterly(q: TaxQuarterly) {
  return q.q1 + q.q2 + q.q3 + q.q4;
}

function sumMonthly(m: TaxMonthly) {
  return Object.values(m).reduce((a, b) => a + b, 0);
}

export function TaxBreakdownChart({ data }: Props) {
  const chartData = [
    { name: "IR", Presumido: sumQuarterly(data.lucroPresumido.ir), Real: sumQuarterly(data.lucroReal.ir) },
    { name: "CSLL", Presumido: sumQuarterly(data.lucroPresumido.csll), Real: sumQuarterly(data.lucroReal.csll) },
    { name: "PIS", Presumido: sumMonthly(data.lucroPresumido.pis), Real: sumMonthly(data.lucroReal.pis) },
    { name: "COFINS", Presumido: sumMonthly(data.lucroPresumido.cofins), Real: sumMonthly(data.lucroReal.cofins) },
  ];

  return (
    <Card className="chart-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Composição por Tributo</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" className="text-xs" />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
            <Tooltip content={<ChartTooltip />} />
            <Legend />
            <Bar dataKey="Presumido" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Real" fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
