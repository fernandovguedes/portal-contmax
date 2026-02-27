import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { Building2, TrendingUp, UserPlus, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const ORGS = [
  { value: "all", label: "Todas" },
  { value: "d84e2150-0ae0-4462-880c-da8cec89e96a", label: "Contmax" },
  { value: "30e6da4c-ed58-47ce-8a83-289b58ca15ab", label: "P&G" },
] as const;

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
];

const REGIME_LABELS: Record<string, string> = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
  mei: "MEI",
  imune: "Imune/Isenta",
};

interface EmpresaLight {
  id: string;
  data_cadastro: string;
  regime_tributario: string;
  data_baixa: string | null;
  organizacao_id: string;
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key: string) {
  const [y, m] = key.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m) - 1]}/${y.slice(2)}`;
}

export default function DashboardExecutivo() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState("all");
  const [empresas, setEmpresas] = useState<EmpresaLight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      let query = supabase
        .from("empresas")
        .select("id, data_cadastro, regime_tributario, data_baixa, organizacao_id");

      if (orgId !== "all") {
        query = query.eq("organizacao_id", orgId);
      }

      const { data } = await query;
      setEmpresas((data as EmpresaLight[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, [orgId]);

  const now = new Date();
  const currentMonthKey = getMonthKey(now);
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = getMonthKey(prevMonth);

  const ativas = useMemo(() => empresas.filter((e) => !e.data_baixa), [empresas]);
  const novosAtual = useMemo(
    () => empresas.filter((e) => e.data_cadastro.startsWith(currentMonthKey)).length,
    [empresas, currentMonthKey]
  );
  const novosAnterior = useMemo(
    () => empresas.filter((e) => e.data_cadastro.startsWith(prevMonthKey)).length,
    [empresas, prevMonthKey]
  );
  const crescimento = novosAnterior > 0 ? ((novosAtual - novosAnterior) / novosAnterior) * 100 : null;

  // Regime distribution
  const regimeData = useMemo(() => {
    const map: Record<string, number> = {};
    ativas.forEach((e) => {
      const key = e.regime_tributario || "outros";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([regime, count]) => ({ regime: REGIME_LABELS[regime] || regime, count }))
      .sort((a, b) => b.count - a.count);
  }, [ativas]);

  // Monthly growth - last 12 months
  const monthlyData = useMemo(() => {
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(getMonthKey(d));
    }
    const map: Record<string, number> = {};
    months.forEach((m) => (map[m] = 0));
    empresas.forEach((e) => {
      const key = e.data_cadastro.substring(0, 7);
      if (map[key] !== undefined) map[key]++;
    });
    return months.map((m) => ({ month: formatMonthLabel(m), count: map[m] }));
  }, [empresas]);

  const userName = user?.user_metadata?.nome || user?.email?.split("@")[0] || "";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Dashboard Executivo"
        subtitle="Relatório Gerencial"
        showBack
        backTo="/"
        userName={userName}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 animate-slide-up space-y-8">
        {/* Org selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Organização:</span>
          <Select value={orgId} onValueChange={setOrgId}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORGS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <LoadingSkeleton variant="dashboard" />
        ) : empresas.length === 0 ? (
          <div className="text-center py-20">
            <LayoutDashboard className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground">Nenhum dado disponível</h2>
            <p className="text-sm text-muted-foreground mt-2">Selecione outra organização ou aguarde a sincronização.</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid gap-5 sm:grid-cols-3 stagger-children">
              <Card className="card-variant-neutral overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total de Empresas Ativas</CardTitle>
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{ativas.length.toLocaleString("pt-BR")}</p>
                </CardContent>
              </Card>

              <Card className="card-variant-gain overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Novos Clientes no Mês</CardTitle>
                    <UserPlus className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{novosAtual}</p>
                </CardContent>
              </Card>

              <Card className="card-variant-gold overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Crescimento vs Mês Anterior</CardTitle>
                    <TrendingUp className="h-5 w-5 text-accent-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">
                    {crescimento !== null ? `${crescimento > 0 ? "+" : ""}${crescimento.toFixed(1)}%` : "—"}
                  </p>
                  {novosAnterior === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Sem dados do mês anterior</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Regime distribution */}
              <Card className="chart-card">
                <CardHeader>
                  <CardTitle className="text-base">Distribuição por Regime Tributário</CardTitle>
                </CardHeader>
                <CardContent>
                  {regimeData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={regimeData}
                          dataKey="count"
                          nameKey="regime"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ regime, count }) => `${regime}: ${count}`}
                          labelLine
                        >
                          {regimeData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Monthly growth */}
              <Card className="chart-card">
                <CardHeader>
                  <CardTitle className="text-base">Novos Cadastros por Mês (Últimos 12 meses)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="count" name="Novos cadastros" radius={[4, 4, 0, 0]}>
                        {monthlyData.map((_, i) => (
                          <Cell key={i} fill="hsl(var(--chart-1))" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
