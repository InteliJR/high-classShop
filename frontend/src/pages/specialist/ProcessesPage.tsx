import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import ProcessCard from "../../components/ProcessCard.tsx";
import CreateProcessModal from "../../components/CreateProcessModal.tsx";
import ProductSelectorModal from "../../components/ProductSelectorModal.tsx";
import {
  getProcessesBySpecialist,
  type ProcessFilters,
} from "../../services/processes.service";
import type { Process } from "../../services/processes.service";
import { useAuth } from "../../store/authStateManager.ts";

// Status labels for filter dropdown
const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "SCHEDULING", label: "Agendamento" },
  { value: "NEGOTIATION", label: "Negociação" },
  { value: "DOCUMENTATION", label: "Documentação" },
  { value: "PROCESSING_CONTRACT", label: "Processando Contrato" },
  { value: "PAYMENT", label: "Pagamento" },
  { value: "COMPLETED", label: "Concluído" },
  { value: "CANCELLED", label: "Cancelado" },
  { value: "REJECTED", label: "Rejeitado" },
] as const;

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
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false); // Track if user is in edit mode

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProductSelectorModal, setShowProductSelectorModal] =
    useState(false);
  const [selectedProcessForProduct, setSelectedProcessForProduct] =
    useState<ProcessWithProduct | null>(null);

  const itemsPerPage = 10;

  /**
   * Check if there are processes in NEGOTIATION, PROCESSING_CONTRACT or DOCUMENTATION status
   * These statuses require real-time updates for better UX
   */
  const hasRelevantProcesses = (): boolean => {
    return processes.some(
      (p) =>
        p.status === "NEGOTIATION" ||
        p.status === "PROCESSING_CONTRACT" ||
        p.status === "DOCUMENTATION",
    );
  };

  // Fetch processes by specialist
  const loadProcesses = useCallback(
    async (page: number) => {
      try {
        setIsLoading(true);
        setError(null);

        const filters: ProcessFilters = {};
        if (statusFilter) {
          filters.status = statusFilter;
        }
        if (searchQuery) {
          filters.search = searchQuery;
        }

        const processes = await getProcessesBySpecialist(
          user.id,
          page,
          itemsPerPage,
          filters,
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
          err instanceof Error ? err.message : "Erro ao carregar processos",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [user.id, statusFilter, searchQuery, itemsPerPage],
  );

  // Load processes on mount or when user changes
  useEffect(() => {
    if (user?.id) {
      loadProcesses(1);
    }
  }, [user?.id, loadProcesses]);

  // Reload processes when filters change
  useEffect(() => {
    if (user?.id) {
      loadProcesses(1);
    }
  }, [statusFilter, searchQuery]);

  // Debounce search input
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 400);

    return () => clearTimeout(debounceTimer);
  }, [searchInput]);

  // Smart Polling: Only poll if there are processes in NEGOTIATION or DOCUMENTATION
  // AND user is not editing/in modal. Interval: 30 seconds
  useEffect(() => {
    if (!user?.id) return;

    // Check if polling should be active
    const shouldPoll =
      hasRelevantProcesses() && !isEditing && !expandedProcessId;

    if (!shouldPoll) return;

    const pollingInterval = setInterval(() => {
      loadProcesses(currentPage);
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(pollingInterval);
  }, [user?.id, currentPage, isEditing, expandedProcessId, processes]);

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
    const newExpandedId = expandedProcessId === processId ? null : processId;
    setExpandedProcessId(newExpandedId);
    setIsEditing(!!newExpandedId); // Pause polling when expanding a process
  };

  // Handle upload documents button
  const handleUploadDocuments = (processId: string) => {
    setIsEditing(true); // Pause polling when navigating to upload
    navigate(`/specialist/contracts/new?processId=${processId}`);
  };

  // Handle successful process creation
  const handleProcessCreated = () => {
    setShowCreateModal(false);
    setIsEditing(false); // Resume polling after creation
    loadProcesses(1); // Reload from first page
  };

  // Handle opening product selector for consultancy processes
  const handleSelectProduct = (process: ProcessWithProduct) => {
    setSelectedProcessForProduct(process);
    setShowProductSelectorModal(true);
    setIsEditing(true); // Pause polling while selecting product
  };

  // Handle successful product assignment
  const handleProductAssigned = () => {
    setShowProductSelectorModal(false);
    setSelectedProcessForProduct(null);
    setIsEditing(false);
    loadProcesses(currentPage);
  };

  // Handle after status is updated
  const handleStatusUpdated = () => {
    setExpandedProcessId(null);
    setIsEditing(false); // Resume polling after status update
    loadProcesses(currentPage);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setStatusFilter("");
    setSearchInput("");
    setSearchQuery("");
  };

  // Check if any filter is active
  const hasActiveFilters = statusFilter || searchQuery;

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
              {/* Filter Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 border rounded-lg font-medium transition text-xs sm:text-sm ${
                  showFilters || hasActiveFilters
                    ? "border-slate-700 bg-slate-700 text-white hover:bg-slate-800"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                aria-label="Filter processes"
                title="Filtrar"
              >
                <Filter size={16} className="sm:hidden" />
                <Filter size={18} className="hidden sm:block" />
                <span className="hidden sm:inline">Filtrar</span>
                {hasActiveFilters && (
                  <span className="ml-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
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
        {/* Filter Panel */}
        {showFilters && (
          <div className="mb-4 sm:mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1">
                <label
                  htmlFor="search"
                  className="block text-xs sm:text-sm font-medium text-gray-700 mb-1"
                >
                  Pesquisar
                </label>
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    id="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Nome do cliente, e-mail ou produto..."
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                  {searchInput && (
                    <button
                      onClick={() => {
                        setSearchInput("");
                        setSearchQuery("");
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Status Filter */}
              <div className="w-full sm:w-48">
                <label
                  htmlFor="status"
                  className="block text-xs sm:text-sm font-medium text-gray-700 mb-1"
                >
                  Status
                </label>
                <select
                  id="status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <div className="flex items-end">
                  <button
                    onClick={handleClearFilters}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>

            {/* Active Filters Summary */}
            {hasActiveFilters && (
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs sm:text-sm text-gray-600">
                Filtros ativos:{" "}
                {statusFilter && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded mr-2">
                    {
                      STATUS_OPTIONS.find((o) => o.value === statusFilter)
                        ?.label
                    }
                    <button onClick={() => setStatusFilter("")}>
                      <X size={12} />
                    </button>
                  </span>
                )}
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                    "{searchQuery}"
                    <button
                      onClick={() => {
                        setSearchInput("");
                        setSearchQuery("");
                      }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

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
              {hasActiveFilters ? (
                <>
                  <Search size={28} className="sm:hidden text-gray-400" />
                  <Search size={32} className="hidden sm:block text-gray-400" />
                </>
              ) : (
                <>
                  <Plus size={28} className="sm:hidden text-gray-400" />
                  <Plus size={32} className="hidden sm:block text-gray-400" />
                </>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
              {hasActiveFilters
                ? "Nenhum processo encontrado"
                : "Nenhum processo encontrado"}
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
              {hasActiveFilters
                ? "Tente ajustar os filtros para encontrar mais resultados"
                : "Crie seu primeiro processo para começar"}
            </p>
            {hasActiveFilters ? (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition text-xs sm:text-sm"
              >
                <X size={18} />
                Limpar Filtros
              </button>
            ) : (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-800 transition text-xs sm:text-sm"
              >
                <Plus size={18} />
                Criar Novo Processo
              </button>
            )}
          </div>
        )}

        {/* Processes Grid */}
        {!isLoading && processes.length > 0 && (
          <div className="space-y-3 sm:space-y-4">
            {processes.map((process) => (
              <ProcessCard
                key={process.id}
                process={process}
                product={process.product ?? undefined}
                isExpanded={expandedProcessId === process.id}
                onToggleExpand={() => handleToggleExpand(process.id)}
                onUploadDocuments={() => handleUploadDocuments(process.id)}
                onStatusUpdated={() => handleStatusUpdated()}
                onSelectProduct={() => handleSelectProduct(process)}
                specialistSpeciality={user?.speciality}
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

      {/* Product Selector Modal for Consultancy Processes */}
      {selectedProcessForProduct && user?.speciality && (
        <ProductSelectorModal
          isOpen={showProductSelectorModal}
          onClose={() => {
            setShowProductSelectorModal(false);
            setSelectedProcessForProduct(null);
            setIsEditing(false);
          }}
          onSuccess={handleProductAssigned}
          process={selectedProcessForProduct}
          specialistId={user.id}
          specialistSpeciality={user.speciality}
        />
      )}
    </div>
  );
}
