import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Copy, ExternalLink, Video } from "lucide-react";
import { useAuth } from "../../store/authStateManager";
import {
  getProcessById,
  getMeetingByProcess,
  markConversationDone,
  startMeeting,
  type MeetingSession,
} from "../../services/processes.service";
import { BackButton } from "../../components/patterns/BackButton";
import Button from "../../components/ui/button";

function isJitsiLink(url?: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "meet.jit.si" || parsed.hostname.endsWith(".jit.si")
    );
  } catch {
    return false;
  }
}

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

export default function MeetingRoomPage() {
  const { processId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [meeting, setMeeting] = useState<MeetingSession | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false);
  const [isConversationDoneLoading, setIsConversationDoneLoading] =
    useState(false);
  const [copied, setCopied] = useState(false);

  const isSpecialist = user?.role === "SPECIALIST";

  useEffect(() => {
    const loadMeeting = async () => {
      if (!processId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const [foundMeeting, processData] = await Promise.all([
          getMeetingByProcess(processId),
          getProcessById(processId),
        ]);
        setMeeting(foundMeeting);
        setScheduledAt(processData.appointment_datetime ?? null);
      } catch (error) {
        alert(
          getActionErrorMessage(error, "Erro ao carregar reunião do processo."),
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadMeeting();
  }, [processId]);

  const handleStartMeeting = async () => {
    if (!processId || !isSpecialist || isStarting) return;

    try {
      setIsStarting(true);
      const startedMeeting = await startMeeting(processId);
      setMeeting(startedMeeting);
    } catch (error) {
      alert(getActionErrorMessage(error, "Erro ao iniciar reunião."));
    } finally {
      setIsStarting(false);
    }
  };

  const handleAdvanceMeeting = async () => {
    if (!processId || !isSpecialist || isAdvancing) return;

    setShowAdvanceConfirm(false);
    try {
      setIsAdvancing(true);
      const startedMeeting = await startMeeting(processId, { isAdvanced: true });
      setMeeting(startedMeeting);
    } catch (error) {
      alert(getActionErrorMessage(error, "Erro ao antecipar reunião."));
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!meeting?.meet_link) return;

    await navigator.clipboard.writeText(meeting.meet_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleConversationDone = async () => {
    if (!processId || !isSpecialist || isConversationDoneLoading) return;

    try {
      setIsConversationDoneLoading(true);
      const result = await markConversationDone(processId);
      setMeeting(result.meeting);

      if (result.processTransition.requires_product_selection) {
        alert(
          "Conversa concluída. Agora selecione um produto para continuar o processo.",
        );
      } else {
        alert(result.processTransition.message);
      }
    } catch (error) {
      alert(getActionErrorMessage(error, "Erro ao concluir conversa."));
    } finally {
      setIsConversationDoneLoading(false);
    }
  };

  if (!processId) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="bg-surface rounded-lg border border-border p-6 max-w-xl w-full text-center">
          <p className="text-ink-soft font-medium">Processo inválido.</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  const hasValidScheduledDate =
    Boolean(scheduledDate) && !Number.isNaN(scheduledDate?.getTime() ?? NaN);

  return (
    <div className="min-h-screen bg-bg">
      {showAdvanceConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="bg-surface rounded-xl border border-border shadow-ds-modal max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-ink mb-2">
              Antecipar Reunião
            </h2>
            <p className="text-sm text-ink-soft mb-6">
              Deseja antecipar a reunião? O cliente receberá um e-mail
              informando que a reunião começará agora.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="light" onClick={() => setShowAdvanceConfirm(false)}>
                Cancelar
              </Button>
              <button
                onClick={handleAdvanceMeeting}
                disabled={isAdvancing}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {isAdvancing ? "Aguarde..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <BackButton className="mb-4" />

        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <Video className="text-cyan-700" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-ink">
                Sala de Reunião
              </h1>
              <p className="text-sm text-muted">Processo {processId}</p>
            </div>
          </div>

          {hasValidScheduledDate ? (
            <div className="mb-4 bg-status-sched-wash border border-status-sched-line rounded-lg p-3">
              <p className="text-sm text-status-sched">
                Reunião agendada para{" "}
                <strong>
                  {scheduledDate!.toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </strong>{" "}
                às{" "}
                <strong>
                  {scheduledDate!.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
                .
              </p>
            </div>
          ) : (
            !meeting && (
              <div className="mb-4 bg-status-neg-wash border border-status-neg-line rounded-lg p-3">
                <p className="text-sm text-status-neg">
                  {isSpecialist
                    ? "Nenhum horário confirmado. Você pode iniciar a reunião a qualquer momento — o cliente receberá um e-mail com o link assim que você iniciar."
                    : "Nenhum horário confirmado. Quando o especialista iniciar a reunião, você receberá um e-mail com o link de acesso."}
                </p>
              </div>
            )
          )}

          {isLoading ? (
            <p className="text-sm text-muted">Carregando reunião...</p>
          ) : !meeting ? (
            <div className="bg-border-soft border border-border rounded-lg p-4">
              {isSpecialist ? (
                <>
                  <p className="text-sm text-ink-soft mb-3">
                    A reunião ainda não foi iniciada. Inicie agora para liberar
                    o acesso do cliente na plataforma e enviar a notificação.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleStartMeeting}
                      disabled={isStarting || isAdvancing}
                      className="inline-flex items-center gap-2"
                    >
                      {isStarting ? "Iniciando..." : "Iniciar reunião"}
                    </Button>
                    {hasValidScheduledDate && (
                      <button
                        onClick={() => setShowAdvanceConfirm(true)}
                        disabled={isStarting || isAdvancing}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                      >
                        {isAdvancing ? "Aguarde..." : "Antecipar Reunião"}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-soft">
                  O especialista ainda não iniciou a reunião. Assim que iniciar,
                  o link aparecerá aqui e também será enviado ao seu e-mail.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {isJitsiLink(meeting.meet_link) && !meeting.ended_at && (
                <div className="rounded-lg border border-border overflow-hidden bg-black">
                  <iframe
                    src={meeting.meet_link}
                    title="Sala de reunião"
                    allow="camera; microphone; fullscreen; display-capture; autoplay"
                    className="w-full h-[72vh] min-h-[520px]"
                  />
                </div>
              )}

              {meeting.ended_at && (
                <div className="bg-border-soft border border-border rounded-lg p-4">
                  <p className="text-sm text-ink-soft">
                    Esta reunião foi encerrada. Para continuar, siga com os
                    próximos passos do processo.
                  </p>
                </div>
              )}

              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                <p className="text-sm text-cyan-900 font-medium mb-2">
                  Link da reunião
                </p>
                <a
                  href={meeting.meet_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-cyan-800 break-all underline"
                >
                  {meeting.meet_link}
                </a>
              </div>

              <div className="flex flex-wrap gap-2">
                {isSpecialist && !meeting.ended_at && (
                  <Button
                    onClick={handleConversationDone}
                    disabled={isConversationDoneLoading}
                    className="inline-flex items-center gap-2"
                  >
                    {isConversationDoneLoading
                      ? "Processando..."
                      : "Já conversei com o cliente"}
                  </Button>
                )}

                {!isJitsiLink(meeting.meet_link) && (
                  <a
                    href={meeting.meet_link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 font-semibold py-2 px-4 rounded-lg cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[--color-button-solid] active:scale-95 bg-button-solid text-white hover:bg-[--color-button-solid-hover]"
                  >
                    <ExternalLink size={16} /> Entrar na Reunião
                  </a>
                )}

                <Button
                  variant="light"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-2"
                >
                  <Copy size={16} /> {copied ? "Link copiado" : "Copiar link"}
                </Button>
              </div>

              <p className="text-xs text-muted">
                Especialista: compartilhe este link com o cliente se necessário.
              </p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-border-soft">
            <Link
              to={
                user?.role === "SPECIALIST"
                  ? "/specialist/processes"
                  : user?.role === "CONSULTANT"
                    ? "/consultant/processes"
                    : "/customer/processes"
              }
              className="text-sm text-ink-soft hover:text-ink"
            >
              Voltar para processos
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
