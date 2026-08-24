import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  DollarSign,
  Loader2,
  MessageSquare,
  Package,
  RefreshCw,
  Send,
  User,
  UserCog,
  Video,
  X,
} from "lucide-react";
import {
  acceptProposal,
  createProposal,
  getProcessProposals,
  rejectProposal,
  type NegotiationMeta,
  type NegotiationProcessInfo,
  type NegotiationProposal,
} from "../../services/proposals.service";
import {
  getMeetingByProcess,
  getProcessById,
  type MeetingSession,
  type Process,
} from "../../services/processes.service";
import { useAuth } from "../../store/authStateManager";
import { Card } from "../../components/ui/card";
import Button from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { PageHeader } from "../../components/patterns/PageHeader";
import { StatusBadge } from "../../components/patterns/StatusBadge";
import { ProposalStatusBadge } from "../../components/patterns/ProposalStatusBadge";
import { formatCurrency } from "../../lib/currency";

const PRODUCT_LABELS: Record<string, string> = {
  CAR: "Carro",
  BOAT: "Embarcação",
  AIRCRAFT: "Aeronave",
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ConsultantProcessDetailPage() {
  const { processId } = useParams<{ processId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [process, setProcess] = useState<Process | null>(null);
  const [proposals, setProposals] = useState<NegotiationProposal[]>([]);
  const [processInfo, setProcessInfo] =
    useState<NegotiationProcessInfo | null>(null);
  const [meta, setMeta] = useState<NegotiationMeta | null>(null);
  const [meetingSession, setMeetingSession] = useState<MeetingSession | null>(
    null,
  );
  const [isLoadingMeeting, setIsLoadingMeeting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [proposedValue, setProposedValue] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [pendingActionProposalId, setPendingActionProposalId] = useState<
    string | null
  >(null);

  const timelineRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!processId) return;

    try {
      setIsLoading(true);
      setError(null);

      const processData = await getProcessById(processId);
      setProcess(processData);

      // Durante o agendamento não há negociação ainda — só o agendamento e a
      // reunião. As propostas só são carregadas a partir da negociação.
      const isScheduling = processData.status === "SCHEDULING";
      const isAppointmentConfirmed =
        processData.appointment_status === "SCHEDULED" ||
        processData.appointment_status === "COMPLETED";

      if (isScheduling) {
        setProposals([]);
        setProcessInfo(null);
        setMeta(null);

        if (isAppointmentConfirmed) {
          try {
            setIsLoadingMeeting(true);
            const meeting = await getMeetingByProcess(processId);
            setMeetingSession(meeting);
          } catch (err) {
            console.warn(
              "[ConsultantProcessDetailPage] Falha ao carregar reunião",
              err,
            );
            setMeetingSession(null);
          } finally {
            setIsLoadingMeeting(false);
          }
        } else {
          setMeetingSession(null);
        }
        return;
      }

      setMeetingSession(null);

      const hasProduct = !!processData.product_type && !!processData.product_id;
      if (hasProduct) {
        try {
          const response = await getProcessProposals(processId);
          if (response.success) {
            setProposals(response.data);
            setProcessInfo(response.process);
            setMeta(response.meta);
          }
        } catch (err) {
          console.warn(
            "[ConsultantProcessDetailPage] Falha ao carregar propostas",
            err,
          );
        }
      } else {
        setProposals([]);
        setProcessInfo(null);
        setMeta(null);
      }
    } catch (err) {
      console.error("[ConsultantProcessDetailPage] Erro:", err);
      setError(
        err instanceof Error ? err.message : "Erro ao carregar processo",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId]);

  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [proposals]);

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const numeric = parseInt(raw) || 0;
    const formatted = (numeric / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setProposedValue(formatted);
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!processId || !processInfo) return;

    const value = parseFloat(proposedValue.replace(/\D/g, "")) / 100;

    if (isNaN(value) || value <= 0) {
      setFormError("Informe um valor válido.");
      return;
    }

    if (value < processInfo.minimum_value) {
      setFormError(
        `O valor mínimo permitido é ${formatCurrency(processInfo.minimum_value, processInfo.currency)}.`,
      );
      return;
    }

    const lastPending = proposals.find((p) => p.status === "PENDING");

    try {
      setIsSending(true);
      await createProposal({
        process_id: processId,
        proposed_value: value,
        message: message || undefined,
        counter_to_id: lastPending?.id,
      });
      setProposedValue("");
      setMessage("");
      await load();
    } catch (err) {
      console.error("[ConsultantProcessDetailPage] Erro ao enviar:", err);
      setFormError(
        err instanceof Error ? err.message : "Erro ao enviar proposta.",
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleAccept = async (proposalId: string) => {
    try {
      setPendingActionProposalId(proposalId);
      await acceptProposal(proposalId, "Proposta aceita pelo consultor");
      await load();
    } catch (err) {
      console.error("[ConsultantProcessDetailPage] Erro ao aceitar:", err);
      setError(err instanceof Error ? err.message : "Erro ao aceitar proposta");
    } finally {
      setPendingActionProposalId(null);
    }
  };

  const handleReject = async (proposalId: string) => {
    try {
      setPendingActionProposalId(proposalId);
      await rejectProposal(proposalId, "Proposta rejeitada pelo consultor");
      await load();
    } catch (err) {
      console.error("[ConsultantProcessDetailPage] Erro ao rejeitar:", err);
      setError(
        err instanceof Error ? err.message : "Erro ao rejeitar proposta",
      );
    } finally {
      setPendingActionProposalId(null);
    }
  };

  const canCreateProposal = (): boolean => {
    if (!processInfo || !meta) return false;
    if (processInfo.status !== "NEGOTIATION") return false;
    return meta.can_create_proposal;
  };

  const canRespondToProposal = (proposal: NegotiationProposal): boolean => {
    if (!user || proposal.status !== "PENDING") return false;
    if (processInfo?.status !== "NEGOTIATION") return false;
    // Consultor atua pelo cliente: pode responder quando proposta é destinada ao cliente
    return (
      proposal.proposed_to.id === user.id ||
      proposal.proposed_to.role === "CUSTOMER"
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-600">
        <Loader2 className="animate-spin mr-2" size={20} />
        Carregando processo...
      </div>
    );
  }

  if (error || !process) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="text-status-bad mb-3" size={40} />
        <h2 className="text-lg font-semibold text-ink mb-1">
          Não foi possível carregar o processo
        </h2>
        <p className="text-sm text-muted mb-4">
          {error ?? "Processo não encontrado."}
        </p>
        <Button type="button" onClick={() => navigate("/consultant/processes")}>
          <ArrowLeft size={18} />
          Voltar para processos
        </Button>
      </div>
    );
  }

  const productLabel = process.product_type
    ? PRODUCT_LABELS[process.product_type] ?? process.product_type
    : "Consultoria";

  const acceptedProposal = proposals.find((p) => p.status === "ACCEPTED");
  const isAwaitingProduct = !process.product_type || !process.product_id;
  const showCreateForm = canCreateProposal();
  const isScheduling = process.status === "SCHEDULING";
  const isAppointmentConfirmed =
    process.appointment_status === "SCHEDULED" ||
    process.appointment_status === "COMPLETED";

  return (
    <div className="text-text-main w-full">
      <PageHeader
        title="Detalhes do processo"
        showBack
        backTo="/consultant/processes"
        actions={
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-border-soft"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        }
      />
      <p className="text-sm text-muted -mt-4 mb-6">
        Acompanhe e atue na negociação em nome do cliente.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            <User size={14} />
            Cliente
          </div>
          <p className="text-sm font-medium text-ink">
            {process.client?.name ?? "—"}
          </p>
          {process.client?.email && (
            <p className="text-xs text-muted mt-1">{process.client.email}</p>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            <UserCog size={14} />
            Especialista
          </div>
          <p className="text-sm font-medium text-ink">
            {process.specialist?.name ?? "—"}
          </p>
          {process.specialist?.especialidade && (
            <p className="text-xs text-muted mt-1">
              {process.specialist.especialidade}
            </p>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            <Package size={14} />
            Produto
          </div>
          <p className="text-sm font-medium text-ink">{productLabel}</p>
          {process.product && (
            <p className="text-xs text-muted mt-1 truncate">
              {[process.product.marca, process.product.modelo]
                .filter(Boolean)
                .join(" ")}
              {process.product.ano ? ` • ${process.product.ano}` : ""}
            </p>
          )}
        </Card>
      </div>

      <Card className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">
            Status
          </span>
          <StatusBadge status={process.status} />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <Calendar size={14} className="text-subtle" />
          Criado em {formatDate(process.created_at)}
        </div>
        {process.appointment_datetime && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Calendar size={14} className="text-subtle" />
            Reunião: {formatDate(process.appointment_datetime)}
          </div>
        )}
        {process.rejection_reason && (
          <div className="flex items-center gap-2 text-sm text-status-bad">
            <AlertCircle size={14} />
            Motivo da rejeição: {process.rejection_reason}
          </div>
        )}
      </Card>

      {!isScheduling && processInfo && (
        <Card className="mb-6 flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-status-ok" />
            <span className="text-muted">Valor do produto:</span>
            <span className="font-semibold text-ink">
              {formatCurrency(processInfo.product_value, processInfo.currency)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* laranja mantido de propósito — destaque de atenção ao valor, não é um dos 6 status de processo */}
            <AlertCircle size={16} className="text-orange-500" />
            <span className="text-muted">Valor mínimo:</span>
            <span className="font-semibold text-orange-600">
              {formatCurrency(processInfo.minimum_value, processInfo.currency)}
            </span>
          </div>
          {acceptedProposal && (
            <div className="flex items-center gap-2">
              <Check size={16} className="text-status-ok" />
              <span className="text-muted">Valor aceito:</span>
              <span className="font-semibold text-status-ok">
                {formatCurrency(acceptedProposal.proposed_value, processInfo.currency)}
              </span>
            </div>
          )}
          {meta && (
            <div className="ml-auto text-xs text-subtle">
              {meta.total} {meta.total === 1 ? "proposta" : "propostas"}
            </div>
          )}
        </Card>
      )}

      {isScheduling ? (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-h2 font-semibold text-ink">Agendamento</h2>
          </div>

          <div className="mb-4">
            {isAppointmentConfirmed ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                <Check size={12} />
                Agendamento confirmado
              </span>
            ) : process.appointment_status === "CANCELLED" ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                <X size={12} />
                Agendamento cancelado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                <Loader2 size={12} className="animate-spin" />
                Aguardando confirmação do agendamento
              </span>
            )}
          </div>

          {process.appointment_datetime ? (
            <div className="flex items-center gap-2 text-sm text-ink-soft mb-4">
              <Calendar size={16} className="text-subtle" />
              Reunião marcada para {formatDate(process.appointment_datetime)}
            </div>
          ) : (
            <p className="text-sm text-muted mb-4">
              Data e horário ainda não definidos.
            </p>
          )}

          {isAppointmentConfirmed ? (
            <div className="p-4 bg-border-soft border border-border rounded-lg">
              {isLoadingMeeting ? (
                <p className="inline-flex items-center gap-2 text-sm text-muted">
                  <Loader2 size={16} className="animate-spin" />
                  Verificando reunião...
                </p>
              ) : meetingSession && !meetingSession.ended_at ? (
                <>
                  <p className="text-sm text-ink-soft mb-3">
                    O especialista iniciou a reunião. Entre para acompanhar em
                    nome do cliente.
                  </p>
                  <Button
                    type="button"
                    onClick={() =>
                      navigate(`/processes/${process.id}/meeting`)
                    }
                  >
                    <Video size={16} />
                    Entrar na reunião
                  </Button>
                </>
              ) : meetingSession?.ended_at ? (
                <p className="text-sm text-ink-soft">
                  A reunião foi encerrada pelo especialista.
                </p>
              ) : (
                <p className="text-sm text-ink-soft">
                  Aguardando o especialista iniciar a reunião. O acesso aparece
                  aqui assim que ela começar.
                </p>
              )}
            </div>
          ) : (
            <div className="p-4 bg-border-soft border border-border rounded-lg text-sm text-muted">
              A reunião ficará disponível assim que o agendamento for
              confirmado.
            </div>
          )}
        </Card>
      ) : (
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h2 font-semibold text-ink">Histórico de propostas</h2>
        </div>

        {isAwaitingProduct ? (
          <div className="text-center py-10 text-muted text-sm">
            A negociação ainda não foi iniciada. O especialista precisa
            associar um produto ao processo.
          </div>
        ) : proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <MessageSquare size={40} className="text-subtle mb-3" />
            <p className="text-sm text-muted">
              Nenhuma proposta enviada até o momento.
            </p>
          </div>
        ) : (
          <div
            ref={timelineRef}
            className="flex flex-col gap-3 max-h-[520px] overflow-y-auto pr-1"
          >
            {proposals.map((proposal) => (
              <div
                key={proposal.id}
                className="border border-border rounded-lg p-3"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs font-medium text-muted">
                    {proposal.proposed_by.name} {proposal.proposed_by.surname}
                    <span className="text-subtle">
                      {" "}
                      → {proposal.proposed_to.name}{" "}
                      {proposal.proposed_to.surname}
                    </span>
                  </span>
                  <span className="text-xs text-subtle">
                    {formatDate(proposal.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={16} className="text-green-600" />
                  <span className="text-lg font-bold text-ink">
                    {formatCurrency(proposal.proposed_value, processInfo?.currency)}
                  </span>
                </div>
                {proposal.message && (
                  <p className="text-sm text-muted mb-2">
                    {proposal.message}
                  </p>
                )}
                <ProposalStatusBadge status={proposal.status} />

                {canRespondToProposal(proposal) && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border-soft">
                    <Button
                      type="button"
                      onClick={() => handleAccept(proposal.id)}
                      disabled={pendingActionProposalId !== null}
                      className="flex-1"
                    >
                      {pendingActionProposalId === proposal.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Check size={16} />
                      )}
                      Aceitar
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => handleReject(proposal.id)}
                      disabled={pendingActionProposalId !== null}
                      className="flex-1"
                    >
                      {pendingActionProposalId === proposal.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <X size={16} />
                      )}
                      Rejeitar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showCreateForm && (
          <div className="mt-6 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-ink mb-3">
              Enviar nova proposta
            </h3>
            {formError && (
              <Alert variant="danger" className="mb-3">
                <AlertCircle size={16} />
                {formError}
              </Alert>
            )}
            <form
              onSubmit={handleSubmitProposal}
              className="flex flex-col md:flex-row gap-3"
            >
              <div className="flex-1 flex flex-col md:flex-row gap-3">
                <div className="relative flex-1 min-w-0">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-muted">R$</span>
                  </div>
                  <input
                    type="text"
                    value={proposedValue}
                    onChange={handleValueChange}
                    placeholder="0,00"
                    className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring text-right font-medium"
                    disabled={isSending}
                  />
                </div>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Mensagem (opcional)"
                  className="flex-1 px-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring"
                  disabled={isSending}
                />
              </div>
              <Button type="submit" disabled={isSending || !proposedValue}>
                {isSending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
                Enviar proposta
              </Button>
            </form>
            {processInfo && (
              <p className="mt-2 text-xs text-muted">
                Valor mínimo aceito: {formatCurrency(processInfo.minimum_value, processInfo.currency)}
              </p>
            )}
          </div>
        )}

        {!showCreateForm &&
          processInfo?.status === "NEGOTIATION" &&
          !isAwaitingProduct && (
            <div className="mt-6 p-3 bg-border-soft border border-border rounded-lg text-center text-sm text-muted">
              Aguardando resposta do especialista.
            </div>
          )}
      </Card>
      )}
    </div>
  );
}
