import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllConsultantProcesses, getClients, type ConsultantProcess, type Client } from "../../services/consultant.service";
import { Loader2, Search, X, ChevronDown } from "lucide-react";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../../components/patterns/PageHeader";
import { StatusBadge, PROCESS_STATUS_META } from "../../components/patterns/StatusBadge";
import { EmptyState } from "../../components/patterns/EmptyState";

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

  useEffect(() => {
    getClients().then(setClients).catch(() => setClients([]));
  }, []);

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
      <PageHeader title="Processos dos Clientes" />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted uppercase tracking-wider">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm px-3 py-2 border border-border rounded-md bg-surface min-w-[180px]"
          >
            <option value="">Todos</option>
            {PROCESS_STATUS_META.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 relative" ref={dropdownRef}>
          <label className="text-xs font-medium text-muted uppercase tracking-wider">Cliente</label>
          <button
            type="button"
            onClick={() => setIsClientDropdownOpen((v) => !v)}
            className="flex items-center justify-between gap-2 text-sm px-3 py-2 border border-border rounded-md bg-surface min-w-[240px] hover:border-ink-soft"
          >
            <span className={selectedClient ? "text-ink" : "text-subtle"}>
              {selectedClient
                ? `${selectedClient.name} ${selectedClient.surname}`
                : "Todos os clientes"}
            </span>
            <ChevronDown className="w-4 h-4 text-muted" />
          </button>

          {isClientDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-md shadow-ds-floating z-20 max-h-72 overflow-hidden flex flex-col">
              <div className="p-2 border-b border-border-soft">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Buscar cliente..."
                    className="w-full text-sm pl-8 pr-2 py-1.5 border border-border-soft rounded"
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
                  className="w-full text-left px-3 py-2 text-sm hover:bg-border-soft text-subtle border-b border-border-soft"
                >
                  Todos os clientes
                </button>
                {filteredClients.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-subtle">Nenhum cliente.</p>
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
                      className="w-full text-left px-3 py-2 text-sm hover:bg-border-soft"
                    >
                      <div className="font-medium text-ink">{c.name} {c.surname}</div>
                      <div className="text-xs text-subtle">{c.email}</div>
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
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink px-3 py-2 self-end"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-h2 font-semibold text-ink">Processos</h2>
            <p className="text-sm text-muted mt-1">
              Clique em um processo para ver os detalhes.
            </p>
          </div>
          <span className="text-sm text-muted">
            {processes.length} {processes.length === 1 ? "processo" : "processos"}
          </span>
        </div>

        {error ? (
          <p className="text-status-bad">{error}</p>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-subtle" />
              <p className="text-sm text-muted">Carregando processos...</p>
            </div>
          </div>
        ) : processes.length === 0 ? (
          <EmptyState
            icon={Search}
            title={hasFilters ? "Nenhum processo com esses filtros" : "Nenhum processo ainda"}
            description={hasFilters ? undefined : "Crie processos na página de Clientes."}
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs uppercase tracking-wide text-muted font-semibold px-4 py-3">Cliente</th>
                    <th className="text-left text-xs uppercase tracking-wide text-muted font-semibold px-4 py-3">Especialista</th>
                    <th className="text-left text-xs uppercase tracking-wide text-muted font-semibold px-4 py-3">Produto</th>
                    <th className="text-left text-xs uppercase tracking-wide text-muted font-semibold px-4 py-3">Status</th>
                    <th className="text-left text-xs uppercase tracking-wide text-muted font-semibold px-4 py-3">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {pageProcesses.map((proc) => (
                    <tr
                      key={proc.id}
                      onClick={() => navigate(`/consultant/processes/${proc.id}`)}
                      className="border-b border-border-soft hover:bg-border-soft/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-ink">
                        {proc.client ? `${proc.client.name} ${proc.client.surname}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {proc.specialist ? `${proc.specialist.name} ${proc.specialist.surname}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {PRODUCT_LABELS[proc.product_type ?? ""] ?? proc.product_type ?? "Consultoria"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={proc.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-subtle">
                        {new Date(proc.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <span className="text-xs text-muted">
                  Página {page} de {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm rounded border border-border hover:bg-border-soft disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm rounded border border-border hover:bg-border-soft disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
