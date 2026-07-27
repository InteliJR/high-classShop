import { cn } from "../../lib/utils";

// Status de PROPOSTA (não confundir com status de PROCESSO — StatusBadge).
// Mesma receita visual (pílula neutra + ponto de cor) por consistência,
// reaproveitando os mesmos tokens de status já usados no processo:
// PENDING → âmbar (aguardando, como NEGOTIATION), ACCEPTED → verde (como
// COMPLETED), REJECTED → vermelho (como REJECTED), COUNTERED → azul (como
// SCHEDULING) — sem inventar cor nova pra um conceito adjacente.
const PROPOSAL_STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  PENDING: { label: "Aguardando resposta", dot: "bg-status-neg" },
  ACCEPTED: { label: "Aceita", dot: "bg-status-ok" },
  REJECTED: { label: "Rejeitada", dot: "bg-status-bad" },
  COUNTERED: { label: "Contraproposta enviada", dot: "bg-status-sched" },
};

export function ProposalStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const config = PROPOSAL_STATUS_CONFIG[status];
  if (!config) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-border-soft px-2.5 py-1 text-xs font-semibold text-ink-soft",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}
