import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, FileText, AlertCircle } from "lucide-react";
import { useAuth } from "../../store/authStateManager";
import Loading from "../../components/ui/Loading";
import ProcessCard from "../../components/processes/ProcessCard";
import api from "../../services/api";
import Button from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { PageHeader } from "../../components/patterns/PageHeader";
import { EmptyState } from "../../components/patterns/EmptyState";

interface ProcessClient {
  id: string;
  status:
    | "SCHEDULING"
    | "NEGOTIATION"
    | "PROCESSING_CONTRACT"
    | "DOCUMENTATION"
    | "COMPLETED"
    | "REJECTED";
  appointment_status?:
    | "PENDING"
    | "SCHEDULED"
    | "COMPLETED"
    | "CANCELLED"
    | null;
  appointment_datetime?: string | null;
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
  success: boolean;
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

  const hasMeetingRelevantProcesses = (list: ProcessClient[]): boolean => {
    return list.some(
      (p) =>
        p.status === "SCHEDULING" ||
        p.status === "NEGOTIATION" ||
        p.status === "PROCESSING_CONTRACT",
    );
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
        },
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

  useEffect(() => {
    if (!user?.id) return;

    if (!hasMeetingRelevantProcesses(processes)) return;

    const interval = setInterval(() => {
      loadProcesses(currentPage);
    }, 10000);

    return () => clearInterval(interval);
  }, [user?.id, currentPage, processes]);

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
    <div className="w-full">
      <PageHeader title="Meus Processos" />

      {/* Error */}
      {error && (
        <Alert variant="danger" className="mb-6">
          <AlertCircle size={20} />
          <p>{error}</p>
        </Alert>
      )}

      {/* Empty State */}
      {processes.length === 0 && !error && (
        <EmptyState
          icon={FileText}
          title="Nenhum processo encontrado"
          description="Você ainda não possui processos de negociação. Explore o catálogo e agende uma reunião com um especialista!"
        />
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
          <p className="text-sm text-muted">
            Página <span className="font-semibold">{currentPage}</span> de{" "}
            <span className="font-semibold">{totalPages}</span>
          </p>

          <div className="flex gap-2 justify-center">
            <Button
              onClick={handlePreviousPage}
              disabled={!hasPreviousPage}
              variant="light"
              className="text-sm"
            >
              <ChevronLeft size={18} />
              Anterior
            </Button>

            <Button
              onClick={handleNextPage}
              disabled={!hasNextPage}
              variant="light"
              className="text-sm"
            >
              Próximo
              <ChevronRight size={18} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
