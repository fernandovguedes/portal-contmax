import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { useIntegrations, useIntegrationLogs } from "@/hooks/useIntegrations";
import { useIntegrationJobs } from "@/hooks/useIntegrationJobs";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, CheckCircle, XCircle, Clock, Activity, Loader2 } from "lucide-react";
import { formatDistanceToNow, format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  success: { label: "Sucesso", variant: "default" },
  running: { label: "Executando", variant: "secondary" },
  pending: { label: "Na fila", variant: "outline" },
  error: { label: "Erro", variant: "destructive" },
  canceled: { label: "Cancelado", variant: "outline" },
};

export default function IntegracaoDetalhe() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenant") ?? undefined;
  const navigate = useNavigate();
  const { user } = useAuth();

  const { integrations, loading, toggleIntegration } = useIntegrations(tenantId);
  const { logs, loading: logsLoading } = useIntegrationLogs(tenantId, slug, 100);
  const { getActiveJob, getJobsByProvider, submitJob, loading: jobsLoading } = useIntegrationJobs();

  const integration = integrations.find(
    (i) => (i.providerData?.slug ?? i.provider) === slug
  );

  const userName = user?.user_metadata?.nome || user?.email?.split("@")[0] || "";

  const activeJob = integration ? getActiveJob(integration.tenant_id, slug!) : undefined;
  const providerJobs = integration ? getJobsByProvider(integration.tenant_id, slug!) : [];

  // Metrics
  const metrics = useMemo(() => {
    const last30 = logs.filter(
      (l) => new Date(l.created_at) >= subDays(new Date(), 30)
    );
    const total = last30.length;
    const successes = last30.filter((l) => l.status === "success").length;
    const avgTime =
      last30.reduce((sum, l) => sum + (l.execution_time_ms ?? 0), 0) / (total || 1);

    const dailyMap = new Map<string, { success: number; error: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "dd/MM");
      dailyMap.set(d, { success: 0, error: 0 });
    }
    last30.forEach((l) => {
      const d = format(new Date(l.created_at), "dd/MM");
      const entry = dailyMap.get(d);
      if (entry) {
        if (l.status === "success") entry.success++;
        else entry.error++;
      }
    });

    return {
      total,
      successRate: total > 0 ? Math.round((successes / total) * 100) : 0,
      avgTime: Math.round(avgTime),
      chartData: Array.from(dailyMap.entries()).map(([date, v]) => ({ date, ...v })),
    };
  }, [logs]);

  if (loading || logsLoading || jobsLoading) return <LoadingSkeleton variant="portal" />;

  if (!integration) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader title="Integração não encontrada" showBack backTo="/integracoes" />
        <div className="text-center py-20 text-muted-foreground">
          Integração "{slug}" não encontrada para este tenant.
        </div>
      </div>
    );
  }

  const provider = integration.providerData;
  const name = provider?.name ?? integration.provider;
  const isProcessing = !!activeJob;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={name}
        subtitle={provider?.description ?? undefined}
        showBack
        backTo="/integracoes"
        userName={userName}
        breadcrumbs={[
          { label: "Integrações", href: "/integracoes" },
          { label: name },
        ]}
      />

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6 animate-slide-up">
        {/* Status + Toggle + Active Job */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Status</CardTitle>
            </CardHeader>
            <CardContent>
              {isProcessing ? (
                <div className="space-y-2">
                  <Badge variant="secondary" className="text-sm">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    {activeJob.status === "pending" ? "Na fila..." : "Processando..."}
                  </Badge>
                  <Progress value={activeJob.progress ?? 0} className="h-2" />
                  <p className="text-xs text-muted-foreground">{activeJob.progress ?? 0}%</p>
                </div>
              ) : (
                <>
                  <Badge
                    variant={STATUS_BADGE[integration.last_status ?? ""]?.variant ?? "outline"}
                    className="text-sm"
                  >
                    {STATUS_BADGE[integration.last_status ?? ""]?.label ?? "N/A"}
                  </Badge>
                  {integration.last_run && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(integration.last_run), { addSuffix: true, locale: ptBR })}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Taxa de Sucesso (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{metrics.successRate}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{metrics.total} execuções</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Tempo Médio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">
                  {metrics.avgTime > 1000 ? `${(metrics.avgTime / 1000).toFixed(1)}s` : `${metrics.avgTime}ms`}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Controle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={integration.is_enabled}
                  onCheckedChange={(checked) => toggleIntegration(integration.id, checked)}
                />
                <span className="text-sm">{integration.is_enabled ? "Ativo" : "Inativo"}</span>
              </div>
              <Button
                size="sm"
                onClick={() => submitJob(integration.tenant_id, provider?.slug ?? integration.provider)}
                disabled={!integration.is_enabled || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Play className="h-3 w-3 mr-1" />
                )}
                {isProcessing ? "Executando..." : "Executar Agora"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Error banner */}
        {integration.last_error && integration.last_status === "error" && !isProcessing && (
          <Card className="border-destructive/50">
            <CardContent className="py-3">
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{integration.last_error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs: Visão Geral + Execuções */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="executions">Execuções Recentes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Execuções — Últimos 30 dias
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={metrics.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="success" name="Sucesso" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="error" name="Erro" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Config */}
            {provider?.config_schema && (provider.config_schema as any[]).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Configuração</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(provider.config_schema as any[]).map((field: any) => (
                      <div key={field.key} className="flex items-center gap-4">
                        <span className="text-sm font-medium w-32">{field.label}</span>
                        <span className="text-sm text-muted-foreground">
                          {(integration.config as any)?.[field.key] ?? "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Configurações sensíveis (API Keys) são gerenciadas via secrets do backend.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Legacy Logs table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de Logs</CardTitle>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum log disponível.</p>
                ) : (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Processados</TableHead>
                          <TableHead className="text-right">Matched</TableHead>
                          <TableHead className="text-right">Tempo</TableHead>
                          <TableHead>Erro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.slice(0, 50).map((log) => {
                          const st = STATUS_BADGE[log.status] ?? { label: log.status, variant: "outline" as const };
                          return (
                            <TableRow key={log.id}>
                              <TableCell className="text-xs whitespace-nowrap">
                                {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                              </TableCell>
                              <TableCell className="text-right text-xs">{log.total_processados}</TableCell>
                              <TableCell className="text-right text-xs">{log.total_matched}</TableCell>
                              <TableCell className="text-right text-xs">
                                {log.execution_time_ms ? `${(log.execution_time_ms / 1000).toFixed(1)}s` : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-destructive max-w-[200px] truncate" title={log.error_message ?? undefined}>
                                {log.error_message ?? "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="executions">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Execuções Recentes (Job Queue)</CardTitle>
              </CardHeader>
              <CardContent>
                {providerJobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma execução via fila registrada.</p>
                ) : (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Progresso</TableHead>
                          <TableHead className="text-right">Tempo</TableHead>
                          <TableHead className="text-right">Tentativas</TableHead>
                          <TableHead>Erro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {providerJobs.map((job) => {
                          const st = STATUS_BADGE[job.status] ?? { label: job.status, variant: "outline" as const };
                          const isActive = job.status === "pending" || job.status === "running";
                          return (
                            <TableRow key={job.id}>
                              <TableCell className="text-xs whitespace-nowrap">
                                {format(new Date(job.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                <Badge variant={st.variant} className="text-xs">
                                  {isActive && <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />}
                                  {st.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="min-w-[100px]">
                                <Progress value={job.progress} className="h-1.5" />
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {job.execution_time_ms ? `${(job.execution_time_ms / 1000).toFixed(1)}s` : "—"}
                              </TableCell>
                              <TableCell className="text-right text-xs">{job.attempts}/{job.max_attempts}</TableCell>
                              <TableCell className="text-xs text-destructive max-w-[200px] truncate" title={job.error_message ?? undefined}>
                                {job.error_message ?? "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
