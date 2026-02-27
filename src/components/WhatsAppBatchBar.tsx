import { Button } from "@/components/ui/button";
import { MessageCircle, X, Eye } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MesKey, MES_LABELS } from "@/types/fiscal";

interface WhatsAppBatchBarProps {
  selectedCount: number;
  mesSelecionado: MesKey;
  onSend: () => void;
  onClear: () => void;
}

export function WhatsAppBatchBar({ selectedCount, mesSelecionado, onSend, onClear }: WhatsAppBatchBarProps) {
  if (selectedCount === 0) return null;

  const competencia = `${MES_LABELS[mesSelecionado]}/2026`;
  const templateMsg = `Olá, {empresa}! Identificamos que o extrato de ${competencia} ainda não foi enviado. Pode nos encaminhar por aqui hoje?`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card shadow-lg">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3">
        <span className="text-sm font-medium">
          {selectedCount} empresa{selectedCount !== 1 ? "s" : ""} selecionada{selectedCount !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="mr-1 h-4 w-4" />
                Pré-visualizar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <p className="text-xs text-muted-foreground mb-1">Template da mensagem:</p>
              <p className="text-sm italic">{templateMsg}</p>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={onClear}>
            <X className="mr-1 h-4 w-4" />
            Limpar seleção
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={onSend}>
            <MessageCircle className="mr-1 h-4 w-4" />
            Enviar WhatsApp ({selectedCount})
          </Button>
        </div>
      </div>
    </div>
  );
}
