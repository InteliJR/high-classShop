import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Check,
  X,
  Loader2,
  MessageSquare,
  DollarSign,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../store/authStateManager";
import {
  getProcessProposals,
  createProposal,
  acceptProposal,
  rejectProposal,
  type NegotiationProposal,
  type NegotiationProcessInfo,
  type NegotiationMeta,
} from "../../services/proposals.service";
import { getProcessById } from "../../services/processes.service";

/**
 * Página de Negociação
 * Interface estilo chat para troca de propostas de valor entre cliente e especialista
 */
export default function NegotiationPage() {
  const { processId } = useParams<{ processId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [proposals, setProposals] = useState<NegotiationProposal[]>([]);
  const [processInfo, setProcessInfo] = useState<NegotiationProcessInfo | null>(
    null,
  );
  const [meta, setMeta] = useState<NegotiationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const getProcessesRouteByRole = (): string => {
    return user?.role === "SPECIALIST"
      ? "/specialist/processes"
      : "/customer/processes";
  };

  // Form state
  const [proposedValue, setProposedValue] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  /**
   * Carrega as propostas do processo
   */
  const loadProposals = async () => {
    if (!processId) return;

    try {
      setIsLoading(true);
      setError(null);

      const process = await getProcessById(processId);
      const isAwaitingProduct = !process.product_type || !process.product_id;

      if (isAwaitingProduct) {
        navigate(getProcessesRouteByRole(), {
          replace: true,
          state: {
            error:
              "A negociação só fica disponível após o especialista associar um produto ao processo.",
          },
        });
        return;
      }

      const response = await getProcessProposals(processId);

      if (response.success) {
        setProposals(response.data);
        setProcessInfo(response.process);
        setMeta(response.meta);
      } else {
        setError(response.message || "Erro ao carregar propostas");
      }
    } catch (err) {
      console.error("[NegotiationPage] Erro ao carregar propostas:", err);
      setError(
        err instanceof Error ? err.message : "Erro ao carregar propostas",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Scroll para o final quando novas propostas são adicionadas
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [proposals]);

  // Carregar propostas ao montar
  useEffect(() => {
    loadProposals();
  }, [processId, user?.role]);

  /**
   * Envia uma nova proposta
   */
  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!processId || !processInfo) return;

    const value = parseFloat(proposedValue.replace(/\D/g, "")) / 100;

    if (isNaN(value) || value <= 0) {
      setFormError("Por favor, insira um valor válido");
      return;
    }

    if (value < processInfo.minimum_value) {
      setFormError(
        `O valor mínimo permitido é ${formatCurrency(
          processInfo.minimum_value,
        )}`,
      );
      return;
    }

    // Encontrar a última proposta pendente para fazer counter
    const lastPendingProposal = proposals.find((p) => p.status === "PENDING");

    try {
      setIsSending(true);

      await createProposal({
        process_id: processId,
        proposed_value: value,
        message: message || undefined,
        counter_to_id: lastPendingProposal?.id,
      });

      // Limpar formulário e recarregar propostas
      setProposedValue("");
      setMessage("");
      await loadProposals();
    } catch (err) {
      console.error("[NegotiationPage] Erro ao enviar proposta:", err);
      setFormError(
        err instanceof Error ? err.message : "Erro ao enviar proposta",
      );
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Aceita uma proposta
   */
  const handleAcceptProposal = async (proposalId: string) => {
    try {
      setIsAccepting(true);
      await acceptProposal(proposalId, "Proposta aceita");
      await loadProposals();
    } catch (err) {
      console.error("[NegotiationPage] Erro ao aceitar proposta:", err);
      setError(err instanceof Error ? err.message : "Erro ao aceitar proposta");
    } finally {
      setIsAccepting(false);
    }
  };

  /**
   * Rejeita uma proposta
   */
  const handleRejectProposal = async (proposalId: string) => {
    try {
      setIsRejecting(true);
      await rejectProposal(proposalId, "Proposta rejeitada");
      await loadProposals();
    } catch (err) {
      console.error("[NegotiationPage] Erro ao rejeitar proposta:", err);
      setError(
        err instanceof Error ? err.message : "Erro ao rejeitar proposta",
      );
    } finally {
      setIsRejecting(false);
    }
  };

  /**
   * Formata valor como moeda
   */
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  /**
   * Formata input de moeda
   */
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    const numericValue = parseInt(rawValue) || 0;
    const formatted = (numericValue / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setProposedValue(formatted);
  };

  /**
   * Formata data
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /**
   * Verifica se o usuário pode fazer uma proposta
   */
  const canCreateProposal = (): boolean => {
    if (!meta || !user || !processInfo) return false;
    if (processInfo.status !== "NEGOTIATION") return false;
    return meta.can_create_proposal;
  };

  /**
   * Verifica se o usuário pode responder a uma proposta
   */
  const canRespondToProposal = (proposal: NegotiationProposal): boolean => {
    if (!user || proposal.status !== "PENDING") return false;
    return proposal.proposed_to.id === user.id;
  };

  /**
   * Retorna o status visual da proposta
   */
  const getProposalStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
            <Loader2 size={12} className="animate-spin" />
            Aguardando resposta
          </span>
        );
      case "ACCEPTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
            <Check size={12} />
            Aceita
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
            <X size={12} />
            Rejeitada
          </span>
        );
      case "COUNTERED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
            <RefreshCw size={12} />
            Contraproposta enviada
          </span>
        );
      default:
        return null;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="animate-spin" size={24} />
          <span>Carregando negociação...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !processInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Erro ao carregar
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={18} />
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center gap-3 md:gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-xl font-semibold text-gray-900 truncate">
                Negociação
              </h1>
              {processInfo && (
                <p className="text-xs md:text-sm text-gray-500 truncate">
                  {processInfo.client.name} {processInfo.client.surname} •{" "}
                  {processInfo.product_type === "CAR"
                    ? "Carro"
                    : processInfo.product_type === "BOAT"
                      ? "Embarcação"
                      : "Aeronave"}
                </p>
              )}
            </div>

            {/* Refresh button */}
            <button
              onClick={loadProposals}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Atualizar"
            >
              <RefreshCw
                size={18}
                className={`text-gray-600 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {/* Product value info */}
          {processInfo && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg flex flex-wrap items-center gap-3 md:gap-6 text-sm">
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-green-600" />
                <span className="text-gray-600">Valor do produto:</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(processInfo.product_value)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-orange-500" />
                <span className="text-gray-600">Valor mínimo:</span>
                <span className="font-semibold text-orange-600">
                  {formatCurrency(processInfo.minimum_value)}
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Chat container */}
      <main
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 md:py-6 max-w-4xl mx-auto w-full"
      >
        {/* Empty state */}
        {proposals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare size={48} className="text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              Nenhuma proposta ainda
            </h3>
            <p className="text-sm text-gray-500 max-w-md">
              Inicie a negociação enviando uma proposta de valor para o{" "}
              {user?.role === "SPECIALIST" ? "cliente" : "especialista"}.
            </p>
          </div>
        )}

        {/* Proposals list (chat style) */}
        <div className="space-y-4">
          {proposals.map((proposal) => {
            const isOwnProposal = proposal.proposed_by.id === user?.id;

            return (
              <div
                key={proposal.id}
                className={`flex ${
                  isOwnProposal ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] ${
                    isOwnProposal
                      ? "bg-slate-700 text-white"
                      : "bg-white border border-gray-200"
                  } rounded-2xl shadow-sm overflow-hidden`}
                >
                  {/* Proposal header */}
                  <div
                    className={`px-4 py-2 border-b ${
                      isOwnProposal ? "border-slate-600" : "border-gray-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span
                        className={`text-xs font-medium ${
                          isOwnProposal ? "text-slate-300" : "text-gray-500"
                        }`}
                      >
                        {proposal.proposed_by.name}{" "}
                        {proposal.proposed_by.surname}
                        {isOwnProposal && " (você)"}
                      </span>
                      <span
                        className={`text-xs ${
                          isOwnProposal ? "text-slate-400" : "text-gray-400"
                        }`}
                      >
                        {formatDate(proposal.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Proposal content */}
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign
                        size={18}
                        className={
                          isOwnProposal ? "text-green-300" : "text-green-600"
                        }
                      />
                      <span
                        className={`text-xl font-bold ${
                          isOwnProposal ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {formatCurrency(proposal.proposed_value)}
                      </span>
                    </div>

                    {proposal.message && (
                      <p
                        className={`text-sm mb-2 ${
                          isOwnProposal ? "text-slate-200" : "text-gray-600"
                        }`}
                      >
                        {proposal.message}
                      </p>
                    )}

                    {/* Status badge */}
                    <div className="mt-2">
                      {getProposalStatusBadge(proposal.status)}
                    </div>

                    {/* Action buttons for pending proposals */}
                    {canRespondToProposal(proposal) && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => handleAcceptProposal(proposal.id)}
                          disabled={isAccepting || isRejecting}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {isAccepting ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Check size={16} />
                          )}
                          Aceitar
                        </button>
                        <button
                          onClick={() => handleRejectProposal(proposal.id)}
                          disabled={isAccepting || isRejecting}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {isRejecting ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <X size={16} />
                          )}
                          Rejeitar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Status message when negotiation is complete */}
        {processInfo && processInfo.status !== "NEGOTIATION" && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <p className="text-sm text-blue-800">
              {processInfo.status === "PROCESSING_CONTRACT"
                ? "A negociação foi concluída. O contrato está sendo processado."
                : processInfo.status === "DOCUMENTATION"
                  ? "A negociação foi concluída. O processo está em fase de documentação."
                  : processInfo.status === "COMPLETED"
                    ? "Este processo foi concluído com sucesso."
                    : processInfo.status === "REJECTED"
                      ? "Este processo foi rejeitado."
                      : "A negociação não está mais disponível."}
            </p>
          </div>
        )}
      </main>

      {/* Form to create new proposal */}
      {canCreateProposal() && (
        <footer className="bg-white border-t border-gray-200 sticky bottom-0">
          <div className="max-w-4xl mx-auto px-4 py-3 md:py-4">
            {formError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                <AlertCircle size={16} />
                {formError}
              </div>
            )}

            <form
              onSubmit={handleSubmitProposal}
              className="flex flex-col md:flex-row gap-3"
            >
              <div className="flex-1 flex flex-col md:flex-row gap-3">
                {/* Value input */}
                <div className="relative flex-1 min-w-0">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500">R$</span>
                  </div>
                  <input
                    type="text"
                    value={proposedValue}
                    onChange={handleValueChange}
                    placeholder="0,00"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-right font-medium"
                    disabled={isSending}
                  />
                </div>

                {/* Message input */}
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Mensagem (opcional)"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  disabled={isSending}
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSending || !proposedValue}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
                <span className="hidden md:inline">Enviar Proposta</span>
                <span className="md:hidden">Enviar</span>
              </button>
            </form>

            {/* Minimum value hint */}
            {processInfo && (
              <p className="mt-2 text-xs text-gray-500 text-center md:text-left">
                💡 O valor mínimo aceito é{" "}
                {formatCurrency(processInfo.minimum_value)}
              </p>
            )}
          </div>
        </footer>
      )}

      {/* Message when user cannot create proposal */}
      {!canCreateProposal() && processInfo?.status === "NEGOTIATION" && (
        <footer className="bg-gray-50 border-t border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4 text-center">
            <p className="text-sm text-gray-600">
              Aguardando resposta do{" "}
              {meta?.pending_response_from === user?.id
                ? "outro participante"
                : "outro participante"}
              ...
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
