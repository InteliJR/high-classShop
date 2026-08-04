import { cn } from "../../lib/utils";

// Um único lugar pra label + cor de cada status de processo — StatusBadge,
// o gráfico do dashboard (Task 3) e os filtros de ConsultantProcessesPage/
// ConsultantProcessDetailPage (Tasks 4/5) consomem isto em vez de duplicar
// o mapa. `hex` deve ficar em sincronia com os tokens --color-status-* em
// frontend/src/index.css — existe só porque bibliotecas de gráfico (SVG)
// não conseguem ler classes Tailwind, precisam do valor de cor literal.
export const PROCESS_STATUS_META = [
  { value: "SCHEDULING", label: "Agendamento", dot: "bg-status-sched", hex: "#1d4ed8" },
  { value: "NEGOTIATION", label: "Negociação", dot: "bg-status-neg", hex: "#b45309" },
  { value: "PROCESSING_CONTRACT", label: "Contrato", dot: "bg-status-proc", hex: "#c2410c" },
  { value: "DOCUMENTATION", label: "Documentação", dot: "bg-status-doc", hex: "#7e22ce" },
  { value: "COMPLETED", label: "Concluído", dot: "bg-status-ok", hex: "#15803d" },
  { value: "REJECTED", label: "Rejeitado", dot: "bg-status-bad", hex: "#b91c1c" },
] as const;

const STATUS_CONFIG: Record<string, (typeof PROCESS_STATUS_META)[number]> =
  Object.fromEntries(PROCESS_STATUS_META.map((meta) => [meta.value, meta]));

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
