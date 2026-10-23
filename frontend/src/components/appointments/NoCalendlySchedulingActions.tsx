import { CalendarClock, Loader2 } from "lucide-react";
import Button from "../ui/button";

interface NoCalendlySchedulingActionsProps {
  busy?: boolean;
  onRequest(): void;
}

export default function NoCalendlySchedulingActions({
  busy = false,
  onRequest,
}: NoCalendlySchedulingActionsProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Proponha uma data e hora para a reunião. O pedido ficará aguardando
        confirmação do especialista e você poderá enviar uma mensagem por
        e-mail.
      </p>
      <Button
        type="button"
        onClick={onRequest}
        disabled={busy}
        className="w-full"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CalendarClock size={18} />
        )}
        Solicitar reunião
      </Button>
    </div>
  );
}
