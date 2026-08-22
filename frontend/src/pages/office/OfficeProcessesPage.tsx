import { useCallback, useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import {
  getProcesses,
  type Process,
  type ProcessFilters,
} from "../../services/processes.service";
import { PageHeader } from "../../components/patterns/PageHeader";
import { EmptyState } from "../../components/patterns/EmptyState";
import {
  StatusBadge,
  PROCESS_STATUS_META,
} from "../../components/patterns/StatusBadge";

const PER_PAGE = 20;

const PRODUCT_TYPE_LABEL: Record<string, string> = {
  CAR: "Carro",
  BOAT: "Embarcação",
  AIRCRAFT: "Aeronave",
};

/**
 * Processos dos clientes vinculados ao escritório.
 *
 * A tela não envia nenhum identificador de empresa: o escopo é aplicado no
 * backend a partir do papel de quem está autenticado (ver getAll em
 * processes.service.ts). Enviar company_id daqui seria um filtro que o cliente
 * poderia trocar.
 */
export default function OfficeProcessesPage() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    const filters: ProcessFilters = {
      ...(status && { status }),
      ...(search && { search }),
    };

    getProcesses(page, PER_PAGE, filters)
      .then((result) => {
        setProcesses(result.processes);
        setByStatus(result.byStatus);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      })
      .catch((e) =>
        setError(
          (e as { friendlyMessage?: string }).friendlyMessage ||
            "Erro ao carregar processos",
        ),
      )
      .finally(() => setLoading(false));
  }, [page, status, search]);

  useEffect(() => {
    load();
  }, [load]);

  // Trocar de filtro volta para a primeira página: manter a página atual pode
  // cair num intervalo vazio e a tela parecer sem resultados.
  const applyStatus = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  const applySearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="p-8">
      <PageHeader title="Processos do escritório" />

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applySearch()}
          placeholder="Buscar por cliente, e-mail ou produto..."
          className="flex-1 min-w-[240px] px-3 py-2 border border-border rounded-md"
        />
        <select
          value={status}
          onChange={(e) => applyStatus(e.target.value)}
          className="px-3 py-2 border border-border rounded-md"
        >
          <option value="">Todos os status</option>
          {PROCESS_STATUS_META.map((meta) => (
            <option key={meta.value} value={meta.value}>
              {meta.label}
              {byStatus[meta.value] ? ` (${byStatus[meta.value]})` : ""}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-muted">Carregando...</p>}
      {error && <p className="text-status-bad">{error}</p>}

      {!loading && !error && processes.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title={
            status || search
              ? "Nenhum processo para esse filtro."
              : "Nenhum processo ainda."
          }
        />
      )}

      {!loading && !error && processes.length > 0 && (
        <>
          <div className="bg-surface rounded-lg shadow overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-border-soft border-b border-border">
                <tr>
                  <th className="text-left text-xs font-medium text-muted uppercase px-4 py-3">
                    Cliente
                  </th>
                  <th className="text-left text-xs font-medium text-muted uppercase px-4 py-3">
                    Especialista
                  </th>
                  <th className="text-left text-xs font-medium text-muted uppercase px-4 py-3">
                    Tipo
                  </th>
                  <th className="text-left text-xs font-medium text-muted uppercase px-4 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-muted uppercase px-4 py-3">
                    Aberto em
                  </th>
                </tr>
              </thead>
              <tbody>
                {processes.map((process) => (
                  <tr key={process.id} className="border-b border-border-soft">
                    <td className="px-4 py-3 text-sm">
                      {process.client?.name ?? "—"}
                      {process.client?.email && (
                        <span className="block text-xs text-muted">
                          {process.client.email}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {process.specialist?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {process.product_type
                        ? (PRODUCT_TYPE_LABEL[process.product_type] ??
                          process.product_type)
                        : "Consultoria"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={process.status} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(process.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted">
              {total} processo{total === 1 ? "" : "s"}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-2 text-sm border border-border rounded-md disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-sm text-muted">
                  {page} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-2 text-sm border border-border rounded-md disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
