import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Empresa, MesKey, MES_LABELS } from "@/types/fiscal";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WhatsAppConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa: Empresa;
  mesSelecionado: MesKey;
  onConfirm: (opts?: { is_resend?: boolean; resend_reason?: string }) => Promise<void>;
  isResend?: boolean;
  sentInfo?: { sentAt: string; sentBy: string };
}

function buildMensagem(empresa: Empresa, mesSelecionado: MesKey): string {
  const competencia = `${MES_LABELS[mesSelecionado]}/2026`;
  return `Olá, ${empresa.nome}! Identificamos que o extrato de ${competencia} ainda não foi enviado. Pode nos encaminhar por aqui hoje?`;
}

export function WhatsAppConfirmDialog({ open, onOpenChange, empresa, mesSelecionado, onConfirm, isResend, sentInfo }: WhatsAppConfirmDialogProps) {
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [sending, setSending] = useState(false);
  const [dupCheckbox, setDupCheckbox] = useState(false);
  const [resendReason, setResendReason] = useState("");
  const mensagem = buildMensagem(empresa, mesSelecionado);

  const handleClose = (v: boolean) => {
    if (!v) {
      setEtapa(1);
      setSending(false);
      setDupCheckbox(false);
      setResendReason("");
    }
    onOpenChange(v);
  };

  const handleEnviar = async () => {
    setSending(true);
    try {
      await onConfirm(isResend ? { is_resend: true, resend_reason: resendReason || undefined } : undefined);
      handleClose(false);
    } catch {
      setSending(false);
    }
  };

  const sentDate = sentInfo ? format(new Date(sentInfo.sentAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isResend ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <MessageCircle className="h-5 w-5 text-green-600" />
            )}
            {isResend ? "Reenviar WhatsApp" : "Enviar WhatsApp"}
          </DialogTitle>
          <DialogDescription>
            {etapa === 1
              ? "Confirme o envio da mensagem de cobrança de extrato."
              : etapa === 2
              ? "Revise a mensagem antes de enviar."
              : "Confirme que deseja reenviar."}
          </DialogDescription>
        </DialogHeader>

        {etapa === 1 ? (
          <>
            {isResend && sentInfo && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Mensagem já enviada em {sentDate} por {sentInfo.sentBy}.</span>
              </div>
            )}
            <p className="text-sm text-foreground">
              Você deseja enviar a mensagem de cobrança de extrato para <strong>{empresa.nome}</strong>?
            </p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button onClick={() => setEtapa(2)}>Continuar</Button>
            </DialogFooter>
          </>
        ) : etapa === 2 ? (
          <>
            <div className="rounded-lg border bg-muted/50 p-3 text-sm whitespace-pre-wrap">
              {mensagem}
            </div>
            <p className="text-xs text-muted-foreground">
              Para: {empresa.whatsapp || "Não cadastrado"}
            </p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setEtapa(1)}>Voltar</Button>
              {isResend ? (
                <Button onClick={() => setEtapa(3)}>Continuar</Button>
              ) : (
                <Button onClick={handleEnviar} disabled={sending} className="bg-green-600 hover:bg-green-700 text-white">
                  {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : "Enviar"}
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox checked={dupCheckbox} onCheckedChange={(v) => setDupCheckbox(!!v)} className="mt-0.5" />
                <span>Entendo que pode gerar mensagem duplicada para esta empresa.</span>
              </label>
              <div>
                <label className="text-xs text-muted-foreground">Motivo do reenvio (opcional)</label>
                <Textarea
                  value={resendReason}
                  onChange={(e) => setResendReason(e.target.value)}
                  placeholder="Ex: cliente solicitou novo envio..."
                  className="mt-1 h-16"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setEtapa(2)} disabled={sending}>Voltar</Button>
              <Button onClick={handleEnviar} disabled={sending || !dupCheckbox} className="bg-amber-500 hover:bg-amber-600 text-white">
                {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : "Reenviar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
