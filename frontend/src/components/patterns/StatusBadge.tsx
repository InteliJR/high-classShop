import { cn } from "../../lib/utils";

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  SCHEDULING: { label: "Agendamento", dot: "bg-status-sched" },
  NEGOTIATION: { label: "Negociação", dot: "bg-status-neg" },
  PROCESSING_CONTRACT: { label: "Contrato", dot: "bg-status-proc" },
  DOCUMENTATION: { label: "Documentação", dot: "bg-status-doc" },
  COMPLETED: { label: "Concluído", dot: "bg-status-ok" },
  REJECTED: { label: "Rejeitado", dot: "bg-status-bad" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-border-soft px-2.5 py-1 text-xs font-semibold text-ink-soft",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config?.dot ?? "bg-subtle")} />
      {config?.label ?? status}
    </span>
  );
}
