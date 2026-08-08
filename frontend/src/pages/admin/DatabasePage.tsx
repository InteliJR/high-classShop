// Navegador read-only da base de dados (ADMIN): abas por tabela + paginação.
// A formatação toda (labels pt-BR, máscaras, moeda, enums) vive no backend,
// em admin-database.columns.ts — aqui só renderizamos o que chega, e o export
// consome exatamente a mesma matriz da tela.
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  FileText,
  Loader,
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

const PAGE_SIZE = 20;

/** Versão textual da célula — usada no CSV e no PDF. Imagem vira Sim/—. */
function cellText(cell: Cell): string {
  if (typeof cell === "string") return cell;
  return cell.url ? "Sim" : "—";
}

export default function DatabasePage() {
  const [entities, setEntities] = useState<EntityInfo[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<RecordsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEntities()
      .then((list) => {
        setEntities(list);
        setActive(list[0]?.key ?? null);
      })
      .catch((err) =>
        setError((err as Error).message || "Erro ao carregar entidades."),
      );
  }, []);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    setError(null);
    getRecords(active, page, PAGE_SIZE)
      .then(setResult)
      .catch((err) =>
        setError((err as Error).message || "Erro ao carregar registros."),
      )
      .finally(() => setLoading(false));
  }, [active, page]);

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
          <Loader className="w-8 h-8 animate-spin text-subtle" />
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
                onClick={() => setPage((p) => p - 1)}
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
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
