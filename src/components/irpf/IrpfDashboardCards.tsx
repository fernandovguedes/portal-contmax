import { Card, CardContent } from "@/components/ui/card";
import { Users, Clock, FileText, CheckCircle } from "lucide-react";
import type { IrpfCase } from "@/types/irpf";

interface Props {
  cases: IrpfCase[];
}

export function IrpfDashboardCards({ cases }: Props) {
  const total = cases.length;
  const aguardando = cases.filter(c => c.status === "aguardando_docs").length;
  const emAndamento = cases.filter(c => c.status === "em_andamento").length;
  const finalizados = cases.filter(c => ["entregue", "aguardando_pgto", "finalizado"].includes(c.status)).length;

  const cards = [
    { label: "Total Declarações", value: total, icon: Users, className: "border-l-4 border-l-primary" },
    { label: "Aguardando Docs", value: aguardando, icon: Clock, className: "border-l-4 border-l-yellow-500" },
    { label: "Em Andamento", value: emAndamento, icon: FileText, className: "border-l-4 border-l-blue-500" },
    { label: "Finalizados", value: finalizados, icon: CheckCircle, className: "border-l-4 border-l-green-500" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
      {cards.map((c) => (
        <Card key={c.label} className={c.className}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-muted/30 p-2.5">
              <c.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
