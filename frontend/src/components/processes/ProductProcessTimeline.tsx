import { Check, CheckCircle, XCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { StatusBadge } from "../patterns/StatusBadge";
import type {
  ProductProcessStatus,
  ProductProcessSummary,
} from "../../services/appointments.service";

// Mesmos passos do ProcessCard: PROCESSING_CONTRACT fica entre Negociação e Documentação.
const STEP_INDEX: Record<ProductProcessStatus, number> = {
  SCHEDULING: 0,
  NEGOTIATION: 1,
  PROCESSING_CONTRACT: 1.5,
  DOCUMENTATION: 2,
  COMPLETED: 3,
  REJECTED: 3,
};

const STEPS: { label: string; statuses: ProductProcessStatus[] }[] = [
  { label: "Agendamento", statuses: ["SCHEDULING"] },
  { label: "Negociação", statuses: ["NEGOTIATION", "PROCESSING_CONTRACT"] },
  { label: "Documentação", statuses: ["DOCUMENTATION"] },
];

const STAGE_DESCRIPTION: Record<ProductProcessStatus, string> = {
  SCHEDULING: "Sua reunião com o especialista está sendo agendada.",
  NEGOTIATION: "Você está negociando os valores com o especialista.",
  PROCESSING_CONTRACT: "O contrato está sendo preparado.",
  DOCUMENTATION: "Os documentos da compra estão sendo reunidos.",
  COMPLETED: "Este processo foi concluído.",
  REJECTED: "Este processo foi encerrado sem conclusão.",
};

function formatDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("pt-BR", { dateStyle: "short" });
}

/** Linha do tempo do processo do próprio cliente; sem motivo de rejeição. */
export default function ProductProcessTimeline({
  process,
}: {
  process: ProductProcessSummary;
}) {
  const isCompleted = process.status === "COMPLETED";
  const isRejected = process.status === "REJECTED";
  // Rejeição pode ocorrer em qualquer etapa: só marca como feitas as que o histórico registra.
  const reachedIndex = isRejected
    ? Math.max(
        -1,
        ...process.status_history
          .filter((entry) => entry.status !== "REJECTED")
          .map((entry) => STEP_INDEX[entry.status]),
      )
    : STEP_INDEX[process.status];
  const lastChange = (statuses: ProductProcessStatus[]) =>
    formatDate(
      process.status_history.filter((entry) => statuses.includes(entry.status))
        .at(-1)?.changed_at,
    );
  const steps = [
    ...STEPS,
    {
      label: isRejected ? "Rejeitado" : "Concluído",
      statuses: [isRejected ? "REJECTED" : "COMPLETED"] as ProductProcessStatus[],
    },
  ];

  return (
    <section
      aria-label="Etapa do processo"
      className={cn(
        "mb-4 rounded-lg border p-4",
        isCompleted
          ? "border-status-ok-line bg-status-ok-wash"
          : isRejected
            ? "border-status-bad-line bg-status-bad-wash"
            : "border-border bg-white",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {isCompleted && (
          <CheckCircle size={18} className="text-status-ok" aria-hidden="true" />
        )}
        {isRejected && (
          <XCircle size={18} className="text-status-bad" aria-hidden="true" />
        )}
        <p className="text-sm font-semibold text-ink">Etapa do processo:</p>
        <StatusBadge status={process.status} />
      </div>
      <p className="mt-1 text-sm text-muted">
        {STAGE_DESCRIPTION[process.status]}
      </p>
      <ol className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-2">
        {steps.map((step, index) => {
          const isFinal = index === steps.length - 1;
          // Na rejeição, a etapa em que o processo parou também foi alcançada.
          // Em PROCESSING_CONTRACT (1.5), Negociação segue como etapa atual, sem check.
          const done = isFinal
            ? isCompleted || isRejected
            : isRejected
              ? index <= reachedIndex
              : index < Math.floor(reachedIndex);
          const current =
            !isFinal && !isCompleted && !isRejected && index === Math.floor(reachedIndex);
          const date = lastChange(step.statuses);
          return (
            <li
              key={step.label}
              aria-current={current ? "step" : undefined}
              className="flex flex-1 items-center gap-2 sm:flex-col sm:items-start"
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  isFinal && isRejected
                    ? "bg-status-bad text-white"
                    : done || current
                      ? "bg-status-ok text-white"
                      : "bg-border-soft text-muted",
                  current && "ring-2 ring-status-ok-line ring-offset-1",
                )}
              >
                {isFinal && isRejected ? (
                  <XCircle size={16} aria-hidden="true" />
                ) : done ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="flex flex-col">
                <span
                  className={cn(
                    "text-xs font-medium",
                    done || current ? "text-ink" : "text-muted",
                    isFinal && isRejected && "text-status-bad",
                  )}
                >
                  {step.label}
                </span>
                {date && (done || current) && (
                  <span className="text-xs text-muted">{date}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
