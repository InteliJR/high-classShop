import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllConsultantProcesses, getClients, type ConsultantProcess, type Client } from "../../services/consultant.service";
import { Loader2, Search, X, ChevronDown } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  SCHEDULING: "Agendamento",
  NEGOTIATION: "Negociação",
  PROCESSING_CONTRACT: "Contrato",
  DOCUMENTATION: "Documentação",
  COMPLETED: "Concluído",
  REJECTED: "Rejeitado",
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULING: "bg-blue-100 text-blue-700",
  NEGOTIATION: "bg-yellow-100 text-yellow-700",
  PROCESSING_CONTRACT: "bg-orange-100 text-orange-700",
  DOCUMENTATION: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

const PRODUCT_LABELS: Record<string, string> = {
  CAR: "Carro",
  BOAT: "Embarcação",
  AIRCRAFT: "Aeronave",
};

const PAGE_SIZE = 15;

export default function ConsultantProcessesPage() {
  const navigate = useNavigate();
  const [processes, setProcesses] = useState<ConsultantProcess[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [page, setPage] = useState(1);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch clients once (for the filter dropdown)
  useEffect(() => {
    getClients().then(setClients).catch(() => setClients([]));
  }, []);

  // Fetch processes whenever server-side filters change
  const fetchProcesses = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getAllConsultantProcesses({
        status: statusFilter || undefined,
        clientId: selectedClient?.id,
      });
      setProcesses(data);
      setPage(1);
      setError(null);
    } catch {
      setError("Não foi possível carregar os processos.");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, selectedClient]);

  useEffect(() => { fetchProcesses(); }, [fetchProcesses]);

  // Close client dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.name} ${c.surname} ${c.email ?? ""}`.toLowerCase().includes(q),
    );
  }, [clientSearch, clients]);

  // Client-side pagination over filtered (server-filtered) processes
  const totalPages = Math.max(1, Math.ceil(processes.length / PAGE_SIZE));
  const pageProcesses = processes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const clearFilters = () => {
    setStatusFilter("");
    setSelectedClient(null);
    setClientSearch("");
  };

  const hasFilters = statusFilter !== "" || selectedClient !== null;

  return (
    <div className="text-text-main w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="h1-style">Processos dos Clientes</h1>
      </div>

      {/* Filtros */}
      <div className="p-4 rounded-lg shadow bg-white mb-4 flex flex-wrap items-center gap-3">
        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm px-3 py-2 border border-gray-300 rounded-md bg-white min-w-[180px]"
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Cliente */}
        <div className="flex flex-col gap-1 relative" ref={dropdownRef}>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</label>
          <button
            type="button"
            onClick={() => setIsClientDropdownOpen((v) => !v)}
            className="flex items-center justify-between gap-2 text-sm px-3 py-2 border border-gray-300 rounded-md bg-white min-w-[240px] hover:border-gray-400"
          >
            <span className={selectedClient ? "text-gray-900" : "text-gray-400"}>
              {selectedClient
                ? `${selectedClient.name} ${selectedClient.surname}`
                : "Todos os clientes"}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {isClientDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 max-h-72 overflow-hidden flex flex-col">
              <div className="p-2 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Buscar cliente..."
                    className="w-full text-sm pl-8 pr-2 py-1.5 border border-gray-200 rounded"
                    autoFocus
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClient(null);
                    setIsClientDropdownOpen(false);
                    setClientSearch("");
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-500 border-b border-gray-100"
                >
                  Todos os clientes
                </button>
                {filteredClients.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-400">Nenhum cliente.</p>
                ) : (
                  filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedClient(c);
                        setIsClientDropdownOpen(false);
                        setClientSearch("");
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900">{c.name} {c.surname}</div>
                      <div className="text-xs text-gray-400">{c.email}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 px-3 py-2 self-end"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        )}
      </div>

      {/* Lista de processos */}
      <div className="p-6 rounded-lg shadow bg-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="h2-style">Processos</h2>
            <p className="text-sm text-gray-500 mt-1">
              Clique em um processo para gerenciar a negociação.
            </p>
          </div>
          <span className="text-sm text-gray-500">
            {processes.length} {processes.length === 1 ? "processo" : "processos"}
          </span>
        </div>

        {error ? (
          <p className="text-red-500">{error}</p>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              <p className="text-sm text-gray-500">Carregando processos...</p>
            </div>
          </div>
        ) : processes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {hasFilters
              ? "Nenhum processo com esses filtros."
              : "Nenhum processo ainda. Crie processos na página de Clientes."}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] gap-4 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div>Cliente</div>
                <div>Especialista</div>
                <div>Produto</div>
                <div>Status</div>
                <div>Data</div>
              </div>

              {pageProcesses.map((proc) => (
                <div
                  key={proc.id}
                  onClick={() => navigate(`/processes/${proc.id}/negotiation`)}
                  className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] gap-4 items-center px-4 py-3 bg-white rounded-lg border border-gray-100 hover:border-gray-300 cursor-pointer transition-colors"
                >
                  <div className="text-sm font-medium text-gray-900">
                    {proc.client ? `${proc.client.name} ${proc.client.surname}` : "—"}
                  </div>
                  <div className="text-sm text-gray-600">
                    {proc.specialist ? `${proc.specialist.name} ${proc.specialist.surname}` : "—"}
                  </div>
                  <div className="text-sm text-gray-600">
                    {PRODUCT_LABELS[proc.product_type ?? ""] ?? proc.product_type ?? "Consultoria"}
                  </div>
                  <div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[proc.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[proc.status] ?? proc.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(proc.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              ))}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                <span className="text-xs text-gray-500">
                  Página {page} de {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
