import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCalendlyEventListener } from "react-calendly";
import {
  cancelPendingAppointment,
  getCalendlySyncStatus,
  registerCalendlyScheduledEvent,
  type CalendlySyncStatus,
} from "../services/appointments.service";

export type CalendlySyncState =
  | "idle"
  | "waiting_event"
  | "syncing"
  | "done"
  | "error";

interface UseCalendlySchedulingOptions {
  /** Mensagem exibida na página de destino (Meus Processos) após o redirect de sucesso. */
  successRedirectMessage: string;
  /** Efeito colateral extra quando a sincronização confirma o agendamento (ex: atualizar estado local da página). */
  onSynced?: (status: CalendlySyncStatus) => void;
}

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
  const [pendingAppointmentId, setPendingAppointmentId] = useState<
    string | null
  >(null);
  const [syncState, setSyncState] = useState<CalendlySyncState>("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const confirmedRef = useRef(false);

  const pollCalendlySyncStatus = async (appointmentId: string) => {
    const maxAttempts = 8;
    const intervalMs = 3500;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await getCalendlySyncStatus(appointmentId);

      if (status.calendly_sync_status === "SYNCED" || status.appointment_datetime) {
        onSynced?.(status);
        setSyncState("done");
        setSyncMessage(
          "Agendamento recebido! Você pode acompanhar os detalhes em Meus Processos.",
        );

        setTimeout(() => {
          navigate("/customer/processes", {
            state: { message: successRedirectMessage },
          });
        }, 900);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    setSyncState("done");
    setSyncMessage(
      "Solicitação registrada. Estamos finalizando a sincronização do horário com o calendário.",
    );
  };

  useCalendlyEventListener({
    onEventScheduled: async (event) => {
      if (!pendingAppointmentId) {
        return;
      }

      const payload = (event as any)?.data?.payload;
      const eventUri = payload?.event?.uri;
      const inviteeUri = payload?.invitee?.uri;

      if (!eventUri || !inviteeUri) {
        setSyncState("error");
        setSyncMessage(
          "Não foi possível capturar os dados do agendamento. Verifique seus processos para confirmar.",
        );
        return;
      }

      try {
        setSyncState("syncing");
        setSyncMessage("Sincronizando seu agendamento...");

        await registerCalendlyScheduledEvent(pendingAppointmentId, {
          event_uri: eventUri,
          invitee_uri: inviteeUri,
          client_event: "calendly.event_scheduled",
          client_observed_at: new Date().toISOString(),
        });

        confirmedRef.current = true;
        setIsModalOpen(false);
        await pollCalendlySyncStatus(pendingAppointmentId);
      } catch (err) {
        console.error("Erro ao sincronizar evento do Calendly:", err);
        setSyncState("error");
        setSyncMessage(
          "Agendamento criado, mas houve falha na sincronização automática. Você pode seguir em Meus Processos.",
        );
      }
    },
  });

  /** Seta o agendamento pendente em foco, abre o popup do Calendly. */
  const openPopup = (appointmentId: string, calendlyUrl: string) => {
    confirmedRef.current = false;
    setPendingAppointmentId(appointmentId);
    setModalUrl(calendlyUrl);
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

    if (!confirmedRef.current && pendingAppointmentId) {
      try {
        await cancelPendingAppointment(pendingAppointmentId);
      } catch (err) {
        console.error("Erro ao cancelar agendamento ao fechar modal", err);
      } finally {
        setPendingAppointmentId(null);
        setSyncState("idle");
        setSyncMessage("");
      }
    }
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
