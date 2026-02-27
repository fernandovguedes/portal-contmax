import { AppHeader } from "@/components/AppHeader";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { useIntegrations, IntegrationWithProvider } from "@/hooks/useIntegrations";
import { useIntegrationJobs } from "@/hooks/useIntegrationJobs";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Settings, ScrollText, Plug, Loader2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORY_LABELS: Record<string, string> = {
  fiscal: "Fiscal",
  financeiro: "Financeiro",
  messaging: "Mensageria",
  banking: "Bancário",
  general: "Geral",
};

function IntegrationCard({
  integration,
  onRun,
  onNavigate,
  activeJob,
  latestJob,
}: {
  integration: IntegrationWithProvider;
  onRun: () => void;
  onNavigate: () => void;
  activeJob?: any;
  latestJob?: any;
}) {
  const provider = integration.providerData;
  const baseName = provider?.name ?? integration.provider;
  const name = integration.tenantName ? `${baseName} ${integration.tenantName}` : baseName;
  const category = provider?.category ?? "general";

  const isProcessing = !!activeJob;
  const lastJobFailed = !isProcessing && latestJob?.status === "error";
  const lastJobSuccess = !isProcessing && latestJob?.status === "success";

  let statusBadge: { label: string; variant: "default" | "secondary" | "destructive" | "outline" };
  if (isProcessing) {
    statusBadge = { label: activeJob.status === "pending" ? "Na fila..." : "Processando...", variant: "secondary" };
  } else if (lastJobFailed) {
    statusBadge = { label: "Falha", variant: "destructive" };
  } else if (lastJobSuccess) {
    statusBadge = { label: "Concluído", variant: "default" };
  } else if (integration.last_status === "success") {
    statusBadge = { label: "Ativo", variant: "default" };
  } else if (integration.last_status === "error") {
    statusBadge = { label: "Erro", variant: "destructive" };
  } else {
    statusBadge = { label: integration.is_enabled ? "Configurado" : "Desativado", variant: "outline" };
  }

  return (
    <Card className="card-hover accent-bar-left overflow-hidden border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-primary to-primary/70 p-2.5 text-primary-foreground shadow-md">
              <Plug className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[category] ?? category}</p>
            </div>
          </div>
          <Badge variant={statusBadge.variant}>
            {isProcessing && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {statusBadge.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {provider?.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{provider.description}</p>
        )}

        {/* Progress bar for active jobs */}
        {isProcessing && (
          <div className="space-y-1">
            <Progress value={activeJob.progress ?? 0} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">{activeJob.progress ?? 0}%</p>
          </div>
        )}

        {integration.last_run && !isProcessing && (
          <p className="text-xs text-muted-foreground">
            Última execução:{" "}
            {formatDistanceToNow(new Date(integration.last_run), { addSuffix: true, locale: ptBR })}
          </p>
        )}

        {/* Error from last job */}
        {lastJobFailed && latestJob.error_message && (
          <div className="flex items-start gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
            <p className="text-xs text-destructive truncate" title={latestJob.error_message}>
              {latestJob.error_message}
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="default" onClick={onRun} disabled={!integration.is_enabled || isProcessing}>
            {isProcessing ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Play className="h-3 w-3 mr-1" />
            )}
            {isProcessing ? "Executando..." : "Executar"}
          </Button>
          <Button size="sm" variant="outline" onClick={onNavigate}>
            <Settings className="h-3 w-3 mr-1" /> Configurar
          </Button>
          <Button size="sm" variant="ghost" onClick={onNavigate}>
            <ScrollText className="h-3 w-3 mr-1" /> Logs
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Integracoes() {
  const { user } = useAuth();
  const { integrations, loading } = useIntegrations();
  const { getActiveJob, getLatestJob, submitJob, loading: jobsLoading } = useIntegrationJobs();
  const navigate = useNavigate();

  const userName = user?.user_metadata?.nome || user?.email?.split("@")[0] || "";

  if (loading || jobsLoading) return <LoadingSkeleton variant="portal" />;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Integrações"
        subtitle="Gerenciamento central de integrações API"
        showBack
        backTo="/"
        userName={userName}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 animate-slide-up">
        {integrations.length === 0 ? (
          <div className="text-center py-20">
            <Plug className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground">Nenhuma integração configurada</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Nenhuma integração foi configurada para seus tenants.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {integrations.map((integ) => {
              const providerSlug = integ.providerData?.slug ?? integ.provider;
              return (
                <IntegrationCard
                  key={integ.id}
                  integration={integ}
                  activeJob={getActiveJob(integ.tenant_id, providerSlug)}
                  latestJob={getLatestJob(integ.tenant_id, providerSlug)}
                  onRun={() => submitJob(integ.tenant_id, providerSlug)}
                  onNavigate={() =>
                    navigate(`/integracoes/${providerSlug}?tenant=${integ.tenant_id}`)
                  }
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
