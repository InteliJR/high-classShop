import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Check,
  Clock,
  XCircle,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../../store/authStateManager";
import Loading from "../../components/ui/Loading";
import api from "../../services/api";

interface ProcessClient {
  id: string;
  status:
    | "SCHEDULING"
    | "NEGOTIATION"
    | "PROCESSING_CONTRACT"
    | "DOCUMENTATION"
    | "COMPLETED"
    | "REJECTED";
  product_type: "CAR" | "BOAT" | "AIRCRAFT";
  notes?: string;
  created_at: string;
  rejection_reason?: string | null;
  client?: {
    id: string;
    email?: string;
    name?: string;
  };
  product?: {
    id: number | string;
    marca?: string;
    modelo?: string;
  };
  specialist?: {
    id: string;
    name?: string;
    especialidade?: string;
  };
}

interface ApiResponse {
  sucess: boolean;
  message: string;
  data: ProcessClient[];
  meta?: {
    pagination?: {
      current_page: number;
      total_pages: number;
      total: number;
      has_next: boolean;
      has_prev: boolean;
    };
  };
}

/**
 * CustomerProcessesPage
 *
 * Página para o cliente visualizar seus processos.
 * Semelhante ao ProcessesPage do especialista, mas apenas visualização.
 *
 * Descrições por status:
 * - SCHEDULING: Reunião marcada, aguarde os próximos passos
 * - NEGOTIATION: Envie proposta e chegue a um acordo
 * - PROCESSING_CONTRACT: Contrato sendo processado
 * - DOCUMENTATION: Aguarde o contrato em seu e-mail
 * - COMPLETED: Parabéns pela compra!
 * - REJECTED: Processo cancelado (com motivo se houver)
 */
export default function CustomerProcessesPage() {
  const { user } = useAuth();
  const [processes, setProcesses] = useState<ProcessClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);

  const itemsPerPage = 10;

  // Descrições por status
  const statusDescriptions: Record<
    string,
    { title: string; description: string; icon: React.ReactNode; color: string }
  > = {
    SCHEDULING: {
      title: "Agendamento",
      description:
        "Reunião marcada! Aguarde os próximos passos para prosseguir com a negociação.",
      icon: <Clock size={20} />,
      color: "blue",
    },
    NEGOTIATION: {
      title: "Negociação",
      description:
        "Nessa etapa você enviará uma proposta e chegará em um acordo com o responsável pelo produto.",
      icon: <MessageSquare size={20} />,
      color: "yellow",
    },
    PROCESSING_CONTRACT: {
      title: "Processando Contrato",
      description: "O contrato está sendo processado. Aguarde a finalização.",
      icon: <FileText size={20} />,
      color: "orange",
    },
    DOCUMENTATION: {
      title: "Documentação",
      description: "Aguarde o envio do contrato em seu e-mail para assinatura.",
      icon: <FileText size={20} />,
      color: "purple",
    },
    COMPLETED: {
      title: "Concluído",
      description: "Tudo feito, parabéns pela compra! 🎉",
      icon: <Check size={20} />,
      color: "green",
    },
    REJECTED: {
      title: "Rejeitado",
      description: "Processo cancelado.",
      icon: <XCircle size={20} />,
      color: "red",
    },
  };

  // Buscar processos do cliente
  const loadProcesses = async (page: number) => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get<ApiResponse>(
        `/processes/client/${user.id}`,
        {
          params: { page, perPage: itemsPerPage },
          withCredentials: true,
        }
      );

      setProcesses(response.data.data || []);

      if (response.data.meta?.pagination) {
        const pagination = response.data.meta.pagination;
        setCurrentPage(pagination.current_page);
        setTotalPages(pagination.total_pages);
        setHasNextPage(pagination.has_next);
        setHasPreviousPage(pagination.has_prev);
      }
    } catch (err) {
      console.error("Erro ao carregar processos:", err);
      setError("Erro ao carregar seus processos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadProcesses(1);
    }
  }, [user?.id]);

  const handleNextPage = () => {
    if (hasNextPage) {
      loadProcesses(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (hasPreviousPage) {
      loadProcesses(currentPage - 1);
    }
  };

  const getStatusInfo = (status: string) => {
    return statusDescriptions[status] || statusDescriptions.SCHEDULING;
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> =
      {
        blue: {
          bg: "bg-blue-50",
          text: "text-blue-700",
          border: "border-blue-200",
        },
        yellow: {
          bg: "bg-yellow-50",
          text: "text-yellow-700",
          border: "border-yellow-200",
        },
        orange: {
          bg: "bg-orange-50",
          text: "text-orange-700",
          border: "border-orange-200",
        },
        purple: {
          bg: "bg-purple-50",
          text: "text-purple-700",
          border: "border-purple-200",
        },
        green: {
          bg: "bg-green-50",
          text: "text-green-700",
          border: "border-green-200",
        },
        red: {
          bg: "bg-red-50",
          text: "text-red-700",
          border: "border-red-200",
        },
      };
    return colors[color] || colors.blue;
  };

  if (loading) {
    return <Loading size="lg" text="Carregando seus processos..." fullScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Meus Processos
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Acompanhe o andamento das suas negociações
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle size={20} className="text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {processes.length === 0 && !error && (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhum processo encontrado
            </h3>
            <p className="text-sm text-gray-600">
              Você ainda não possui processos de negociação. Explore o catálogo
              e agende uma reunião com um especialista!
            </p>
          </div>
        )}

        {/* Processes List */}
        {processes.length > 0 && (
          <div className="space-y-4">
            {processes.map((process) => {
              const statusInfo = getStatusInfo(process.status);
              const colorClasses = getColorClasses(statusInfo.color);

              return (
                <div
                  key={process.id}
                  className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-4 py-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {process.product?.marca}{" "}
                          {process.product?.modelo || "Produto"}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Especialista:{" "}
                          {process.specialist?.name || "Não atribuído"}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${colorClasses.bg} ${colorClasses.text} ${colorClasses.border} border`}
                      >
                        {statusInfo.title}
                      </span>
                    </div>
                  </div>

                  {/* Status Description */}
                  <div className={`px-4 py-4 ${colorClasses.bg}`}>
                    <div className="flex items-start gap-3">
                      <div className={colorClasses.text}>{statusInfo.icon}</div>
                      <div>
                        <p
                          className={`text-sm font-medium ${colorClasses.text}`}
                        >
                          {statusInfo.description}
                        </p>

                        {/* Motivo da rejeição se houver */}
                        {process.status === "REJECTED" &&
                          process.rejection_reason && (
                            <p className="text-sm text-red-600 mt-2">
                              <strong>Motivo:</strong>{" "}
                              {process.rejection_reason}
                            </p>
                          )}

                        {/* Notas se houver */}
                        {process.notes && (
                          <p className="text-sm text-gray-600 mt-2">
                            <strong>Observações:</strong> {process.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      Criado em:{" "}
                      {new Date(process.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {processes.length > 0 && totalPages > 1 && (
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Página <span className="font-semibold">{currentPage}</span> de{" "}
              <span className="font-semibold">{totalPages}</span>
            </p>

            <div className="flex gap-2 justify-center">
              <button
                onClick={handlePreviousPage}
                disabled={!hasPreviousPage}
                className="inline-flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <ChevronLeft size={18} />
                Anterior
              </button>

              <button
                onClick={handleNextPage}
                disabled={!hasNextPage}
                className="inline-flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Próximo
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
