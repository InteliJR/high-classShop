// Navegador read-only da base de dados (ADMIN): abas por tabela + paginação.
// A formatação toda (labels pt-BR, máscaras, moeda, enums) vive no backend,
// em admin-database.columns.ts — aqui só renderizamos o que chega, e o export
// consome exatamente a mesma matriz da tela.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  FileText,
  Loader2,
} from "lucide-react";
import {
  getEntities,
  getRecords,
  type Cell,
  type EntityInfo,
  type RecordsPage,
} from "../../services/admin-database.service";
import { downloadCsv, openPrintablePdf } from "../../utils/export";
import Button from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { EmptyState } from "../../components/patterns/EmptyState";
import AdminUserManagementDialog, {
  type AdminUserManagementDialogState,
} from "../../components/admin/AdminUserManagementDialog";
import {
  createLatestRequestGuard,
  isSameRecordsOrigin,
  type RecordsOrigin,
} from "../../lib/admin-user-management";

const PAGE_SIZE = 20;

type LoadedRecords = {
  origin: RecordsOrigin;
  records: RecordsPage;
};

/** Versão textual da célula — usada no CSV e no PDF. Imagem vira Sim/—. */
function cellText(cell: Cell): string {
  if (typeof cell === "string") return cell;
  return cell.url ? "Sim" : "—";
}

export default function DatabasePage() {
  const [entities, setEntities] = useState<EntityInfo[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [loadedRecords, setLoadedRecords] = useState<LoadedRecords | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogState, setDialogState] =
    useState<AdminUserManagementDialogState | null>(null);
  const recordsRequestGuard = useRef(createLatestRequestGuard());

  useEffect(() => {
    getEntities()
      .then((list) => {
        recordsRequestGuard.current.invalidate();
        setEntities(list);
        setActive(list[0]?.key ?? null);
      })
      .catch((err) =>
        setError((err as Error).message || "Erro ao carregar entidades."),
      );
  }, []);

  const loadRecords = useCallback(async () => {
    if (!active) return;
    const origin = { entity: active, page };
    const requestId = recordsRequestGuard.current.begin();
    setLoading(true);
    setError(null);
    try {
      const records = await getRecords(active, page, PAGE_SIZE);
      if (!recordsRequestGuard.current.isCurrent(requestId)) return;
      setLoadedRecords({ origin, records });
    } catch (err) {
      if (!recordsRequestGuard.current.isCurrent(requestId)) return;
      // Descarta o resultado anterior: sem isso a aba nova mostra as linhas
      // da aba antiga, e o CSV sai nomeado com a entidade errada.
      setLoadedRecords(null);
      setError((err as Error).message || "Erro ao carregar registros.");
    } finally {
      if (recordsRequestGuard.current.isCurrent(requestId)) setLoading(false);
    }
  }, [active, page]);

  useEffect(() => {
    const requestGuard = recordsRequestGuard.current;
    void loadRecords();
    return () => requestGuard.invalidate();
  }, [loadRecords]);

  const currentOrigin = active ? { entity: active, page } : null;
  const result =
    loadedRecords &&
    currentOrigin &&
    isSameRecordsOrigin(loadedRecords.origin, currentOrigin)
      ? loadedRecords.records
      : null;

  const columns = result?.columns ?? [];
  const rows = result?.data ?? [];
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.pageSize))
    : 1;
  const activeLabel =
    entities.find((e) => e.key === active)?.label ?? active ?? "";
  const headers = columns.map((c) => c.label);
  const exportRows = () => rows.map((r) => r.map(cellText));

  return (
    <div className="text-text-main w-full min-w-0">
      <div className="flex items-center gap-3 mb-6">
        <Database className="w-7 h-7 text-ink-soft" />
        <div>
          <h1 className="text-h1 font-bold text-ink">Base de dados</h1>
          <p className="text-sm text-muted">
            Visão consolidada — navegue por todas as tabelas da plataforma.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border mb-4">
        {entities.map((e) => (
          <button
            key={e.key}
            type="button"
            onClick={() => {
              recordsRequestGuard.current.invalidate();
              setActive(e.key);
              setPage(1);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active === e.key
                ? "border-ink text-ink"
                : "border-transparent text-muted hover:text-ink-soft"
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-subtle" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Database} title="Nenhum registro." />
      ) : (
        <>
          <div className="flex justify-end gap-2 mb-3">
            <Button
              type="button"
              variant="light"
              onClick={() =>
                downloadCsv(`${active}.csv`, headers, exportRows())
              }
            >
              <Download className="w-4 h-4" /> CSV
            </Button>
            <Button
              type="button"
              variant="light"
              onClick={() =>
                openPrintablePdf(
                  `Base de dados — ${activeLabel}`,
                  headers,
                  exportRows(),
                )
              }
            >
              <FileText className="w-4 h-4" /> PDF
            </Button>
          </div>

          <div className="overflow-auto border border-border rounded-lg max-h-[65vh] w-full max-w-full">
            <table className="min-w-full text-sm">
              <thead className="bg-border-soft sticky top-0 z-10">
                <tr>
                  {active === "users" ? (
                    <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">
                      Ações
                    </th>
                  ) : null}
                  {columns.map((c) => (
                    <th
                      key={c.label}
                      className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap"
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-border-soft">
                    {active === "users" ? (
                      <td className="px-3 py-2 whitespace-nowrap align-top">
                        <div className="flex flex-col items-start gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            className="px-2 py-1 text-xs"
                            disabled={!result?.rowMeta[i]?.id}
                            onClick={() =>
                              setDialogState({
                                userId: result!.rowMeta[i].id,
                                mode: "role",
                              })
                            }
                          >
                            Alterar cargo
                          </Button>
                          {result?.rowMeta[i]?.role === "SPECIALIST" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="px-2 py-1 text-xs"
                              onClick={() =>
                                setDialogState({
                                  userId: result.rowMeta[i].id,
                                  mode: "speciality",
                                })
                              }
                            >
                              Alterar especialidade
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                    {row.map((cell, j) => {
                      const wide = columns[j]?.wide;
                      const text = cellText(cell);
                      return (
                        <td
                          key={j}
                          className={
                            wide
                              ? // Texto livre longo (Observações, Descrição):
                                // quebra em até 3 linhas em vez de sumir no truncate.
                                "px-3 py-2 align-top text-ink-soft whitespace-normal min-w-[240px] max-w-[360px] line-clamp-3"
                              : "px-3 py-2 whitespace-nowrap text-ink-soft max-w-[280px] truncate"
                          }
                          title={text}
                        >
                          {typeof cell === "string" ? (
                            cell
                          ) : cell.url ? (
                            <img
                              src={cell.url}
                              alt={cell.alt}
                              className="h-8 w-auto object-contain"
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-3 text-sm text-muted">
            <span>{result?.total ?? 0} registros</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="light"
                disabled={page <= 1}
                onClick={() => {
                  recordsRequestGuard.current.invalidate();
                  setPage((p) => p - 1);
                }}
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Button>
              <span>
                Página {page} de {totalPages}
              </span>
              <Button
                type="button"
                variant="light"
                disabled={page >= totalPages}
                onClick={() => {
                  recordsRequestGuard.current.invalidate();
                  setPage((p) => p + 1);
                }}
              >
                Próxima <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <AdminUserManagementDialog
        state={dialogState}
        onClose={() => setDialogState(null)}
        onSuccess={loadRecords}
      />
    </div>
  );
}
