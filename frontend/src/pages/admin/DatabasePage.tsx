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
  Pencil,
  Trash2,
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
import { Dialog, DialogContent } from "../../components/ui/dialog";
import { EmptyState } from "../../components/patterns/EmptyState";
import AdminUserManagementDialog, {
  type AdminUserManagementDialogState,
} from "../../components/admin/AdminUserManagementDialog";
import {
  createLatestRequestGuard,
  deleteUser,
  isSameRecordsOrigin,
  shouldInvalidateRecordsRequest,
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Exclusão é irreversível e libera documentos: confirma antes, sempre.
  const [userToDelete, setUserToDelete] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialogState, setDialogState] =
    useState<AdminUserManagementDialogState | null>(null);
  const recordsRequestGuard = useRef(createLatestRequestGuard());

  useEffect(() => {
    getEntities()
      .then((list) => {
        setEntities(list);
        setActive(list[0]?.key ?? null);
        if (list.length === 0) setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message || "Erro ao carregar entidades.");
        setLoading(false);
      });
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
  // `rowMeta` foi adicionado depois do navegador inicial. Enquanto frontend e
  // backend não estão no mesmo deploy, a resposta antiga não o possui.
  // Mantemos a tabela navegável e apenas desabilitamos a edição de usuários.
  const rowMeta = result?.rowMeta ?? [];
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
              const current = active ? { entity: active, page } : null;
              const next = { entity: e.key, page: 1 };
              if (!shouldInvalidateRecordsRequest(current, next)) return;
              recordsRequestGuard.current.invalidate();
              setActive(e.key);
              setPage(1);
              setSuccessMessage(null);
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

      {successMessage && (
        <Alert variant="success" className="mb-4">
          {successMessage}
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
                        <Button
                          type="button"
                          variant="ghost"
                          className="p-2"
                          disabled={!rowMeta[i]?.id}
                          aria-label="Editar usuário"
                          title="Editar usuário"
                          onClick={() => {
                            const user = rowMeta[i];
                            if (!user?.id) return;
                            setSuccessMessage(null);
                            setDialogState({
                              userId: user.id,
                              mode:
                                user.role === "SPECIALIST"
                                  ? "specialist"
                                  : "role",
                              speciality: user.speciality,
                              commissionRate: user.commission_rate,
                            });
                          }}
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="p-2 text-status-bad"
                          disabled={!rowMeta[i]?.id}
                          aria-label="Excluir usuário"
                          title="Excluir usuário"
                          onClick={() => {
                            const user = rowMeta[i];
                            if (!user?.id) return;
                            setSuccessMessage(null);
                            // O nome vem da primeira coluna da aba Usuários.
                            const nome = cellText(row[0] ?? "");
                            setUserToDelete({ id: user.id, label: nome });
                          }}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </Button>
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
        onSuccess={async () => {
          setSuccessMessage("Alteração realizada com sucesso.");
          await loadRecords();
        }}
      />

      <Dialog
        open={!!userToDelete}
        onOpenChange={(aberto) => {
          if (!aberto && !deleting) setUserToDelete(null);
        }}
      >
        <DialogContent open={!!userToDelete} title="Excluir usuário">
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">
              Excluir a conta de <strong>{userToDelete?.label}</strong>?
            </p>
            <Alert variant="warning">
              <div className="text-sm space-y-1">
                <p>
                  O e-mail, CPF, RG e matrícula voltam a ficar livres, e a
                  pessoa poderá se cadastrar de novo com os mesmos dados.
                </p>
                <p>
                  Processos, propostas e contratos vinculados continuam
                  consultáveis. Esta ação não pode ser desfeita.
                </p>
              </div>
            </Alert>
            {error && <Alert variant="danger">{error}</Alert>}
            <div className="flex justify-end gap-3 pt-1">
              <Button
                type="button"
                variant="light"
                disabled={deleting}
                onClick={() => setUserToDelete(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  if (!userToDelete) return;
                  setDeleting(true);
                  setError(null);
                  try {
                    await deleteUser(userToDelete.id);
                    setUserToDelete(null);
                    setSuccessMessage(
                      "Conta excluída. E-mail e documentos liberados para novo cadastro.",
                    );
                    await loadRecords();
                  } catch (err) {
                    setError(
                      (err as { friendlyMessage?: string })?.friendlyMessage ??
                        "Não foi possível excluir a conta.",
                    );
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Excluindo...
                  </span>
                ) : (
                  "Excluir conta"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
