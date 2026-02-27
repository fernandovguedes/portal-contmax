import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ComparativoData, TaxQuarterly, TaxMonthly } from "@/types/comparativo";
import { formatBRL } from "@/lib/formatUtils";

interface Props {
  data: ComparativoData;
}

function sumQ(q: TaxQuarterly) {
  return q.q1 + q.q2 + q.q3 + q.q4;
}
function sumM(m: TaxMonthly) {
  return Object.values(m).reduce((a, b) => a + b, 0);
}

export function ComparativoTable({ data }: Props) {
  const rows = [
    { label: "IR", presumido: sumQ(data.lucroPresumido.ir), real: sumQ(data.lucroReal.ir) },
    { label: "CSLL", presumido: sumQ(data.lucroPresumido.csll), real: sumQ(data.lucroReal.csll) },
    { label: "PIS", presumido: sumM(data.lucroPresumido.pis), real: sumM(data.lucroReal.pis) },
    { label: "COFINS", presumido: sumM(data.lucroPresumido.cofins), real: sumM(data.lucroReal.cofins) },
    { label: "TOTAL", presumido: data.lucroPresumido.total, real: data.lucroReal.total, isTotal: true },
  ];

  return (
    <Card className="chart-card overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tabela Detalhada</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow className="header-gradient border-none">
              <TableHead className="text-primary-foreground font-semibold">Tributo</TableHead>
              <TableHead className="text-primary-foreground font-semibold text-right">Lucro Presumido</TableHead>
              <TableHead className="text-primary-foreground font-semibold text-right">Lucro Real</TableHead>
              <TableHead className="text-primary-foreground font-semibold text-right">Diferença</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const diff = r.presumido - r.real;
              return (
                <TableRow
                  key={r.label}
                  className={`transition-colors hover:bg-muted/10 ${r.isTotal ? "font-bold bg-primary/5 border-t-2 border-primary/20" : ""}`}
                >
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(r.presumido)}</TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(r.real)}</TableCell>
                  <TableCell className="text-right">
                    {diff > 0 ? (
                      <Badge className="bg-success/15 text-success border-success/30 font-mono">
                        {formatBRL(diff)}
                      </Badge>
                    ) : (
                      <span className="font-mono">{formatBRL(diff)}</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
