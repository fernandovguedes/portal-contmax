import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertTriangle, MinusCircle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { HonorarioEmpresa, MesKey } from "@/hooks/useHonorarios";

interface Props {
  empresas: HonorarioEmpresa[];
  mes: MesKey;
  calcularValores: (empresa: HonorarioEmpresa, mes: MesKey) => { totalMes: number };
  canEdit: boolean;
}

const MES_TO_NUM: Record<string, string> = {
  janeiro: "01", fevereiro: "02", marco: "03", abril: "04",
  maio: "05", junho: "06", julho: "07", agosto: "08",
  setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};

interface SyncResult {
  portal_company_id: string;
  status: string;
  message?: string;
  bc_invoice_id?: number;
}

interface SyncSummary {
  total: number;
  synced: number;
  unchanged: number;
  not_found: number;
  warning_multiple: number;
  failed: number;
}

export function BomControleSyncButton({ empresas, mes, calcularValores, canEdit }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [results, setResults] = useState<SyncResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit || mes === "fechamento") return null;

  const monthNum = MES_TO_NUM[mes];
  if (!monthNum) return null;

  const competencia = `2026-${monthNum}`;

  const handleSync = async () => {
    setConfirmOpen(false);
    setSyncing(true);
    setError(null);

    try {
      const items = empresas.map((emp) => ({
        portal_company_id: emp.empresa_id,
        valor_total_mes: calcularValores(emp, mes).totalMes,
      }));

      const { data, error: fnError } = await supabase.functions.invoke("sync-bomcontrole", {
        body: { tenant_id: "contmax", competencia, items },
        headers: { "Content-Type": "application/json" },
      });

      if (fnError) throw fnError;

      setSummary(data.summary);
      setResults(data.results);
      setResultOpen(true);
    } catch (err: any) {
      setError(err.message || String(err));
      setResultOpen(true);
    } finally {
      setSyncing(false);
    }
  };

  const empresaNames = Object.fromEntries(empresas.map((e) => [e.empresa_id, e.empresa_nome]));

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={syncing}
      >
        {syncing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
        {syncing ? "Sincronizando..." : "Sync BomControle"}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sincronizar com BomControle</AlertDialogTitle>
            <AlertDialogDescription>
              Atualizar os valores de <strong>{empresas.length}</strong> faturas no BomControle para a competência <strong>{competencia}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSync}>Sincronizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resultado da Sincronização</DialogTitle>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <XCircle className="inline h-4 w-4 mr-1" /> {error}
            </div>
          )}

          {summary && (
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="secondary">{summary.total} total</Badge>
              <Badge className="bg-success/15 text-success border-success/30">{summary.synced} sincronizados</Badge>
              <Badge variant="outline">{summary.unchanged} sem alteração</Badge>
              {summary.not_found > 0 && <Badge variant="outline" className="text-muted-foreground">{summary.not_found} não encontrados</Badge>}
              {summary.warning_multiple > 0 && <Badge className="bg-warning/15 text-warning border-warning/30">{summary.warning_multiple} múltiplas faturas</Badge>}
              {summary.failed > 0 && <Badge variant="destructive">{summary.failed} erros</Badge>}
            </div>
          )}

          {results.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Empresa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results
                    .filter((r) => r.status !== "synced" && r.status !== "unchanged")
                    .map((r, i) => (
                      <TableRow key={i} className="text-xs">
                        <TableCell className="font-medium truncate max-w-[200px]">
                          {empresaNames[r.portal_company_id] || r.portal_company_id}
                        </TableCell>
                        <TableCell>
                          <StatusIcon status={r.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.message || "—"}</TableCell>
                      </TableRow>
                    ))}
                  {results.filter((r) => r.status !== "synced" && r.status !== "unchanged").length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground text-xs py-4">
                        Todas as empresas sincronizadas com sucesso
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "synced":
      return <Badge className="bg-success/15 text-success border-success/30 gap-1"><CheckCircle2 className="h-3 w-3" /> OK</Badge>;
    case "unchanged":
      return <Badge variant="outline" className="gap-1"><MinusCircle className="h-3 w-3" /> Igual</Badge>;
    case "not_found":
      return <Badge variant="outline" className="text-muted-foreground gap-1"><MinusCircle className="h-3 w-3" /> Não encontrada</Badge>;
    case "warning_multiple":
      return <Badge className="bg-warning/15 text-warning border-warning/30 gap-1"><AlertTriangle className="h-3 w-3" /> Múltiplas</Badge>;
    case "failed":
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Erro</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
