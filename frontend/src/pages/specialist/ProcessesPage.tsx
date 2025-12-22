import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import ProcessCard from "../../components/ProcessCard.tsx";
import CreateProcessModal from "../../components/CreateProcessModal.tsx";
import { getProcessesBySpecialist } from "../../services/processes.service";
import type { Process } from "../../services/processes.service";
import { useAuth } from "../../store/authStateManager.ts";

interface ProcessWithProduct extends Process {
  client?: Process["client"];
  product?: Process["product"];
}

/**
 * Specialist Dashboard Page
 * Displays list of processes with pagination and create new process modal
 */
export default function ProcessesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Validate user is logged in
  if (!user?.id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  const [processes, setProcesses] = useState<ProcessWithProduct[]>([]);
  const [expandedProcessId, setExpandedProcessId] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);

  const itemsPerPage = 10;

  // Fetch processes by specialist
  const loadProcesses = async (page: number) => {
    try {
      setIsLoading(true);
      setError(null);

      const processes = await getProcessesBySpecialist(
        user.id,
        page,
        itemsPerPage
      );

      setProcesses(processes);
      setCurrentPage(page);
      // Calculate pagination based on returned data
      const hasMore = processes.length === itemsPerPage;
      setHasNextPage(hasMore);
      setHasPreviousPage(page > 1);
      setTotalPages(page + (hasMore ? 1 : 0));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar processos"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Load processes on mount or when user changes
  useEffect(() => {
    if (user?.id) {
      loadProcesses(1);
    }
  }, [user?.id]);

  // Handle pagination
  const handleNextPage = () => {
    if (hasNextPage) {
      loadProcesses(currentPage + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePreviousPage = () => {
    if (hasPreviousPage) {
      loadProcesses(currentPage - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Handle process card accordion toggle
  const handleToggleExpand = (processId: string) => {
    setExpandedProcessId(expandedProcessId === processId ? null : processId);
  };

  // Handle upload documents button
  const handleUploadDocuments = (processId: string) => {
    navigate(`/specialist/contracts/new?processId=${processId}`);
  };

  // Handle successful process creation
  const handleProcessCreated = () => {
    setShowCreateModal(false);
    loadProcesses(1); // Reload from first page
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 py-3 sm:px-6 sm:py-4 lg:px-8 lg:py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                Dashboard de Processos
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Gerencie seus processos de negociação
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {/* Filter Button (Visual only for MVP) */}
              <button
                className="inline-flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition text-xs sm:text-sm"
                aria-label="Filter processes"
                title="Filtrar"
              >
                <Filter size={16} className="sm:hidden" />
                <Filter size={18} className="hidden sm:block" />
                <span className="hidden sm:inline">Filtrar</span>
              </button>

              {/* Create Process Button */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-800 transition text-xs sm:text-sm whitespace-nowrap"
              >
                <Plus size={16} className="sm:hidden" />
                <Plus size={18} className="hidden sm:block" />
                <span className="hidden sm:inline">Novo Processo</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs sm:text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8 sm:py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-slate-700"></div>
              <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">
                Carregando processos...
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && processes.length === 0 && (
          <div className="text-center py-8 sm:py-12">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 rounded-full mb-3 sm:mb-4">
              <Plus size={28} className="sm:hidden text-gray-400" />
              <Plus size={32} className="hidden sm:block text-gray-400" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
              Nenhum processo encontrado
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
              Crie seu primeiro processo para começar
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-800 transition text-xs sm:text-sm"
            >
              <Plus size={18} />
              Criar Novo Processo
            </button>
          </div>
        )}

        {/* Processes Grid */}
        {!isLoading && processes.length > 0 && (
          <div className="space-y-3 sm:space-y-4">
            {processes.map((process) => (
              <ProcessCard
                key={process.id}
                process={process}
                product={process.product}
                isExpanded={expandedProcessId === process.id}
                onToggleExpand={() => handleToggleExpand(process.id)}
                onUploadDocuments={() => handleUploadDocuments(process.id)}
                onStatusUpdated={() => loadProcesses(currentPage)}
              />
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && processes.length > 0 && (
          <div className="mt-6 sm:mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs sm:text-sm text-gray-600">
              Página <span className="font-semibold">{currentPage}</span> de{" "}
              <span className="font-semibold">{totalPages}</span>
            </div>

            <div className="flex gap-2 justify-center sm:justify-end">
              <button
                onClick={handlePreviousPage}
                disabled={!hasPreviousPage}
                className="inline-flex items-center justify-center gap-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                title="Anterior"
              >
                <ChevronLeft size={16} className="sm:hidden" />
                <ChevronLeft size={18} className="hidden sm:block" />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              <button
                onClick={handleNextPage}
                disabled={!hasNextPage}
                className="inline-flex items-center justify-center gap-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                title="Próximo"
              >
                <span className="hidden sm:inline">Próximo</span>
                <ChevronRight size={16} className="sm:hidden" />
                <ChevronRight size={18} className="hidden sm:block" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Process Modal */}
      <CreateProcessModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleProcessCreated}
      />
    </div>
  );
}
