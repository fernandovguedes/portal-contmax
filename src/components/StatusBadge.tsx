import { cn } from "@/lib/utils";
import { StatusEntrega, StatusExtrato, StatusQuestor } from "@/types/fiscal";
import { CheckCircle2, XCircle, Minus, FileCheck, FileX, FileMinus } from "lucide-react";

interface StatusBadgeProps {
  status: StatusEntrega;
  className?: string;
}

const config: Record<StatusEntrega, { label: string; icon: typeof CheckCircle2; colorClass: string }> = {
  ok: { label: "OK", icon: CheckCircle2, colorClass: "text-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)]" },
  pendente: { label: "Pendente", icon: XCircle, colorClass: "text-destructive bg-destructive/10" },
  nao_aplicavel: { label: "N/A", icon: Minus, colorClass: "text-muted-foreground bg-muted" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, icon: Icon, colorClass } = config[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", colorClass, className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

interface ExtratoBadgeProps {
  status: StatusExtrato;
  className?: string;
}

const extratoConfig: Record<StatusExtrato, { label: string; icon: typeof CheckCircle2; colorClass: string }> = {
  sim: { label: "Enviado", icon: FileCheck, colorClass: "text-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)]" },
  nao: { label: "Não Enviado", icon: FileX, colorClass: "text-destructive bg-destructive/10" },
  sem_faturamento: { label: "Sem Fat.", icon: FileMinus, colorClass: "text-muted-foreground bg-muted" },
};

export function ExtratoBadge({ status, className }: ExtratoBadgeProps) {
  const safeStatus = status && extratoConfig[status] ? status : "nao";
  const { label, icon: Icon, colorClass } = extratoConfig[safeStatus];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", colorClass, className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

interface QuestorBadgeProps {
  status: StatusQuestor;
  className?: string;
}

const questorConfig: Record<StatusQuestor, { label: string; icon: typeof CheckCircle2; colorClass: string }> = {
  ok: { label: "OK", icon: CheckCircle2, colorClass: "text-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)]" },
  sem_faturamento: { label: "Sem Fat.", icon: FileMinus, colorClass: "text-muted-foreground bg-muted" },
  pendente: { label: "Pendente", icon: XCircle, colorClass: "text-destructive bg-destructive/10" },
};

export function QuestorBadge({ status, className }: QuestorBadgeProps) {
  const safeStatus = status && questorConfig[status] ? status : "pendente";
  const { label, icon: Icon, colorClass } = questorConfig[safeStatus];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", colorClass, className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
