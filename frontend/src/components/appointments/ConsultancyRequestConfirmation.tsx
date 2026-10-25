import type { Process } from "../../services/processes.service";

type ConfirmationProcess = Pick<
  Process,
  "status" | "appointment_status" | "appointment_scheduling_method"
>;

export default function ConsultancyRequestConfirmation({
  process,
}: {
  process?: ConfirmationProcess;
}) {
  if (!process || process.status === "REJECTED") return null;
  const confirmed =
    process.appointment_status === "SCHEDULED" ||
    process.appointment_status === "COMPLETED";
  const emailRequest =
    process.appointment_status === "PENDING" &&
    process.appointment_scheduling_method === "EMAIL";
  if (!confirmed && !emailRequest) return null;

  return (
    <section
      role="status"
      aria-label="Solicitação de consultoria recebida"
      className="mb-6 rounded-lg border border-status-ok/30 bg-status-ok-wash p-4 text-ink"
    >
      <h2 className="font-semibold">
        Recebemos sua solicitação e o especialista entrará em contato em
        instantes
      </h2>
      <p className="mt-2 text-sm text-ink-soft">
        {confirmed
          ? "Horário confirmado. Confira os detalhes no seu processo."
          : "Pedido recebido. O horário ainda será combinado e confirmado pelo especialista."}
      </p>
    </section>
  );
}
