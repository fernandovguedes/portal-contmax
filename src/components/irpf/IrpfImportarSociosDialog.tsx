import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  orgSlug: string;
  anoBase: number;
  onImport: (opts: { createCases: boolean }) => Promise<{ created: number; skipped: number; casesCreated: number }>;
}

export function IrpfImportarSociosDialog({ open, onOpenChange, tenantId, orgSlug, anoBase, onImport }: Props) {
  const [loading, setLoading] = useState(false);
  const [counting, setCounting] = useState(false);
  const [totalSocios, setTotalSocios] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [createCases, setCreateCases] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ created: number; skipped: number; casesCreated: number } | null>(null);

  const countNew = useCallback(async () => {
    if (!tenantId) return;
    setCounting(true);
    try {
      // Get all socios from view
      const { data: socios } = await supabase
        .from("pg_socios_view")
        .select("socio_cpf")
        .eq("tenant_id", tenantId);

      const uniqueCpfs = [...new Set((socios || []).map(s => s.socio_cpf).filter(Boolean))];
      setTotalSocios(uniqueCpfs.length);

      // Get existing CPFs
      const { data: existing } = await supabase
        .from("irpf_people")
        .select("cpf")
        .eq("tenant_id", tenantId);

      const existingCpfs = new Set((existing || []).map(e => e.cpf));
      const newCpfs = uniqueCpfs.filter(cpf => !existingCpfs.has(cpf!));
      setNewCount(newCpfs.length);
    } catch (e) {
      console.error("Error counting socios:", e);
    } finally {
      setCounting(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (open) {
      setResult(null);
      setProgress(0);
      setCreateCases(true);
      countNew();
    }
  }, [open, countNew]);

  const handleImport = async () => {
    setImporting(true);
    setProgress(10);
    try {
      const res = await onImport({ createCases });
      setProgress(100);
      setResult(res);
    } catch (e: any) {
      console.error("Import error:", e);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Sócios</DialogTitle>
          <DialogDescription>
            Importar sócios das empresas {orgSlug === "contmax" ? "Contmax" : "P&G"} para o módulo IRPF.
          </DialogDescription>
        </DialogHeader>

        {counting ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Contando sócios...</span>
          </div>
        ) : result ? (
          <div className="space-y-2 py-4">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              ✅ Importação concluída!
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• {result.created} pessoa(s) importada(s)</li>
              <li>• {result.skipped} já existia(m)</li>
              {result.casesCreated > 0 && (
                <li>• {result.casesCreated} declaração(ões) criada(s) para {anoBase}</li>
              )}
            </ul>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="text-sm space-y-1">
              <p>Total de CPFs únicos na base: <strong>{totalSocios}</strong></p>
              <p>Novos (ainda não cadastrados): <strong>{newCount}</strong></p>
              {newCount === 0 && (
                <p className="text-muted-foreground mt-2">Todos os sócios já foram importados.</p>
              )}
            </div>

            {newCount > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="create-cases"
                  checked={createCases}
                  onCheckedChange={(v) => setCreateCases(v === true)}
                />
                <label htmlFor="create-cases" className="text-sm cursor-pointer">
                  Criar declarações para {anoBase}
                </label>
              </div>
            )}

            {importing && (
              <Progress value={progress} className="h-2" />
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          ) : (
            <Button
              onClick={handleImport}
              disabled={importing || newCount === 0}
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar {newCount} sócio(s)
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
