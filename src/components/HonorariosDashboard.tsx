import { Building2, DollarSign, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { HonorarioEmpresa, MesKey, HonorarioMesData } from "@/hooks/useHonorarios";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  empresas: HonorarioEmpresa[];
  mes: MesKey;
  calcularValores: (emp: HonorarioEmpresa, mes: MesKey) => { totalMes: number };
  getMesData: (emp: HonorarioEmpresa, mes: MesKey) => HonorarioMesData;
}

export function HonorariosDashboard({ empresas, mes, calcularValores, getMesData }: Props) {
  const totalEmpresas = empresas.length;
  const totalMes = empresas.reduce((s, e) => s + calcularValores(e, mes).totalMes, 0);

  const pagas = empresas.filter((e) => !!getMesData(e, mes).data_pagamento);
  const totalPago = pagas.reduce((s, e) => s + calcularValores(e, mes).totalMes, 0);

  const cards = [
    {
      label: "Total Empresas",
      value: String(totalEmpresas),
      icon: Building2,
      border: "border-l-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300",
    },
    {
      label: "Total Mês",
      value: fmt(totalMes),
      icon: DollarSign,
      border: "border-l-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300",
    },
    {
      label: "Total Pago",
      value: fmt(totalPago),
      sub: `${pagas.length} de ${totalEmpresas}`,
      icon: CheckCircle2,
      border: "border-l-violet-500",
      bg: "bg-violet-50 dark:bg-violet-950/30",
      iconBg: "bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-300",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label} className={`border-l-4 ${c.border} ${c.bg}`}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.iconBg}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
              <p className="text-lg font-bold">{c.value}</p>
              {c.sub && <p className="text-xs text-muted-foreground">{c.sub}</p>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
