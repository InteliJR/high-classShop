import {
  Check,
  ChevronDown,
  ChevronRight,
  Edit2,
  ExternalLink,
  Loader2,
  Clock,
  X,
  MessageSquare,
  CheckCircle,
  XCircle,
  Package,
  Video,
  Mail,
  Phone,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Process } from "../../services/processes.service";
import type { Product, SpecialityType } from "../../types/types";
import React from "react";
import UpdateProcessStatusModal from "./UpdateProcessStatusModal";
import CopyableContact from "./CopyableContact";
import SpecialistContactCard from "./SpecialistContactCard";
import AppointmentDateTimeModal from "../appointments/AppointmentDateTimeModal";
import { buildWhatsAppHref } from "../../lib/whatsapp";
import { getContextualStatusMessage } from "../../utils/processStatusMessages";
import {
  getProcessCompletionReason,
  getProcessWithActiveContract,
  getAdminProcessTimeline,
  confirmAppointment,
  cancelAppointment,
  getMeetingByProcess,
  markConversationDone,
  startMeeting,
  updateProcessStatus,
  type MeetingSession,
  type DelegatedProcessTimelineEvent,
} from "../../services/processes.service";
import { rescheduleAppointment } from "../../services/appointments.service";
import ConsultancyReason from "./ConsultancyReason";
import { adminJourneyRoute } from "../../lib/admin-specialist-journey";

function getActionErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const maybeAxios = error as {
      response?: { data?: { message?: string; error?: { message?: string } } };
      message?: string;
    };

    const backendMessage =
      maybeAxios.response?.data?.error?.message ||
      maybeAxios.response?.data?.message;

    if (backendMessage && typeof backendMessage === "string") {
      return backendMessage;
    }

    if (maybeAxios.message && typeof maybeAxios.message === "string") {
      return maybeAxios.message;
    }
  }

  return fallback;
}

interface ProcessCardProps {
  process: Process;
  product?:
    | Product
    | {
        id: string;
        marca?: string;
        modelo?: string;
        descricao?: string;
        ano?: number;
        estado?: string;
      };
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onUploadDocuments?: () => void;
  onStatusUpdated?: () => void;
  isClientView?: boolean; // Se true, remove botões de ação (apenas visualização)
  onSelectProduct?: () => void; // Callback para abrir seleção de produto em consultoria
  specialistSpeciality?: SpecialityType; // Especialidade do especialista para filtrar produtos
  adminJourney?: boolean;
}

/**
 * Reusable component for displaying a single process with status stepper
 * Shows client name, progress timeline, product details, and actions
 */
export default function ProcessCard({
  process,
  product,
  isExpanded = false,
  onToggleExpand,
  onUploadDocuments,
  onStatusUpdated,
  isClientView = false,
  onSelectProduct,
  adminJourney = false,
}: ProcessCardProps) {
  const navigate = useNavigate();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [completionReason, setCompletionReason] = useState<string | null>(null);
  const [activeContract, setActiveContract] = useState<any>(null);
  const [delegatedTimeline, setDelegatedTimeline] = useState<
    DelegatedProcessTimelineEvent[]
  >([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [meetingSession, setMeetingSession] = useState<MeetingSession | null>(
    null,
  );
  const [isStartingMeeting, setIsStartingMeeting] = useState(false);
  const [isLoadingMeeting, setIsLoadingMeeting] = useState(false);
  const [meetingLookupState, setMeetingLookupState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [meetingVerifiedProcess, setMeetingVerifiedProcess] =
    useState<Process | null>(null);
  const [isConversationDoneLoading, setIsConversationDoneLoading] =
    useState(false);
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [dateTimeAction, setDateTimeAction] = useState<
    "confirm" | "reschedule" | null
  >(null);
  const [dateTimeActionError, setDateTimeActionError] = useState<string | null>(
    null,
  );
  const [isRescheduling, setIsRescheduling] = useState(false);
  const confirmationInFlight = useRef(false);
  const dateTimeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const rejectionTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Verifica se é um processo de consultoria (sem produto atribuído)
  const isConsultancy = !process.product_type || !process.product_id;
  const canManuallyAdvanceProcess =
    !isClientView && process.status === "NEGOTIATION" && !isConsultancy;
  const canPrepareContract =
    !activeContract ||
    ["DECLINED", "VOIDED", "TIMEDOUT"].includes(
      String(activeContract.provider_status ?? "").toUpperCase(),
    );

  // Contraparte do processo: quem esta olhando quer o contato do outro lado.
  // Nao ha fallback entre os dois — se o dado da contraparte nao veio, a
  // linha simplesmente nao aparece, em vez de mostrar o contato errado.
  const counterpart = isClientView ? process.specialist : process.client;
  const counterpartLabel = isClientView ? "especialista" : "cliente";
  const counterpartEmail = counterpart?.email?.trim() || null;
  const counterpartPhone = counterpart?.phone?.trim() || null;
  const whatsAppHref = counterpartPhone ? buildWhatsAppHref(counterpartPhone) : null;
  const isAppointmentConfirmed =
    process.appointment_status === "SCHEDULED" ||
    process.appointment_status === "COMPLETED";
  const scheduledMeetingDate = process.appointment_datetime
    ? new Date(process.appointment_datetime)
    : null;
  const hasValidScheduledMeetingDate =
    Boolean(scheduledMeetingDate) &&
    !Number.isNaN(scheduledMeetingDate?.getTime() ?? NaN);
  // Especialista pode iniciar a qualquer momento (backend sem restrição de janela)
  // Cliente só vê botão se reunião já foi iniciada pelo especialista
  const canStartOrJoinMeeting =
    isAppointmentConfirmed && process.status === "SCHEDULING";
  const hasActiveAppointment =
    process.appointment_status === "PENDING" ||
    process.appointment_status === "SCHEDULED";
  const hasActiveMeeting = Boolean(
    meetingSession && !meetingSession.ended_at && meetingSession.is_active !== false,
  );
  const isNonTerminalProcess =
    process.status !== "COMPLETED" && process.status !== "REJECTED";
  const shouldLookupMeeting =
    canStartOrJoinMeeting || (isNonTerminalProcess && !hasActiveAppointment);
  const canRejectProcess =
    isNonTerminalProcess &&
    !hasActiveAppointment &&
    !hasActiveMeeting &&
    meetingLookupState === "ready" &&
    meetingVerifiedProcess === process;
  const canSpecialistReschedule =
    !isClientView &&
    process.status === "SCHEDULING" &&
    process.appointment_status === "SCHEDULED" &&
    Boolean(process.appointment_id) &&
    Boolean(process.appointment_datetime) &&
    !process.specialist_rescheduled_at;

  const formattedAppointmentDate = hasValidScheduledMeetingDate
    ? (scheduledMeetingDate as Date).toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  const formattedAppointmentTime = hasValidScheduledMeetingDate
    ? (scheduledMeetingDate as Date).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // These projections are independent: a failure in one must not suppress the
  // others (especially the meeting gate used by rejection).
  useEffect(() => {
    let current = true;

    void getProcessCompletionReason(process.id)
      .then((reason) => {
        if (current) setCompletionReason(reason);
      })
      .catch((error) => console.error("Error loading completion reason:", error));

    void getProcessWithActiveContract(process.id)
      .then((processData) => {
        if (current) setActiveContract(processData.activeContract);
      })
      .catch((error) => console.error("Error loading active contract:", error));

    return () => {
      current = false;
    };
  }, [process]);

  useEffect(() => {
    let current = true;
    if (!adminJourney || !isExpanded) {
      setDelegatedTimeline([]);
      return () => {
        current = false;
      };
    }
    void getAdminProcessTimeline(process.id)
      .then((events) => {
        if (current) setDelegatedTimeline(events);
      })
      .catch((error) => console.error("Error loading delegated timeline:", error));
    return () => {
      current = false;
    };
  }, [adminJourney, isExpanded, process.id]);

  useEffect(() => {
    let current = true;

    if (!shouldLookupMeeting) {
      setMeetingSession(null);
      setMeetingLookupState("idle");
      setMeetingVerifiedProcess(null);
      setIsLoadingMeeting(false);
      return () => {
        current = false;
      };
    }

    setMeetingSession(null);
    setMeetingLookupState("loading");
    setMeetingVerifiedProcess(null);
    setIsLoadingMeeting(true);

    void getMeetingByProcess(process.id)
      .then((meeting) => {
        if (!current) return;
        setMeetingSession(meeting);
        setMeetingLookupState("ready");
        setMeetingVerifiedProcess(process);
      })
      .catch((error) => {
        if (!current) return;
        setMeetingSession(null);
        setMeetingLookupState("error");
        setMeetingVerifiedProcess(null);
        console.error("Error loading meeting:", error);
      })
      .finally(() => {
        if (current) setIsLoadingMeeting(false);
      });

    return () => {
      current = false;
    };
  }, [process, shouldLookupMeeting]);

  const handleStartMeeting = async () => {
    if (isStartingMeeting) return;

    try {
      setIsStartingMeeting(true);
      await startMeeting(process.id);
      onStatusUpdated?.();
      navigate(
        adminJourney
          ? adminJourneyRoute("meeting", process.id)
          : `/processes/${process.id}/meeting`,
      );
    } catch (error) {
      console.error("Error starting meeting:", error);
      alert(
        getActionErrorMessage(
          error,
          "Erro ao iniciar reunião. Tente novamente.",
        ),
      );
    } finally {
      setIsStartingMeeting(false);
    }
  };

  const handleJoinMeeting = () => {
    navigate(
      adminJourney
        ? adminJourneyRoute("meeting", process.id)
        : `/processes/${process.id}/meeting`,
    );
  };

  const handleConversationDone = async () => {
    if (isConversationDoneLoading) return;

    try {
      setIsConversationDoneLoading(true);
      const result = await markConversationDone(process.id);

      if (result.processTransition.requires_product_selection) {
        onSelectProduct?.();
      }

      onStatusUpdated?.();
    } catch (error) {
      console.error("Error marking conversation as done:", error);
      alert(
        getActionErrorMessage(
          error,
          "Erro ao concluir conversa com cliente. Tente novamente.",
        ),
      );
    } finally {
      setIsConversationDoneLoading(false);
    }
  };

  // Handle confirm appointment
  const handleConfirmAppointment = async (appointmentDatetime: string) => {
    if (confirmationInFlight.current || isCancelling ||
      process.appointment_status !== "PENDING" || !process.appointment_id) return;
    confirmationInFlight.current = true;

    try {
      setIsConfirming(true);
      setDateTimeActionError(null);
      await confirmAppointment(process.id, appointmentDatetime);
      setDateTimeAction(null);
      onStatusUpdated?.();
    } catch (error) {
      const message = getActionErrorMessage(
        error,
        "Erro ao confirmar agendamento. Tente novamente.",
      );
      setDateTimeActionError(message);
      if ((error as { response?: { status?: number } })?.response?.status === 409) {
        setDateTimeAction("confirm");
      }
    } finally {
      setIsConfirming(false);
      confirmationInFlight.current = false;
    }
  };

  const handleReschedule = async (appointmentDatetime: string) => {
    if (isRescheduling || !process.appointment_id) return;

    try {
      setIsRescheduling(true);
      setDateTimeActionError(null);
      await rescheduleAppointment(process.appointment_id, appointmentDatetime);
      setDateTimeAction(null);
      onStatusUpdated?.();
    } catch (error) {
      setDateTimeActionError(
        getActionErrorMessage(
          error,
          "Não foi possível alterar o horário. Tente novamente.",
        ),
      );
    } finally {
      setIsRescheduling(false);
    }
  };

  // Handle cancel appointment
  const handleCancelAppointment = async () => {
    if (isCancelling) return;

    const confirmed = window.confirm(
      isClientView
        ? "Deseja cancelar este agendamento? Esta ação não pode ser desfeita."
        : "Deseja recusar este agendamento? Esta ação não pode ser desfeita.",
    );

    if (!confirmed) return;

    const administrativeReason = adminJourney
      ? window.prompt("Informe o motivo do cancelamento administrativo:")
      : undefined;
    if (adminJourney && !administrativeReason?.trim()) return;

    try {
      setIsCancelling(true);
      if (adminJourney) {
        await cancelAppointment(process.id, administrativeReason!.trim());
      } else {
        await cancelAppointment(process.id);
      }
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      alert(
        getActionErrorMessage(
          error,
          "Erro ao cancelar agendamento. Tente novamente.",
        ),
      );
    } finally {
      setIsCancelling(false);
      onStatusUpdated?.();
    }
  };

  const handleAdvanceProcess = async () => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    setAdvanceError(null);
    try {
      await updateProcessStatus(process.id, "DOCUMENTATION");
      setShowAdvanceConfirm(false);
      onStatusUpdated?.();
    } catch (error) {
      setAdvanceError(getActionErrorMessage(error, "Erro ao avançar processo"));
    } finally {
      setIsAdvancing(false);
    }
  };

  // Map process status to step index
  // REJECTED substitui o último passo (COMPLETED)
  const statusSteps: Record<string, number> = {
    SCHEDULING: 0,
    NEGOTIATION: 1,
    PROCESSING_CONTRACT: 1.5, // Between NEGOTIATION and DOCUMENTATION
    DOCUMENTATION: 2,
    COMPLETED: 3,
    REJECTED: 3, // Mesmo índice que COMPLETED, mas com visual diferente
  };

  // Labels dinâmicos: se rejeitado, muda o último label
  const isRejected = process.status === "REJECTED";
  const stepLabels = isRejected
    ? ["Agendamento", "Negociação", "Documentação", "Rejeitado"]
    : ["Agendamento", "Negociação", "Documentação", "Concluído"];

  const currentStep = statusSteps[process.status] ?? 0;

  return (
    <div
      className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-100 overflow-hidden relative ${
        process.status === "NEGOTIATION" && onUploadDocuments && !isExpanded
          ? "pb-20"
          : ""
      }`}
    >
      {/* Negotiation button - visible only when process has a product */}
      {process.status === "NEGOTIATION" && !isConsultancy && !isExpanded && (
        <div className="hidden md:block absolute top-6 right-6 z-20">
          <button
            onClick={() =>
              navigate(
                adminJourney
                  ? adminJourneyRoute("negotiation", process.id)
                  : `/processes/${process.id}/negotiation`,
              )
            }
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs md:text-sm font-medium rounded-lg shadow-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <MessageSquare size={16} />
            Negociar
          </button>
        </div>
      )}
      {/* Upload Contract Button: For DOCUMENTATION status (hidden in client view) */}
      {process.status === "DOCUMENTATION" &&
        onUploadDocuments &&
        canPrepareContract &&
        !isExpanded &&
        !isClientView && (
          <div className="hidden md:block absolute top-6 right-6 z-20">
            <button
              onClick={onUploadDocuments}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-xs md:text-sm font-medium rounded-lg shadow-lg hover:bg-orange-700 transition-colors whitespace-nowrap"
            >
              Enviar Contrato
            </button>
          </div>
        )}
      {/* Upload Documents Button: Fixed bottom right with margin, only when not expanded */}

      {/* Header: Process Title with Client and Product */}
      <div className="px-3 py-2 md:px-6 md:py-4 border-b border-gray-100 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm md:text-lg font-semibold text-gray-900 truncate">
            {isConsultancy ? "Consultoria" : "Processo"} -{" "}
            {process.client?.name || process.client_id} -{" "}
            {isConsultancy
              ? "Aguardando produto"
              : product?.modelo || "Produto"}
          </h3>
          {/* O cliente encontra o especialista no card de contato abaixo.
              Os demais perfis mantêm aqui os contatos do cliente que a API
              autorizou para a contraparte deste processo. */}
          {!isClientView && (counterpartEmail || counterpartPhone) && (
            <div className="mt-1 flex flex-col items-start gap-0.5">
              {counterpartEmail && (
                <CopyableContact
                  icon={<Mail size={12} />}
                  label={counterpartEmail}
                  value={counterpartEmail}
                  description={`e-mail do ${counterpartLabel}`}
                />
              )}
              {counterpartPhone && (
                <CopyableContact
                  icon={<Phone size={12} />}
                  label={counterpartPhone}
                  value={counterpartPhone}
                  description={`telefone do ${counterpartLabel}`}
                />
              )}
              {whatsAppHref && (
                <a
                  href={whatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:underline"
                >
                  <MessageSquare size={12} />
                  WhatsApp do {counterpartLabel}
                </a>
              )}
            </div>
          )}

          {isConsultancy && (
            <p className="text-xs text-slate-600 mt-1">
              {isClientView
                ? "Especialista irá direcionar você para o produto que melhor se encaixa no seu perfil"
                : "Confirme a reunião e, em seguida, selecione o produto ideal para o cliente"}
            </p>
          )}
        </div>
        {canManuallyAdvanceProcess && (
          <button
            onClick={() => setShowUpdateModal(true)}
            className="p-1 hover:bg-gray-100 rounded transition shrink-0"
            aria-label="Alterar status"
          >
            <Edit2 size={18} />
          </button>
        )}
        {canRejectProcess && (
          <button
            ref={rejectionTriggerRef}
            type="button"
            onClick={() => setShowRejectModal(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
          >
            <XCircle size={16} />
            Recusar processo
          </button>
        )}
        {onToggleExpand && (
          <button
            onClick={onToggleExpand}
            className="p-1 hover:bg-gray-100 rounded transition shrink-0"
            aria-label="Toggle details"
          >
            <ChevronDown
              size={20}
              className={`transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </button>
        )}
      </div>

      {isClientView && <SpecialistContactCard process={process} />}

      {/* Stepper/Timeline - Vertical on mobile, Horizontal on tablet+ */}
      {!isClientView && <ConsultancyReason reason={process.consultancy_reason} />}
      <div className="px-3 py-4 md:px-6 md:py-6">
        {/* Contextual Status Message - No redundant badge */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            {process.status === "PROCESSING_CONTRACT" && (
              <Loader2 size={18} className="animate-spin text-orange-600" />
            )}
            {isRejected && <X size={18} className="text-red-600" />}
            <p
              className={`text-sm font-medium ${
                isRejected ? "text-red-600" : "text-gray-700"
              }`}
            >
              {getContextualStatusMessage(
                process.status,
                completionReason,
                process.rejection_reason,
              )}
            </p>
          </div>
          {formattedAppointmentDate && formattedAppointmentTime && (
            <p className="mt-2 text-xs text-slate-700">
              Reunião agendada para <strong>{formattedAppointmentDate}</strong> às{" "}
              <strong>{formattedAppointmentTime}</strong>
              {isAppointmentConfirmed
                ? "."
                : process.appointment_scheduling_method === "CALENDLY"
                  ? " (aguardando sincronização do Calendly)."
                  : " (aguardando confirmação do especialista)."}
            </p>
          )}
          {process.specialist_rescheduled_at && (
            <p className="mt-2 text-xs font-semibold text-amber-700">
              Horário alterado definitivamente
            </p>
          )}
        </div>

        {/* Appointment Confirmation Buttons - SCHEDULING Status (before appointment confirmation) */}
        {process.status === "SCHEDULING" && process.appointment_status === "PENDING" && process.appointment_id && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-amber-900 mb-2">
                {isClientView
                  ? process.appointment_scheduling_method === "CALENDLY"
                    ? "Aguardando sincronização do Calendly"
                    : "Aguardando confirmação do especialista"
                  : "Solicitação de agendamento"}
              </p>
              {dateTimeActionError && dateTimeAction === null && (
                <p role="alert" className="text-sm text-red-700">{dateTimeActionError}</p>
              )}

              {!isClientView ? (
                // Specialist view - Confirm or Reject buttons
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleCancelAppointment}
                    disabled={isCancelling || isConfirming}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    {isCancelling ? (
                      <Loader2 className="animate-spin h-4 w-4 text-gray-700" />
                    ) : (
                      <>
                        <XCircle size={16} />
                        Recusar
                      </>
                    )}
                  </button>
                  {hasValidScheduledMeetingDate ||
                  process.appointment_scheduling_method === "EMAIL" ||
                  process.appointment_scheduling_method == null ? (
                    <>
                      {hasValidScheduledMeetingDate && (
                        <button
                          onClick={(event) => {
                            dateTimeTriggerRef.current = event.currentTarget;
                            void handleConfirmAppointment(process.appointment_datetime!);
                          }}
                          disabled={isConfirming || isCancelling}
                          aria-busy={isConfirming}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
                        >
                          {isConfirming ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle size={16} />}
                          Confirmar horário
                        </button>
                      )}
                      <button
                        onClick={(event) => {
                          dateTimeTriggerRef.current = event.currentTarget;
                          setDateTimeActionError(null);
                          setDateTimeAction("confirm");
                        }}
                        disabled={isConfirming || isCancelling}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-green-600 text-green-700 rounded-lg font-medium hover:bg-green-50 transition disabled:opacity-50"
                      >
                        <Clock size={16} />
                        Alterar e confirmar
                      </button>
                    </>
                  ) : (
                    <p className="flex-1 self-center text-center text-xs text-amber-800">
                      Aguardando sincronização do Calendly
                    </p>
                  )}
                </div>
              ) : (
                // Client view - Only Cancel button
                <button
                  onClick={handleCancelAppointment}
                  disabled={isCancelling}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-50 border border-red-300 text-red-700 rounded-lg font-medium hover:bg-red-100 transition disabled:opacity-50"
                >
                  {isCancelling ? (
                    <Loader2 className="animate-spin h-4 w-4 text-red-700" />
                  ) : (
                    <>
                      <XCircle size={16} />
                      Cancelar Agendamento
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Meeting actions - after appointment confirmation */}
        {canStartOrJoinMeeting && (
          <div className="mb-4 p-3 bg-slate-100 border border-slate-300 rounded-lg">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-slate-900 mb-1">
                Reunião confirmada
              </p>
              {!isClientView ? (
                <>
                  <p className="text-xs text-slate-700 mb-2">
                    {isConsultancy
                      ? "Agora selecione o produto para iniciar a negociação com o cliente."
                      : "Inicie a reunião com o cliente ou entre na reunião já criada."}
                  </p>
                  {canSpecialistReschedule && (
                    <button
                      type="button"
                      onClick={(event) => {
                        dateTimeTriggerRef.current = event.currentTarget;
                        setDateTimeActionError(null);
                        setDateTimeAction("reschedule");
                      }}
                      className="w-full mb-2 inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-amber-400 text-amber-800 rounded-lg font-medium hover:bg-amber-50 transition"
                    >
                      <Clock size={16} />
                      Alterar horário
                    </button>
                  )}
                  <button
                    onClick={
                      meetingSession ? handleJoinMeeting : handleStartMeeting
                    }
                    disabled={isStartingMeeting || isLoadingMeeting}
                    className="w-full mb-2 inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan-700 text-white rounded-lg font-medium hover:bg-cyan-800 transition disabled:opacity-50"
                  >
                    {isStartingMeeting || isLoadingMeeting ? (
                      <Loader2 className="animate-spin h-4 w-4 text-white" />
                    ) : (
                      <>
                        <Video size={16} />
                        {meetingSession ? "Entrar Reunião" : "Iniciar Reunião"}
                      </>
                    )}
                  </button>
                  {meetingSession && !meetingSession.ended_at && (
                    <button
                      onClick={handleConversationDone}
                      disabled={isConversationDoneLoading}
                      className="w-full mb-2 inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg font-medium hover:bg-emerald-800 transition disabled:opacity-50"
                    >
                      {isConversationDoneLoading ? (
                        <Loader2 className="animate-spin h-4 w-4 text-white" />
                      ) : (
                        <>
                          <CheckCircle size={16} />
                          Já conversei com o cliente
                        </>
                      )}
                    </button>
                  )}
                  {isConsultancy && onSelectProduct && (
                    <button
                      onClick={onSelectProduct}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition"
                    >
                      <Package size={16} />
                      Selecionar Produto
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-700 mb-2">
                    {isConsultancy
                      ? "O especialista está escolhendo o produto ideal para iniciar a negociação."
                      : "Aguardando o especialista iniciar a reunião."}
                  </p>
                  {meetingSession ? (
                    !meetingSession.ended_at ? (
                      <button
                        onClick={handleJoinMeeting}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan-700 text-white rounded-lg font-medium hover:bg-cyan-800 transition"
                      >
                        <Video size={16} />
                        Entrar Reunião
                      </button>
                    ) : (
                      <p className="text-xs text-slate-600">
                        A reunião foi encerrada pelo especialista.
                      </p>
                    )
                  ) : null}
                </>
              )}
            </div>
          </div>
        )}


        {/* Mobile: botões logo abaixo do status, antes do stepper */}
        {process.status === "NEGOTIATION" && !isConsultancy && !isExpanded && (
          <div className="md:hidden w-full mb-2 flex flex-col gap-2">
            <button
              onClick={() =>
                navigate(
                  adminJourney
                    ? adminJourneyRoute("negotiation", process.id)
                    : `/processes/${process.id}/negotiation`,
                )
              }
              className="w-full px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg shadow-lg hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-1"
            >
              <MessageSquare size={14} />
              Negociar
            </button>
          </div>
        )}

        {/* Mobile: botão para enviar contrato em DOCUMENTATION */}
        {process.status === "DOCUMENTATION" &&
          onUploadDocuments &&
          canPrepareContract &&
          !isExpanded &&
          !isClientView && (
            <div className="md:hidden w-full mb-2 flex flex-col gap-2">
              <button
                onClick={onUploadDocuments}
                className="w-full px-4 py-2 bg-orange-600 text-white text-xs font-medium rounded-lg shadow-lg hover:bg-orange-700 transition-colors inline-flex items-center justify-center gap-1"
              >
                Enviar Contrato
              </button>
            </div>
          )}

        {/* Desabilitar upload enquanto processa contrato */}

        {/* Document Link: Show if in DOCUMENTATION or COMPLETED status and contract exists with S3 URL */}
        {(process.status === "DOCUMENTATION" ||
          process.status === "COMPLETED") &&
          activeContract && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600 font-medium">
                    Documento Enviado
                  </p>
                  <p className="text-sm text-blue-900 font-semibold truncate">
                    {activeContract.file_name || "Contrato"}
                  </p>
                </div>
                {activeContract.original_pdf_url ? (
                  <a
                    href={activeContract.original_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    Baixar
                    <ExternalLink size={14} />
                  </a>
                ) : (
                  <span className="text-xs text-gray-500 italic">
                    Documento disponível para download na plataforma Docusign
                  </span>
                )}
              </div>
              {/* Contract signing status */}
              {activeContract.status === 'SIGNED' && activeContract.signed_at && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-green-700">
                  <CheckCircle size={14} />
                  <span>Assinado em {new Date(activeContract.signed_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
              {activeContract.status === 'PENDING' && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-yellow-700">
                  <Clock size={14} />
                  <span>Aguardando assinatura</span>
                </div>
              )}
              {activeContract.status === 'REJECTED' && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-red-700">
                  <XCircle size={14} />
                  <span>Contrato recusado ou cancelado</span>
                </div>
              )}
              <p className="mt-2 text-xs text-blue-800">
                Estado externo: {activeContract.provider_status || activeContract.status}
              </p>
            </div>
          )}

        <div className="hidden md:flex md:items-center md:justify-between">
          {/* Horizontal Stepper (Tablet and up) */}
          {stepLabels.map((label, index) => {
            const isCompleted = index <= currentStep;
            const isActive = index === currentStep;
            const isRejectedStep = isRejected && index === 3; // Último step quando rejeitado

            return (
              <React.Fragment key={index}>
                {/* Step Circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                      isRejectedStep
                        ? "bg-red-500 text-white"
                        : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-gray-300 text-gray-600"
                    } ${
                      isActive && !isRejectedStep
                        ? "ring-2 ring-green-300 ring-offset-2"
                        : ""
                    } ${
                      isRejectedStep ? "ring-2 ring-red-300 ring-offset-2" : ""
                    }`}
                  >
                    {isRejectedStep && <X size={20} />}
                    {!isRejectedStep && isCompleted && <Check size={20} />}
                    {!isRejectedStep && !isCompleted && (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium mt-2 text-center max-w-20 ${
                      isRejectedStep
                        ? "text-red-600"
                        : isCompleted
                          ? "text-gray-900"
                          : "text-gray-500"
                    }`}
                  >
                    {label}
                  </span>
                </div>

                {/* Connecting Line (not on last step) */}
                {index < stepLabels.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 transition-all ${
                      isRejected && index >= currentStep - 1
                        ? "bg-red-400"
                        : index < currentStep
                          ? "bg-green-500"
                          : "bg-gray-300"
                    }`}
                    style={{ minWidth: "40px" }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Vertical Stepper (Mobile only) */}
        <div className="flex md:hidden flex-col">
          {stepLabels.map((label, index) => {
            const isCompleted = index <= currentStep;
            const isActive = index === currentStep;
            const isRejectedStep = isRejected && index === 3; // Último step quando rejeitado

            return (
              <div key={index} className="flex gap-3">
                <div className="flex flex-col items-center">
                  {/* Step Circle */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold transition-all shrink-0 ${
                      isRejectedStep
                        ? "bg-red-500 text-white"
                        : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-gray-300 text-gray-600"
                    } ${
                      isActive && !isRejectedStep
                        ? "ring-2 ring-green-300 ring-offset-1"
                        : ""
                    } ${
                      isRejectedStep ? "ring-2 ring-red-300 ring-offset-1" : ""
                    }`}
                  >
                    {isRejectedStep && <X size={16} />}
                    {!isRejectedStep && isCompleted && <Check size={16} />}
                    {!isRejectedStep && !isCompleted && (
                      <span className="text-xs">{index + 1}</span>
                    )}
                  </div>

                  {/* Vertical Line (not on last step) */}
                  {index < stepLabels.length - 1 && (
                    <div
                      className={`w-1 h-6 transition-all ${
                        isRejected && index >= currentStep - 1
                          ? "bg-red-400"
                          : index < currentStep
                            ? "bg-green-500"
                            : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>

                {/* Step Label */}
                <div className="pb-6 flex items-center md:hidden">
                  <span
                    className={`text-xs font-medium ${
                      isRejectedStep
                        ? "text-red-600"
                        : isCompleted
                          ? "text-gray-900"
                          : "text-gray-500"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expandable Details Section */}
      {isExpanded && (
        <div className="px-3 py-4 md:px-6 md:py-4 bg-gray-50 border-t border-gray-100">
          {adminJourney && (
            <div className="mb-4 rounded-lg border border-border bg-surface p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Última ação delegada
              </p>
              {delegatedTimeline[0] ? (
                <p className="mt-1 text-sm text-ink">
                  {delegatedTimeline[0].action} por{" "}
                  <strong>
                    {delegatedTimeline[0].actor.name || delegatedTimeline[0].actor.id}
                  </strong>{" "}
                  ({delegatedTimeline[0].actor.role}), em nome do especialista,
                  em {new Date(delegatedTimeline[0].createdAt).toLocaleString("pt-BR")}.
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">
                  Nenhuma ação administrativa registrada neste processo.
                </p>
              )}
            </div>
          )}
          {product && (
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                <div>
                  <p className="text-xs text-gray-600 font-medium">Categoria</p>
                  <p className="text-xs md:text-sm font-semibold text-gray-900 truncate">
                    {process.product_type === "CAR"
                      ? "Carros"
                      : process.product_type === "BOAT"
                        ? "Embarcações"
                        : "Aeronaves"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-medium">Modelo</p>
                  <p className="text-xs md:text-sm font-semibold text-gray-900 truncate">
                    {product.modelo}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-medium">Ano</p>
                  <p className="text-xs md:text-sm font-semibold text-gray-900">
                    {product.ano}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-medium">Estado</p>
                  <p className="text-xs md:text-sm font-semibold text-gray-900 truncate">
                    {product.estado || "Não especificado"}
                  </p>
                </div>
              </div>

              {/* Description */}
              {product.descricao && (
                <div>
                  <p className="text-xs text-gray-600 font-medium mb-1">
                    Descrição
                  </p>
                  <p className="text-xs md:text-sm text-gray-700 line-clamp-3">
                    {product.descricao}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-3 border-t border-gray-200">
            {/* A única transição manual aceita pelo backend. */}
            {canManuallyAdvanceProcess && (
              <button
                onClick={() => setShowUpdateModal(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 md:px-4 md:py-2 border border-slate-700 text-slate-700 text-xs md:text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Edit2 size={16} />
                Alterar Status
              </button>
            )}

            {/* Negotiation Button: Only show if status is NEGOTIATION and process has product */}
            {process.status === "NEGOTIATION" && !isConsultancy && (
              <button
                onClick={() =>
                  navigate(
                    adminJourney
                      ? adminJourneyRoute("negotiation", process.id)
                      : `/processes/${process.id}/negotiation`,
                  )
                }
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-blue-600 text-white text-xs md:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                <MessageSquare size={16} />
                Ver Negociação
              </button>
            )}

            {/* Upload Contract Button: Only show if status is DOCUMENTATION */}
            {process.status === "DOCUMENTATION" &&
              onUploadDocuments &&
              canPrepareContract && (
              <button
                onClick={onUploadDocuments}
                className="flex-1 px-3 py-2 md:px-4 md:py-2 bg-orange-600 text-white text-xs md:text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap"
              >
                Enviar Contrato
              </button>
            )}
          </div>

          {/* Advance process — specialist only, NEGOTIATION, low prominence */}
          {canManuallyAdvanceProcess && (
            <div className="flex items-center justify-end gap-2 mt-2">
              {!showAdvanceConfirm ? (
                <button
                  onClick={() => setShowAdvanceConfirm(true)}
                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ChevronRight size={12} />
                  Avançar processo
                </button>
              ) : (
                <>
                  <span className="text-xs text-gray-500">
                    Avançar para documentação?
                  </span>
                  <button
                    onClick={handleAdvanceProcess}
                    disabled={isAdvancing}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {isAdvancing ? (
                      <Loader2 className="animate-spin h-3 w-3 text-gray-600" />
                    ) : (
                      <Check size={12} />
                    )}
                    Confirmar
                  </button>
                  <button
                    onClick={() => {
                      setShowAdvanceConfirm(false);
                      setAdvanceError(null);
                    }}
                    disabled={isAdvancing}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </>
              )}
              {advanceError && (
                <p className="text-xs text-red-500">{advanceError}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Update Status Modal */}
      <UpdateProcessStatusModal
        isOpen={showUpdateModal || showRejectModal}
        action={showRejectModal ? "reject" : "status"}
        returnFocusRef={rejectionTriggerRef}
        onClose={() => {
          setShowUpdateModal(false);
          setShowRejectModal(false);
        }}
        onSuccess={() => {
          setShowUpdateModal(false);
          setShowRejectModal(false);
          onStatusUpdated?.();
        }}
        process={process}
        reasonRequired={adminJourney}
      />

      <AppointmentDateTimeModal
        open={dateTimeAction !== null}
        initialValue={process.appointment_datetime || undefined}
        returnFocusRef={dateTimeTriggerRef}
        title={
          dateTimeAction === "reschedule"
            ? "Alterar horário"
            : "Alterar e confirmar"
        }
        description={
          dateTimeAction === "reschedule"
            ? "Escolha o novo horário da reunião."
            : "Informe a data e a hora combinadas com o cliente."
        }
        submitLabel={
          dateTimeAction === "reschedule"
            ? "Confirmar alteração"
            : "Confirmar horário"
        }
        definitiveWarning={
          dateTimeAction === "reschedule"
            ? "Esta é a única alteração permitida. O novo horário passa a valer imediatamente e não dependerá de confirmação do cliente."
            : undefined
        }
        busy={isConfirming || isRescheduling}
        serverError={dateTimeActionError}
        onClearServerError={() => setDateTimeActionError(null)}
        onOpenChange={(open) => {
          if (!open) {
            setDateTimeAction(null);
            setDateTimeActionError(null);
          }
        }}
        onSubmit={
          dateTimeAction === "reschedule"
            ? handleReschedule
            : handleConfirmAppointment
        }
      />
    </div>
  );
}
