import { useCallback, useEffect, useRef, useState } from "react";
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
  /** Mensagem exibida na página de destino (Meus Processos) após o redirect de sucesso. */
  successRedirectMessage: string;
  /** Efeito colateral extra quando a sincronização confirma o agendamento (ex: atualizar estado local da página). */
  onSynced?: (status: CalendlySyncStatus) => void;
}

type PendingCalendlyAttempt = {
  appointmentId: string;
  phase: "waiting_event" | "event_received" | "cancelling" | "settled";
};

/**
 * useCalendlyScheduling
 *
 * Ciclo de vida compartilhado do popup do Calendly: abrir, escutar o evento de
 * agendamento (`calendly.event_scheduled`), registrar no backend, sincronizar
 * status (com polling) e navegar para "Meus Processos" ao concluir.
 *
 * Também cobre o cleanup de abandono: se o usuário fechar o popup sem o evento
 * ter sido confirmado, cancela o agendamento PENDING criado para evitar
 * registros órfãos no banco.
 *
 * Não cobre: criação do agendamento (payloads diferentes por página) nem
 * verificações prévias específicas de cada página — isso continua em cada
 * página, que chama `openPopup` já com o `pendingAppointment.id` em mãos.
 */
export function useCalendlyScheduling({
  successRedirectMessage,
  onSynced,
}: UseCalendlySchedulingOptions) {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<CalendlySyncState>("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const pendingAttemptRef = useRef<PendingCalendlyAttempt | null>(null);
  const mountedRef = useRef(false);
  const syncAbortRef = useRef<AbortController | null>(null);
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const abandonAttempt = useCallback(
    (attempt: PendingCalendlyAttempt, resetVisibleState: boolean) => {
      if (attempt.phase !== "waiting_event") return Promise.resolve();

      // Claim the cancellation synchronously. A modal close, route unmount and
      // StrictMode cleanup can all observe the same attempt, but only the first
      // caller is allowed to issue the DELETE.
      attempt.phase = "cancelling";
      return cancelPendingAppointment(attempt.appointmentId)
        .catch((err) => {
          console.error("Erro ao cancelar agendamento pendente", err);
        })
        .finally(() => {
          if (pendingAttemptRef.current === attempt) {
            pendingAttemptRef.current = null;
          }
          if (resetVisibleState && mountedRef.current) {
            setSyncState("idle");
            setSyncMessage("");
          }
        });
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const attempt = pendingAttemptRef.current;
      if (attempt) void abandonAttempt(attempt, false);
      syncAbortRef.current?.abort();
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    };
  }, [abandonAttempt]);

  useCalendlyEventListener({
    onEventScheduled: async (event) => {
      const attempt = pendingAttemptRef.current;
      if (!attempt || attempt.phase !== "waiting_event") return;

      const currentFrame = document.querySelector<HTMLIFrameElement>(
        ".calendly-popup-content iframe",
      );
      if (
        !modalUrl ||
        !isTrustedCalendlyOrigin(modalUrl) ||
        !isTrustedCalendlyOrigin(event.origin) ||
        !currentFrame?.contentWindow ||
        event.source !== currentFrame.contentWindow
      ) {
        return;
      }

      const payload = event.data?.payload;
      const eventUri = payload?.event?.uri;
      const inviteeUri = payload?.invitee?.uri;

      if (!eventUri || !inviteeUri) {
        setSyncState("error");
        setSyncMessage(
          "Não foi possível capturar os dados do agendamento. Verifique seus processos para confirmar.",
        );
        return;
      }

      // Calendly já disparou `event_scheduled` com um payload válido — isso É
      // a fonte da verdade de que o usuário concluiu o agendamento. Marcar
      // como confirmado AQUI (síncrono, antes do await de rede abaixo) evita
      // a janela de corrida em que o usuário fecha o popup entre o evento do
      // Calendly e a resposta do nosso backend — nesse intervalo o registro
      // NÃO pode ser tratado como abandono e cancelado.
      attempt.phase = "event_received";
      const registrationPayload: RegisterCalendlyScheduledPayload = {
        event_uri: eventUri,
        invitee_uri: inviteeUri,
        client_event: "calendly.event_scheduled",
        client_observed_at: new Date().toISOString(),
      };
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
        // O agendamento já aconteceu de verdade no Calendly (a tentativa já
        // recebeu o evento) — só a nossa sincronização falhou. Não deixar o usuário
        // preso num popup fechado/stale: fecha e manda pra Meus Processos,
        // igual ao fluxo de sucesso, só que com aviso de que pode faltar
        // atualizar a página.
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
    },
  });

  /** Seta o agendamento pendente em foco, abre o popup do Calendly. */
  const openPopup = (appointmentId: string, calendlyUrl: string) => {
    const previousAttempt = pendingAttemptRef.current;
    if (previousAttempt) void abandonAttempt(previousAttempt, false);
    syncAbortRef.current?.abort();
    if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    const normalizedUrl = /^https?:\/\//i.test(calendlyUrl)
      ? calendlyUrl
      : `https://${calendlyUrl}`;
    pendingAttemptRef.current = {
      appointmentId,
      phase: "waiting_event",
    };
    setModalUrl(normalizedUrl);
    setSyncState("waiting_event");
    setSyncMessage(
      "Conclua seu agendamento no Calendly para sincronizar automaticamente com a plataforma.",
    );
    setIsModalOpen(true);
  };

  /**
   * Fecha o popup. Se o usuário abandonou o Calendly sem confirmar o
   * agendamento (`onEventScheduled` nunca disparou), cancela o agendamento
   * PENDING para não deixar registro órfão no banco.
   */
  const closePopup = async () => {
    setIsModalOpen(false);
    const attempt = pendingAttemptRef.current;
    if (attempt) await abandonAttempt(attempt, true);
  };

  return {
    isModalOpen,
    modalUrl,
    syncState,
    syncMessage,
    openPopup,
    closePopup,
  };
}
