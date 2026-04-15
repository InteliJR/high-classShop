import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, ExternalLink, Video } from "lucide-react";
import { useAuth } from "../../store/authStateManager";
import {
  getProcessById,
  getMeetingByProcess,
  markConversationDone,
  startMeeting,
  type MeetingSession,
} from "../../services/processes.service";

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-xl w-full text-center">
          <p className="text-gray-800 font-medium">Processo inválido.</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  const hasValidScheduledDate =
    Boolean(scheduledDate) && !Number.isNaN(scheduledDate?.getTime() ?? NaN);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <Video className="text-cyan-700" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Sala de Reunião
              </h1>
              <p className="text-sm text-gray-600">Processo {processId}</p>
            </div>
          </div>

          {hasValidScheduledDate && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-900">
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
          )}

          {isLoading ? (
            <p className="text-sm text-gray-600">Carregando reunião...</p>
          ) : !meeting ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              {isSpecialist ? (
                <>
                  <p className="text-sm text-slate-800 mb-3">
                    A reunião ainda não foi iniciada. Inicie agora para liberar
                    o acesso do cliente na plataforma e enviar a notificação.
                  </p>
                  <button
                    onClick={handleStartMeeting}
                    disabled={isStarting}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-700 text-white rounded-lg hover:bg-cyan-800 disabled:opacity-50"
                  >
                    {isStarting ? "Iniciando..." : "Iniciar reunião"}
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-800">
                  O especialista ainda não iniciou a reunião. Assim que iniciar,
                  o link aparecerá aqui e também será enviado ao seu e-mail.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {isJitsiLink(meeting.meet_link) && !meeting.ended_at && (
                <div className="rounded-lg border border-gray-200 overflow-hidden bg-black">
                  <iframe
                    src={meeting.meet_link}
                    title="Sala de reunião"
                    allow="camera; microphone; fullscreen; display-capture; autoplay"
                    className="w-full h-[72vh] min-h-[520px]"
                  />
                </div>
              )}

              {meeting.ended_at && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="text-sm text-slate-800">
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
                  <button
                    onClick={handleConversationDone}
                    disabled={isConversationDoneLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {isConversationDoneLoading
                      ? "Processando..."
                      : "Já conversei com o cliente"}
                  </button>
                )}

                {!isJitsiLink(meeting.meet_link) && (
                  <a
                    href={meeting.meet_link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-700 text-white rounded-lg hover:bg-cyan-800"
                  >
                    <ExternalLink size={16} /> Entrar na Reunião
                  </a>
                )}

                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  <Copy size={16} /> {copied ? "Link copiado" : "Copiar link"}
                </button>
              </div>

              <p className="text-xs text-gray-600">
                Especialista: compartilhe este link com o cliente se necessário.
              </p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-100">
            <Link
              to={
                user?.role === "SPECIALIST"
                  ? "/specialist/processes"
                  : "/customer/processes"
              }
              className="text-sm text-slate-700 hover:text-slate-900"
            >
              Voltar para processos
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
