import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { ComparativoData } from "@/types/comparativo";
import { ChartTooltip } from "./CustomTooltip";

interface Props {
  data: ComparativoData;
}

const QUARTERS = ["1º Tri", "2º Tri", "3º Tri", "4º Tri"] as const;
const KEYS: ("q1" | "q2" | "q3" | "q4")[] = ["q1", "q2", "q3", "q4"];

export function QuarterlyComparisonChart({ data }: Props) {
  const chartData = KEYS.map((k, i) => ({
    name: QUARTERS[i],
    "Presumido (IR+CSLL)": data.lucroPresumido.ir[k] + data.lucroPresumido.csll[k],
    "Real (IR+CSLL)": data.lucroReal.ir[k] + data.lucroReal.csll[k],
  }));

  return (
    <Card className="chart-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">IR + CSLL — Trimestral</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" className="text-xs" />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
            <Tooltip content={<ChartTooltip />} />
            <Legend />
            <Bar dataKey="Presumido (IR+CSLL)" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Real (IR+CSLL)" fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
