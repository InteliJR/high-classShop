import { Mail, MessageSquare, Phone } from "lucide-react";
import { buildWhatsAppHref } from "../../lib/whatsapp";
import type { Process } from "../../services/processes.service";
import { useAuth } from "../../store/authStateManager";
import CopyableContact from "./CopyableContact";

export default function SpecialistContactCard({ process }: { process: Process }) {
  const user = useAuth((state) => state.user);
  const clientId = process.client_id ?? process.client?.id;
  const confirmed =
    process.appointment_status === "SCHEDULED" ||
    process.appointment_status === "COMPLETED";

  if (
    !user ||
    user.role !== "CUSTOMER" ||
    user.id !== clientId ||
    (process.client?.id && process.client.id !== user.id) ||
    process.status === "REJECTED" ||
    !confirmed
  ) return null;

  const specialist = process.specialist;
  const name = [specialist?.name?.trim(), specialist?.surname?.trim()]
    .filter(Boolean)
    .join(" ");
  const email = specialist?.email?.trim();
  const phone = specialist?.phone?.trim();
  const whatsAppHref = phone ? buildWhatsAppHref(phone) : null;

  return (
    <section
      aria-label="Contato do especialista"
      className="mx-3 mt-4 min-w-0 rounded-lg border border-gray-200 bg-gray-50 p-3 md:mx-6"
    >
      <h4 className="text-sm font-semibold text-gray-900">
        Caso tenha uma dúvida, entre em contato:
      </h4>
      <p className="mt-2 break-words text-sm font-medium text-gray-900">
        {name || "Nome do especialista não informado"}
      </p>
      <div className="mt-1 flex flex-col items-start gap-1">
        {email ? (
          <CopyableContact
            icon={<Mail size={14} />}
            label={email}
            value={email}
            description="e-mail do especialista"
          />
        ) : (
          <p className="text-xs text-gray-600">E-mail não informado</p>
        )}
        {phone ? (
          <CopyableContact
            icon={<Phone size={14} />}
            label={phone}
            value={phone}
            description="telefone do especialista"
          />
        ) : (
          <p className="text-xs text-gray-600">Telefone não informado</p>
        )}
        {whatsAppHref && (
          <a
            href={whatsAppHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:underline"
          >
            <MessageSquare size={14} />
            WhatsApp do especialista
          </a>
        )}
      </div>
    </section>
  );
}
