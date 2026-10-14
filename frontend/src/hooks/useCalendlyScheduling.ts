import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCalendlyEventListener } from "react-calendly";
import {
  cancelPendingAppointment,
  type CalendlySyncStatus,
  type RegisterCalendlyScheduledPayload,
} from "../services/appointments.service";
import {
  isCalendlySyncComplete,
  isCalendlySyncTerminalFailure,
  synchronizeCalendlyRegistration,
} from "../services/calendly-sync";
import { isTrustedCalendlyOrigin } from "../lib/calendly-origin";

export type CalendlySyncState =
  | "idle"
  | "waiting_event"
  | "syncing"
  | "pending"
  | "done"
  | "error";

interface UseCalendlySchedulingOptions {
  successRedirectMessage: string;
  onSynced?: (status: CalendlySyncStatus) => void;
}

type PendingCalendlyAttempt = {
  appointmentId: string;
  modalUrl: string;
  phase:
    | "waiting_event"
    | "closing_grace"
    | "event_received"
    | "cancelling"
    | "settled";
  frameSource: MessageEventSource | null;
  rawListener: ((event: MessageEvent) => void) | null;
  graceTimer: ReturnType<typeof setTimeout> | null;
  gracePromise: Promise<void> | null;
  resolveGrace: (() => void) | null;
};

const ABANDONMENT_GRACE_MS = 750;

function currentCalendlyFrameSource(): MessageEventSource | null {
  return (
    document.querySelector<HTMLIFrameElement>(
      ".calendly-popup-content iframe",
    )?.contentWindow ?? null
  );
}

function trustedScheduledPayload(
  event: MessageEvent,
  attempt: PendingCalendlyAttempt,
): RegisterCalendlyScheduledPayload | null {
  if (
    event.data?.event !== "calendly.event_scheduled" ||
    !isTrustedCalendlyOrigin(attempt.modalUrl) ||
    !isTrustedCalendlyOrigin(event.origin) ||
    !attempt.frameSource ||
    event.source !== attempt.frameSource
  ) {
    return null;
  }

  const eventUri = event.data?.payload?.event?.uri;
  const inviteeUri = event.data?.payload?.invitee?.uri;
  if (
    typeof eventUri !== "string" ||
    !eventUri ||
    typeof inviteeUri !== "string" ||
    !inviteeUri
  ) {
    return null;
  }

  return {
    event_uri: eventUri,
    invitee_uri: inviteeUri,
    client_event: "calendly.event_scheduled",
    client_observed_at: new Date().toISOString(),
  };
}

function removeAttemptListener(attempt: PendingCalendlyAttempt) {
  if (attempt.rawListener) {
    window.removeEventListener("message", attempt.rawListener);
    attempt.rawListener = null;
  }
}

function resolveGraceWindow(attempt: PendingCalendlyAttempt) {
  if (attempt.graceTimer) {
    clearTimeout(attempt.graceTimer);
    attempt.graceTimer = null;
  }
  const resolve = attempt.resolveGrace;
  attempt.resolveGrace = null;
  attempt.gracePromise = null;
  resolve?.();
}

/**
 * Owns the Calendly popup lifecycle for a customer-created pending request.
 * A short close/unmount grace keeps the iframe's WindowProxy trusted long
 * enough to observe an event already queued by Calendly before deleting the
 * PENDING request. This is best effort for SPA lifecycle changes; a hard page
 * unload still relies on the backend webhook and transactional status checks.
 */
export function useCalendlyScheduling({
  successRedirectMessage,
  onSynced,
}: UseCalendlySchedulingOptions) {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  const [modalKey, setModalKey] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<CalendlySyncState>("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const pendingAttemptRef = useRef<PendingCalendlyAttempt | null>(null);
  const mountedRef = useRef(false);
  const syncAbortRef = useRef<AbortController | null>(null);
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalSequenceRef = useRef(0);
  const receiveScheduledEventRef = useRef<
    (attempt: PendingCalendlyAttempt, event: MessageEvent) => Promise<void>
  >(async () => {});

  const beginAbandonment = useCallback(
    (attempt: PendingCalendlyAttempt, resetVisibleState: boolean) => {
      if (attempt.phase === "closing_grace" && attempt.gracePromise) {
        return attempt.gracePromise;
      }
      if (attempt.phase !== "waiting_event") return Promise.resolve();

      attempt.frameSource ??= currentCalendlyFrameSource();
      attempt.phase = "closing_grace";
      if (attempt.frameSource && !attempt.rawListener) {
        attempt.rawListener = (event) => {
          void receiveScheduledEventRef.current(attempt, event);
        };
        window.addEventListener("message", attempt.rawListener);
      }
      if (resetVisibleState && mountedRef.current) {
        setSyncState("idle");
        setSyncMessage("");
      }

      attempt.gracePromise = new Promise<void>((resolve) => {
        attempt.resolveGrace = resolve;
      });
      attempt.graceTimer = setTimeout(() => {
        attempt.graceTimer = null;
        if (attempt.phase !== "closing_grace") {
          resolveGraceWindow(attempt);
          return;
        }

        // Claim before the HTTP call so close, unmount and StrictMode cleanup
        // cannot issue duplicate cancellation requests.
        attempt.phase = "cancelling";
        removeAttemptListener(attempt);
        void cancelPendingAppointment(attempt.appointmentId)
          .catch((err) => {
            console.error("Erro ao cancelar agendamento pendente", err);
          })
          .finally(() => {
            if (pendingAttemptRef.current === attempt) {
              pendingAttemptRef.current = null;
            }
            resolveGraceWindow(attempt);
          });
      }, ABANDONMENT_GRACE_MS);

      return attempt.gracePromise;
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const attempt = pendingAttemptRef.current;
      if (attempt) void beginAbandonment(attempt, false);
      syncAbortRef.current?.abort();
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    };
  }, [beginAbandonment]);

  useLayoutEffect(() => {
    if (!isModalOpen) return;
    const attempt = pendingAttemptRef.current;
    if (attempt && attempt.phase === "waiting_event") {
      attempt.frameSource ??= currentCalendlyFrameSource();
    }
  }, [isModalOpen, modalUrl, modalKey]);

  const synchronizeScheduledEvent = async (
    attempt: PendingCalendlyAttempt,
    registrationPayload: RegisterCalendlyScheduledPayload,
  ) => {
    syncAbortRef.current?.abort();
    const syncController = new AbortController();
    syncAbortRef.current = syncController;

    try {
      setSyncState("syncing");
      setSyncMessage("Sincronizando seu agendamento...");

      const status = await synchronizeCalendlyRegistration(
        attempt.appointmentId,
        registrationPayload,
        { signal: syncController.signal },
      );
      if (!mountedRef.current || syncController.signal.aborted || !status) return;

      attempt.phase = "settled";
      setIsModalOpen(false);
      if (isCalendlySyncComplete(status)) {
        onSynced?.(status);
        setSyncState("done");
        setSyncMessage(
          "Agendamento recebido! Você pode acompanhar os detalhes em Meus Processos.",
        );
        navigateTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          navigate("/customer/processes", {
            state: { message: successRedirectMessage },
          });
        }, 900);
      } else if (isCalendlySyncTerminalFailure(status)) {
        setSyncState("error");
        setSyncMessage(
          status.status === "CANCELLED"
            ? "O agendamento foi cancelado no Calendly. Verifique Meus Processos antes de tentar novamente."
            : "Não foi possível confirmar o horário no Calendly. Verifique Meus Processos ou tente novamente.",
        );
      } else {
        setSyncState("pending");
        setSyncMessage(
          "Solicitação registrada. Estamos finalizando a sincronização do horário com o calendário.",
        );
      }
    } catch (err) {
      if (!mountedRef.current || syncController.signal.aborted) return;
      console.error("Erro ao sincronizar evento do Calendly:", err);
      setSyncState("error");
      setSyncMessage(
        "Agendamento confirmado no Calendly, mas houve falha ao sincronizar com a plataforma. Redirecionando para Meus Processos...",
      );
      setIsModalOpen(false);
      navigateTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        navigate("/customer/processes", {
          state: {
            message:
              "Agendamento confirmado no Calendly! Se o horário não aparecer imediatamente em Meus Processos, atualize a página em instantes.",
          },
        });
      }, 1000);
    }
  };

  const receiveScheduledEvent = async (
    attempt: PendingCalendlyAttempt,
    event: MessageEvent,
  ) => {
    if (
      attempt.phase !== "waiting_event" &&
      attempt.phase !== "closing_grace"
    ) {
      return;
    }
    const registrationPayload = trustedScheduledPayload(event, attempt);
    if (!registrationPayload) return;

    // Claim synchronously before any await: a close/unmount queued immediately
    // after this event can no longer delete the real Calendly booking request.
    attempt.phase = "event_received";
    removeAttemptListener(attempt);
    resolveGraceWindow(attempt);

    // After unmount (or for an obsolete A→B popup), the trusted event only
    // suppresses deletion. Calendly's webhook owns eventual synchronization.
    if (!mountedRef.current || pendingAttemptRef.current !== attempt) return;
    await synchronizeScheduledEvent(attempt, registrationPayload);
  };
  receiveScheduledEventRef.current = receiveScheduledEvent;

  useCalendlyEventListener({
    onEventScheduled: (event) => {
      const attempt = pendingAttemptRef.current;
      if (!attempt) return;
      return receiveScheduledEvent(attempt, event);
    },
  });

  const openPopup = (appointmentId: string, calendlyUrl: string) => {
    const previousAttempt = pendingAttemptRef.current;
    if (previousAttempt) void beginAbandonment(previousAttempt, false);
    syncAbortRef.current?.abort();
    if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    const normalizedUrl = /^https?:\/\//i.test(calendlyUrl)
      ? calendlyUrl
      : `https://${calendlyUrl}`;
    const attempt: PendingCalendlyAttempt = {
      appointmentId,
      modalUrl: normalizedUrl,
      phase: "waiting_event",
      frameSource: null,
      rawListener: null,
      graceTimer: null,
      gracePromise: null,
      resolveGrace: null,
    };
    pendingAttemptRef.current = attempt;
    setModalUrl(normalizedUrl);
    modalSequenceRef.current += 1;
    setModalKey(`${appointmentId}:${modalSequenceRef.current}`);
    setSyncState("waiting_event");
    setSyncMessage(
      "Conclua seu agendamento no Calendly para sincronizar automaticamente com a plataforma.",
    );
    setIsModalOpen(true);
  };

  const closePopup = () => {
    setIsModalOpen(false);
    const attempt = pendingAttemptRef.current;
    return attempt ? beginAbandonment(attempt, true) : Promise.resolve();
  };

  return {
    isModalOpen,
    modalUrl,
    modalKey,
    syncState,
    syncMessage,
    openPopup,
    closePopup,
  };
}
