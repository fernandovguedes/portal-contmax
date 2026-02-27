import { useState } from "react";
import { useSyncAcessorias, SyncJob } from "@/hooks/useSyncAcessorias";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RefreshCw, Loader2, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Wifi } from "lucide-react";
import { format, formatDistanceStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SyncPanelProps {
  tenantSlug: string;
  tenantId: string;
  onSyncComplete?: () => void;
}

function StatusBadgeSync({ status }: { status: string }) {
  if (status === "success")
    return <Badge className="bg-success/15 text-success border-success/30 gap-1"><CheckCircle2 className="h-3 w-3" /> OK</Badge>;
  if (status === "failed")
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Erro</Badge>;
  return <Badge className="bg-warning/15 text-warning border-warning/30 gap-1"><Clock className="h-3 w-3" /> Executando</Badge>;
}

function duration(job: SyncJob) {
  if (!job.finished_at) return "—";
  return formatDistanceStrict(new Date(job.started_at), new Date(job.finished_at), { locale: ptBR });
}

export function SyncPanel({ tenantSlug, tenantId, onSyncComplete }: SyncPanelProps) {
  const { syncing, result, error, history, triggerSync, pingSync, pingResult, pinging, functionUrl } = useSyncAcessorias(tenantSlug, tenantId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const lastSync = history[0];

  const handleConfirm = async () => {
    setConfirmOpen(false);
    await triggerSync();
    onSyncComplete?.();
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={syncing}
            size="sm"
          >
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {syncing ? "Sincronizando..." : "Sincronizar com Acessorias"}
          </Button>
          <Button
            onClick={pingSync}
            disabled={pinging}
            size="sm"
            variant="outline"
          >
            {pinging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}
            Ping
          </Button>
          {lastSync && (
            <span className="text-xs text-muted-foreground">
              Última sync: {format(new Date(lastSync.started_at), "dd/MM HH:mm")}
            </span>
          )}
        </div>

      {result && (
          <div className="flex items-center gap-2 text-xs">
            <StatusBadgeSync status={result.status} />
            <span>Lidos: {result.total_read}</span>
            <span className="text-success">+{result.total_created}</span>
            <span className="text-warning">~{result.total_updated}</span>
            <span className="text-muted-foreground">={result.total_skipped}</span>
            {result.total_errors > 0 && <span className="text-destructive">✕{result.total_errors}</span>}
            {result.status === "running" && <span className="text-muted-foreground animate-pulse">• atualizando a cada 3s</span>}
          </div>
        )}
      </div>

      {/* Ping result */}
      {pingResult && (
        <div className="rounded-md border border-success/30 bg-success/5 p-2 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3 w-3 text-success" />
            <span className="font-medium text-success">Conectividade OK</span>
          </div>
          <div className="text-muted-foreground">
            URL: <code className="bg-muted px-1 rounded text-[10px]">{pingResult.url}</code>
          </div>
          <div className="text-muted-foreground">
            Timestamp: {pingResult.timestamp}
          </div>
        </div>
      )}

      {/* Error with details */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <XCircle className="h-3 w-3 text-destructive" />
            <span className="font-medium text-destructive">
              {error.status ? `Erro ${error.status}` : "Erro"}: {error.message}
            </span>
          </div>
          {error.detail && (
            <div className="text-muted-foreground">
              Detalhe: {error.detail}
            </div>
          )}
          <div className="text-muted-foreground">
            URL: <code className="bg-muted px-1 rounded text-[10px]">{functionUrl}</code>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1 px-0">
              Histórico de Sincronizações
              {historyOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-md border mt-2 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Lidos</TableHead>
                    <TableHead className="text-center">Criados</TableHead>
                    <TableHead className="text-center">Atualizados</TableHead>
                    <TableHead className="text-center">Ignorados</TableHead>
                    <TableHead className="text-center">Erros</TableHead>
                    <TableHead>Duração</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((job) => (
                    <TableRow key={job.id} className="text-xs">
                      <TableCell>{format(new Date(job.started_at), "dd/MM HH:mm")}</TableCell>
                      <TableCell><StatusBadgeSync status={job.status} /></TableCell>
                      <TableCell className="text-center">{job.total_read}</TableCell>
                      <TableCell className="text-center">{job.total_created}</TableCell>
                      <TableCell className="text-center">{job.total_updated}</TableCell>
                      <TableCell className="text-center">{job.total_skipped}</TableCell>
                      <TableCell className="text-center">{job.total_errors}</TableCell>
                      <TableCell>{duration(job)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Sincronização</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja iniciar a sincronização com o Acessorias? O processo pode levar alguns segundos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Sincronizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
