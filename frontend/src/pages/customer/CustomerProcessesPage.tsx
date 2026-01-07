import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../../store/authStateManager";
import Loading from "../../components/ui/Loading";
import ProcessCard from "../../components/ProcessCard";
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
            {processes.map((process) => (
              <ProcessCard
                key={process.id}
                process={process as any}
                product={process.product}
                isClientView={true}
              />
            ))}
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
