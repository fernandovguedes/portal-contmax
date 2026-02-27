import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Empresa, MesKey, MES_LABELS } from "@/types/fiscal";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { getCompetenciaAtual } from "@/lib/formatUtils";
import type { WhatsAppLogInfo } from "@/hooks/useWhatsAppLogs";

interface BatchResult {
  empresaId: string;
  to: string;
  success: boolean;
  error: string | null;
  ticketId: string | null;
  empresaNome?: string;
}

interface WhatsAppBatchConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresas: Empresa[];
  mesSelecionado: MesKey;
  onComplete: () => void;
  whatsappLogs?: Map<string, WhatsAppLogInfo>;
}

type Step = "confirm1" | "confirm2" | "sending" | "done";

export function WhatsAppBatchConfirmDialog({ open, onOpenChange, empresas, mesSelecionado, onComplete, whatsappLogs }: WhatsAppBatchConfirmDialogProps) {
  const [step, setStep] = useState<Step>("confirm1");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [dupCheckbox, setDupCheckbox] = useState(false);
  const [resendReason, setResendReason] = useState("");

  const competencia = `${MES_LABELS[mesSelecionado]}/2026`;
  const templateMsg = `Olá, {empresa}! Identificamos que o extrato de ${competencia} ainda não foi enviado. Pode nos encaminhar por aqui hoje?`;

  const resendEmpresas = empresas.filter((e) => whatsappLogs?.has(e.id));
  const hasResends = resendEmpresas.length > 0;

  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;

  const handleClose = (openState: boolean) => {
    if (step === "sending") return;
    if (!openState) {
      setStep("confirm1");
      setProgress(0);
      setResults([]);
      setShowDetails(false);
      setDupCheckbox(false);
      setResendReason("");
      onOpenChange(false);
    }
  };

  const handleSend = async () => {
    setStep("sending");
    setProgress(0);

    const compAtual = getCompetenciaAtual(mesSelecionado);

    const items = empresas.map((e) => ({
      empresaId: e.id,
      to: e.whatsapp!,
      body: `Olá, ${e.nome}! Identificamos que o extrato de ${competencia} ainda não foi enviado. Pode nos encaminhar por aqui hoje?`,
      is_resend: whatsappLogs?.has(e.id) || false,
      resend_reason: whatsappLogs?.has(e.id) ? (resendReason || undefined) : undefined,
    }));

    const total = items.length;
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress = Math.min(currentProgress + (90 / total), 90);
      setProgress(currentProgress);
    }, 800);

    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-batch", {
        body: { items, ticketStrategy: "create", closeAfterSend: true, competencia: compAtual, message_type: "extrato_nao_enviado" },
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error || !data?.results) {
        setResults(items.map((item) => ({
          empresaId: item.empresaId,
          to: item.to,
          success: false,
          error: error?.message || "Falha na comunicação",
          ticketId: null,
          empresaNome: empresas.find((e) => e.id === item.empresaId)?.nome,
        })));
      } else {
        setResults(
          data.results.map((r: any) => ({
            ...r,
            empresaNome: empresas.find((e) => e.id === r.empresaId)?.nome,
          }))
        );
      }
    } catch {
      clearInterval(progressInterval);
      setProgress(100);
      setResults(items.map((item) => ({
        empresaId: item.empresaId,
        to: item.to,
        success: false,
        error: "Erro inesperado",
        ticketId: null,
        empresaNome: empresas.find((e) => e.id === item.empresaId)?.nome,
      })));
    }

    setStep("done");
  };

  const canProceedToSend = !hasResends || dupCheckbox;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "confirm1" && "Envio em lote de WhatsApp"}
            {step === "confirm2" && "Confirmar envio"}
            {step === "sending" && "Enviando mensagens..."}
            {step === "done" && "Resumo do envio"}
          </DialogTitle>
          <DialogDescription>
            {step === "confirm1" && `Você deseja enviar mensagem de cobrança para ${empresas.length} empresa${empresas.length !== 1 ? "s" : ""}?`}
            {step === "confirm2" && `Confirmar envio de ${empresas.length} mensagen${empresas.length !== 1 ? "s" : ""} agora?`}
            {step === "sending" && "Aguarde enquanto as mensagens são enviadas."}
            {step === "done" && "Confira o resultado do envio abaixo."}
          </DialogDescription>
        </DialogHeader>

        {step === "confirm1" && (
          <>
            {hasResends && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{resendEmpresas.length} empresa{resendEmpresas.length !== 1 ? "s" : ""} já recebeu mensagem neste mês.</span>
              </div>
            )}
            <ScrollArea className="max-h-60">
              <ul className="space-y-1 text-sm">
                {empresas.map((e) => {
                  const isResend = whatsappLogs?.has(e.id);
                  return (
                    <li key={e.id} className="flex justify-between items-center py-1 border-b last:border-0">
                      <span className="flex items-center gap-1.5 truncate mr-2">
                        {isResend && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                        {e.nome}
                      </span>
                      <span className="text-muted-foreground text-xs whitespace-nowrap">{e.whatsapp}</span>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button onClick={() => setStep("confirm2")}>Continuar</Button>
            </DialogFooter>
          </>
        )}

        {step === "confirm2" && (
          <>
            <div className="rounded-md border p-3 bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Template:</p>
              <p className="text-sm italic">{templateMsg}</p>
            </div>

            {hasResends && (
              <div className="space-y-3">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <Checkbox checked={dupCheckbox} onCheckedChange={(v) => setDupCheckbox(!!v)} className="mt-0.5" />
                  <span>Entendo que pode gerar mensagens duplicadas para {resendEmpresas.length} empresa{resendEmpresas.length !== 1 ? "s" : ""}.</span>
                </label>
                <div>
                  <label className="text-xs text-muted-foreground">Motivo do reenvio (opcional)</label>
                  <Textarea
                    value={resendReason}
                    onChange={(e) => setResendReason(e.target.value)}
                    placeholder="Ex: prazo final de entrega..."
                    className="mt-1 h-16"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("confirm1")}>Voltar</Button>
              <Button
                className={hasResends ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
                onClick={handleSend}
                disabled={!canProceedToSend}
              >
                Enviar
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "sending" && (
          <div className="space-y-3 py-4">
            <Progress value={progress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">
              Enviando {Math.min(Math.ceil((progress / 100) * empresas.length), empresas.length)}/{empresas.length}...
            </p>
          </div>
        )}

        {step === "done" && (
          <>
            <div className="flex gap-4 justify-center py-2">
              <div className="flex items-center gap-1.5 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">{successCount} sucesso{successCount !== 1 ? "s" : ""}</span>
              </div>
              {errorCount > 0 && (
                <div className="flex items-center gap-1.5 text-destructive">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">{errorCount} erro{errorCount !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>

            <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
              {showDetails ? "Ocultar detalhes" : "Ver detalhes"}
            </Button>

            {showDetails && (
              <ScrollArea className="max-h-48">
                <ul className="space-y-1 text-sm">
                  {results.map((r, i) => (
                    <li key={i} className="flex items-center gap-2 py-1 border-b last:border-0">
                      {r.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <span className="truncate">{r.empresaNome || r.to}</span>
                      {r.error && <span className="text-xs text-destructive ml-auto">{r.error}</span>}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}

            <DialogFooter>
              <Button onClick={() => { handleClose(false); onComplete(); }}>Fechar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
