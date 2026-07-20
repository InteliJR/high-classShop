// Navegador read-only da base de dados (ADMIN): abas por tabela + paginação.
import { useEffect, useState } from "react";
import {
  Database,
  Loader,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
} from "lucide-react";
import {
  getEntities,
  getRecords,
  type EntityInfo,
  type RecordsPage,
} from "../../services/admin-database.service";
import { downloadCsv, openPrintablePdf } from "../../utils/export";

const PAGE_SIZE = 20;

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") return JSON.stringify(value);
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toLocaleString("pt-BR");
  }
  return str;
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

  const rows = result?.data ?? [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.pageSize))
    : 1;
  const activeLabel =
    entities.find((e) => e.key === active)?.label ?? active ?? "";
  const exportRows = () => rows.map((r) => columns.map((c) => formatCell(r[c])));

  return (
    <div className="text-text-main w-full">
      <div className="flex items-center gap-3 mb-6">
        <Database className="w-7 h-7 text-slate-700" />
        <div>
          <h1 className="h1-style">Base de dados</h1>
          <p className="text-sm text-gray-500">
            Visão consolidada — navegue por todas as tabelas da plataforma.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-4">
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
                ? "border-slate-700 text-slate-800"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 p-4">Nenhum registro.</p>
      ) : (
        <>
          <div className="flex justify-end gap-2 mb-3">
            <button
              type="button"
              onClick={() => downloadCsv(`${active}.csv`, columns, exportRows())}
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
            <button
              type="button"
              onClick={() =>
                openPrintablePdf(
                  `Base de dados — ${activeLabel}`,
                  columns,
                  exportRows(),
                )
              }
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <FileText className="w-4 h-4" /> PDF
            </button>
          </div>

          <div className="overflow-auto border border-gray-200 rounded-lg max-h-[65vh]">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c}
                      className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    {columns.map((c) => {
                      const text = formatCell(row[c]);
                      return (
                        <td
                          key={c}
                          className="px-3 py-2 whitespace-nowrap text-gray-700 max-w-[280px] truncate"
                          title={text}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
            <span>{result?.total ?? 0} registros</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <span>
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Próxima <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
