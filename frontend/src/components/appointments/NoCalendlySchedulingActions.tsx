import { useState } from "react";
import { CalendarClock, Check, Copy, Loader2, Mail } from "lucide-react";
import Button from "../ui/button";

interface NoCalendlySchedulingActionsProps {
  specialistEmail: string;
  busy?: boolean;
  showActions?: boolean;
  onEmail(): void;
  onChooseDateTime(): void;
}

export default function NoCalendlySchedulingActions({
  specialistEmail,
  busy = false,
  showActions = true,
  onEmail,
  onChooseDateTime,
}: NoCalendlySchedulingActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(specialistEmail);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4">
      {showActions && (
        <>
          <p className="text-sm text-ink-soft">
            Este especialista não usa agenda online. Você pode combinar o horário
            por e-mail ou escolher agora uma data e hora para a reunião na
            plataforma.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              onClick={onEmail}
              disabled={busy}
              className="w-full"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail size={18} />}
              Enviar e-mail
            </Button>
            <Button
              type="button"
              variant="light"
              onClick={onChooseDateTime}
              disabled={busy}
              className="w-full"
            >
              <CalendarClock size={18} />
              Escolher data e hora
            </Button>
          </div>
        </>
      )}

      <div className="rounded-lg border border-border bg-border-soft p-3 text-sm">
        <p className="mb-1 text-xs text-muted">E-mail do especialista</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <a
            href={`mailto:${specialistEmail}`}
            className="break-all font-medium text-blue-700 hover:underline"
          >
            {specialistEmail}
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-ink"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "E-mail copiado" : "Copiar e-mail"}
          </button>
        </div>
      </div>
    </div>
  );
}
