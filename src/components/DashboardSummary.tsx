import { Empresa, MesKey, MES_LABELS, isMesFechamentoTrimestre, MESES_FECHAMENTO_TRIMESTRE, calcularFaturamentoTrimestre } from "@/types/fiscal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, FileCheck, FileWarning, CheckCircle2 } from "lucide-react";

interface DashboardSummaryProps {
  empresas: Empresa[];
  mesSelecionado: MesKey;
}

const ICON_COLORS = {
  neutral: "from-primary/80 to-primary/50",
  warning: "from-amber-500 to-amber-400",
  success: "from-emerald-600 to-emerald-400",
  danger: "from-red-500 to-red-400",
};

export function DashboardSummary({ empresas, mesSelecionado }: DashboardSummaryProps) {
  const totalEmpresas = empresas.length;

  const extratosEnviados = empresas.filter(
    (e) => e.meses[mesSelecionado].extratoEnviado === "sim"
  ).length;

  const isFechamento = isMesFechamentoTrimestre(mesSelecionado);
  const mesFechamento = mesSelecionado as typeof MESES_FECHAMENTO_TRIMESTRE[number];

  const empresasComReinf = isFechamento
    ? empresas.filter((e) => calcularFaturamentoTrimestre(e, mesFechamento) > 0)
    : [];

  const reinfOk = empresasComReinf.filter((e) => e.obrigacoes[mesFechamento]?.reinf === "ok").length;
  const reinfPendente = empresasComReinf.length - reinfOk;

  const dcftOk = empresasComReinf.filter((e) => e.obrigacoes[mesFechamento]?.dcftWeb === "ok").length;
  const dcftPendente = empresasComReinf.length - dcftOk;

  const cards = [
    { 
      title: "Empresas", 
      value: totalEmpresas, 
      icon: Building2, 
      accent: false,
      gradient: ICON_COLORS.neutral,
      borderColor: "",
    },
    {
      title: `Extratos Enviados - ${MES_LABELS[mesSelecionado]}`,
      value: `${extratosEnviados} / ${totalEmpresas}`,
      icon: FileCheck,
      accent: extratosEnviados < totalEmpresas,
      gradient: extratosEnviados >= totalEmpresas ? ICON_COLORS.success : ICON_COLORS.warning,
      borderColor: extratosEnviados >= totalEmpresas ? "border-l-emerald-500" : "border-l-amber-500",
    },
  ];

  if (isFechamento) {
    cards.push(
      {
        title: `REINF - ${MES_LABELS[mesSelecionado]}`,
        value: `✅ ${reinfOk}  ⏳ ${reinfPendente}  (de ${empresasComReinf.length})`,
        icon: FileWarning,
        accent: reinfPendente > 0,
        gradient: reinfPendente > 0 ? ICON_COLORS.warning : ICON_COLORS.success,
        borderColor: reinfPendente > 0 ? "border-l-amber-500" : "border-l-emerald-500",
      },
      {
        title: `DCTFWeb - ${MES_LABELS[mesSelecionado]}`,
        value: `✅ ${dcftOk}  ⏳ ${dcftPendente}  (de ${empresasComReinf.length})`,
        icon: CheckCircle2,
        accent: dcftPendente > 0,
        gradient: dcftPendente > 0 ? ICON_COLORS.warning : ICON_COLORS.success,
        borderColor: dcftPendente > 0 ? "border-l-amber-500" : "border-l-emerald-500",
      },
    );
  }

  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isFechamento ? "lg:grid-cols-4" : ""} stagger-children`}>
      {cards.map((c) => (
        <Card key={c.title} className={`border-l-4 ${c.borderColor || "border-l-primary/40"} transition-all hover:shadow-md`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
            <div className={`rounded-full bg-gradient-to-br ${c.gradient} p-2 text-white shadow-sm`}>
              <c.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tracking-tight">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
