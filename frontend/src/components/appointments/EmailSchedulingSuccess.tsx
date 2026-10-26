import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Mail } from "lucide-react";
import {
  buildEmailSchedulingLinks,
  type EmailSchedulingInput,
} from "../../lib/email-scheduling";
import Button from "../ui/button";
import { Alert } from "../ui/alert";

interface EmailSchedulingSuccessProps extends EmailSchedulingInput {
  appointmentId: string;
  autoOpen?: boolean;
  openMailClient?(href: string): void;
}

// Storage may be unavailable; retain the one-shot for this browser document too.
const openedAppointments = new Set<string>();
const openBrowserMailClient = (href: string) => {
  window.open(href, "_self");
};

export default function EmailSchedulingSuccess({
  appointmentId,
  autoOpen = false,
  openMailClient = openBrowserMailClient,
  ...input
}: EmailSchedulingSuccessProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const { mailtoHref, gmailHref } = buildEmailSchedulingLinks(input);

  useEffect(() => {
    if (!autoOpen) return;
    const timer = setTimeout(() => {
      const sessionKey = `email-request-opened:${appointmentId}`;
      if (openedAppointments.has(appointmentId)) return;
      try {
        if (sessionStorage.getItem(sessionKey) === "1") return;
      } catch {
        /* The in-memory marker remains available. */
      }

      // Consume only a committed attempt, never an effect cancelled by StrictMode.
      openedAppointments.add(appointmentId);
      try {
        sessionStorage.setItem(sessionKey, "1");
      } catch {
        /* Optional persistence. */
      }
      headingRef.current?.focus();
      try {
        openMailClient(mailtoHref);
      } catch {
        /* The persisted request and links remain valid. */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [appointmentId, autoOpen, mailtoHref, openMailClient]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(input.recipient);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  const linkClassName =
    "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring";
  return (
    <div className="space-y-4">
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-status-ok-line bg-status-ok-wash p-4 text-status-ok"
      >
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="font-semibold focus:outline-none"
        >
          Solicitação de reunião registrada
        </h3>
        <p className="mt-1 text-sm">
          Aguardando confirmação do especialista. O horário sugerido ainda não
          está reservado.
        </p>
        <p className="mt-2 text-sm">
          Data proposta:{" "}
          <time dateTime={input.appointmentDatetime}>
            {new Date(input.appointmentDatetime).toLocaleString("pt-BR", {
              timeZone: input.timeZone,
              dateStyle: "short",
              timeStyle: "short",
            })}
          </time>{" "}
          ({input.timeZone})
        </p>
      </div>
      <p className="text-sm text-ink-soft">
        Envie a mensagem pelo aplicativo de e-mail ou pelo Gmail para combinar a
        reunião. O envio é concluído no aplicativo escolhido.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href={mailtoHref} className={linkClassName}>
          <Mail size={18} />
          Abrir aplicativo de e-mail
        </a>
        <a
          href={gmailHref}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          <ExternalLink size={18} />
          Abrir no Gmail
        </a>
      </div>
      <div className="rounded-lg border border-border bg-border-soft p-3">
        <label className="block text-xs text-muted">
          E-mail do especialista
          <input
            aria-label="E-mail do especialista"
            readOnly
            value={input.recipient}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-1 w-full rounded bg-transparent py-2 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
          />
        </label>
        <Button
          type="button"
          variant="light"
          className="mt-2"
          onClick={handleCopy}
        >
          {copyState === "copied" ? <Check size={16} /> : <Copy size={16} />}
          Copiar e-mail
        </Button>
        {copyState === "copied" && (
          <p role="status" className="mt-2 text-sm">
            E-mail copiado
          </p>
        )}
        {copyState === "failed" && (
          <Alert variant="danger" className="mt-2">
            Não foi possível copiar. Selecione o endereço de e-mail acima e
            copie manualmente.
          </Alert>
        )}
      </div>
      <a href="/customer/processes" className={`${linkClassName} w-full`}>
        Acompanhar processo
      </a>
    </div>
  );
}
