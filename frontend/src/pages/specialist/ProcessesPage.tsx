import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Loader2,
} from "lucide-react";
import ProcessCard from "../../components/processes/ProcessCard";
import CreateProcessModal from "../../components/processes/CreateProcessModal";
import ProductSelectorModal from "../../components/product/ProductSelectorModal";
import Button from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { PageHeader } from "../../components/patterns/PageHeader";
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
      <div className="min-h-screen bg-border-soft flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted">Carregando...</p>
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
    <div className="min-h-screen bg-border-soft">
      <div className="max-w-7xl mx-auto px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <PageHeader
          title="Dashboard de Processos"
          actions={
            <>
              <Button
                type="button"
                variant={showFilters || hasActiveFilters ? "solid" : "light"}
                onClick={() => setShowFilters(!showFilters)}
                aria-label="Filter processes"
                title="Filtrar"
              >
                <Filter size={16} />
                <span className="hidden sm:inline">Filtrar</span>
                {hasActiveFilters && (
                  <span className="ml-1 w-2 h-2 bg-status-bad rounded-full" />
                )}
              </Button>
              <Button type="button" onClick={() => setShowCreateModal(true)}>
                <Plus size={16} />
                <span className="hidden sm:inline">Novo Processo</span>
              </Button>
            </>
          }
        />

        {/* Filter Panel */}
        {showFilters && (
          <div className="mb-4 sm:mb-6 p-4 bg-surface rounded-lg border border-border shadow-sm">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1">
                <label
                  htmlFor="search"
                  className="block text-xs sm:text-sm font-medium text-ink-soft mb-1"
                >
                  Pesquisar
                </label>
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
                  />
                  <input
                    type="text"
                    id="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Nome do cliente, e-mail ou produto..."
                    className="w-full pl-10 pr-10 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-focus-ring focus:border-transparent"
                  />
                  {searchInput && (
                    <button
                      onClick={() => {
                        setSearchInput("");
                        setSearchQuery("");
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-border-soft text-ink-soft"
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
                  className="block text-xs sm:text-sm font-medium text-ink-soft mb-1"
                >
                  Status
                </label>
                <select
                  id="status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full py-2 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
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
                  <Button type="button" variant="light" onClick={handleClearFilters}>
                    Limpar filtros
                  </Button>
                </div>
              )}
            </div>

            {/* Active Filters Summary */}
            {hasActiveFilters && (
              <div className="mt-3 pt-3 border-t border-border-soft text-xs sm:text-sm text-muted">
                Filtros ativos:{" "}
                {statusFilter && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-border-soft text-ink-soft rounded mr-2">
                    {
                      STATUS_OPTIONS.find((o) => o.value === statusFilter)
                        ?.label
                    }
                    <button
                      onClick={() => setStatusFilter("")}
                      className="hover:bg-border-soft text-ink-soft rounded"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-border-soft text-ink-soft rounded">
                    "{searchQuery}"
                    <button
                      onClick={() => {
                        setSearchInput("");
                        setSearchQuery("");
                      }}
                      className="hover:bg-border-soft text-ink-soft rounded"
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
          <Alert variant="danger" className="mb-4 sm:mb-6">
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8 sm:py-12">
            <div className="text-center">
              <Loader2 className="animate-spin mx-auto h-10 w-10 sm:h-12 sm:w-12 text-ink" />
              <p className="mt-3 sm:mt-4 text-sm sm:text-base text-muted">
                Carregando processos...
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && processes.length === 0 && (
          <div className="text-center py-8 sm:py-12">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-border-soft rounded-full mb-3 sm:mb-4">
              {hasActiveFilters ? (
                <>
                  <Search size={28} className="sm:hidden text-subtle" />
                  <Search size={32} className="hidden sm:block text-subtle" />
                </>
              ) : (
                <>
                  <Plus size={28} className="sm:hidden text-subtle" />
                  <Plus size={32} className="hidden sm:block text-subtle" />
                </>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-ink mb-2">
              {hasActiveFilters
                ? "Nenhum processo encontrado"
                : "Nenhum processo encontrado"}
            </h3>
            <p className="text-xs sm:text-sm text-muted mb-4 sm:mb-6">
              {hasActiveFilters
                ? "Tente ajustar os filtros para encontrar mais resultados"
                : "Crie seu primeiro processo para começar"}
            </p>
            {hasActiveFilters ? (
              <Button type="button" variant="light" onClick={handleClearFilters}>
                <X size={18} />
                Limpar Filtros
              </Button>
            ) : (
              <Button type="button" onClick={() => setShowCreateModal(true)}>
                <Plus size={18} />
                Criar Novo Processo
              </Button>
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
            <div className="text-xs sm:text-sm text-muted">
              Página <span className="font-semibold">{currentPage}</span> de{" "}
              <span className="font-semibold">{totalPages}</span>
            </div>

            <div className="flex gap-2 justify-center sm:justify-end">
              <Button
                type="button"
                variant="light"
                onClick={handlePreviousPage}
                disabled={!hasPreviousPage}
                title="Anterior"
              >
                <ChevronLeft size={16} />
                <span className="hidden sm:inline">Anterior</span>
              </Button>

              <Button
                type="button"
                variant="light"
                onClick={handleNextPage}
                disabled={!hasNextPage}
                title="Próximo"
              >
                <span className="hidden sm:inline">Próximo</span>
                <ChevronRight size={16} />
              </Button>
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
