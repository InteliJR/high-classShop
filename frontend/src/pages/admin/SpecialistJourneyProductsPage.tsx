import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdminSpecialistJourney } from "../../contexts/AdminSpecialistJourneyContext";
import {
  getAdminSpecialistProducts,
  importAdminCatalogCsv,
  previewAdminCatalogCsv,
  type AdminCatalogProduct,
  type CsvImportPreview,
  type ProductImportMode,
} from "../../services/admin-specialist-journey.service";
import { deleteCar } from "../../services/cars.service";
import { deleteBoat } from "../../services/boats.service";
import { deleteAircraft } from "../../services/aircrafts.service";
import { formatCurrency } from "../../lib/currency";
import Button from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";

export default function SpecialistJourneyProductsPage() {
  const context = useAdminSpecialistJourney();
  const navigate = useNavigate();
  const [products, setProducts] = useState<AdminCatalogProduct[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ProductImportMode>("ADDITIVE");
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);
  const [syncConfirmed, setSyncConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);

  if (!context) return null;
  const productType = context.specialist.speciality;

  const load = async (nextPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminSpecialistProducts(productType, nextPage, 20);
      setProducts(result.products);
      setPage(result.pagination.current_page);
      setTotalPages(Math.max(1, Math.ceil(result.pagination.total_pages)));
    } catch {
      setError("Não foi possível carregar o catálogo administrativo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    setPreview(null);
    setFile(null);
    void load(1);
  }, [context.targetSpecialistId]);

  const remove = async (id: string) => {
    if (!window.confirm("Desativar este produto do catálogo?")) return;
    if (productType === "CAR") await deleteCar(id);
    else if (productType === "BOAT") await deleteBoat(id);
    else await deleteAircraft(id);
    await load();
  };

  const runPreview = async () => {
    if (!file) return;
    setError(null);
    setSyncConfirmed(false);
    try {
      setPreview(
        await previewAdminCatalogCsv(
          productType,
          context.targetSpecialistId,
          file,
          mode,
        ),
      );
    } catch {
      setError("CSV inválido ou incompatível com a especialidade selecionada.");
    }
  };

  const runImport = async () => {
    if (!file || !preview) return;
    if (mode === "SYNCHRONIZE" && !syncConfirmed) return;
    if (mode === "SYNCHRONIZE" && !preview.synchronizePreviewToken) {
      setError("A prévia expirou. Gere uma nova prévia antes de sincronizar.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const result = await importAdminCatalogCsv(
        productType,
        context.targetSpecialistId,
        file,
        mode,
        syncConfirmed,
        preview.synchronizePreviewToken,
      );
      window.alert(result.message);
      setPreview(null);
      setFile(null);
      await load(1);
    } catch (caught) {
      const explicitMessage =
        caught instanceof Error &&
        (caught.message.includes("prévia") ||
          caught.message.includes("catálogo mudou"))
          ? caught.message
          : null;
      setError(
        explicitMessage ??
          "A importação não foi concluída. O catálogo não foi sincronizado.",
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Catálogo administrativo</h2>
          <p className="text-sm text-ink-soft">
            Itens ativos e inativos de {context.specialist.name}; dono imutável após a criação.
          </p>
        </div>
        <Button onClick={() => navigate("/admin/journey/products/new")}>
          <Plus size={16} /> Novo produto
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <Upload size={18} />
          <h3 className="font-semibold text-ink">Importação CSV segura</h3>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <input
            aria-label="Arquivo CSV"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
          <select
            aria-label="Modo da importação"
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as ProductImportMode);
              setPreview(null);
              setSyncConfirmed(false);
            }}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="ADDITIVE">Acréscimo seguro</option>
            <option value="SYNCHRONIZE">Sincronizar catálogo</option>
          </select>
          <Button variant="light" disabled={!file} onClick={runPreview}>
            Pré-visualizar impacto
          </Button>
        </div>
        {preview && (
          <div className="mt-4 rounded-lg border border-border bg-bg p-4 text-sm">
            <p>
              {preview.impact.incomingItems} linhas · {preview.impact.newOrReactivatedItems} criações/reativações · {preview.impact.matchingItems} atualizações · <strong>{preview.impact.deactivationCandidates} desativações</strong>
            </p>
            {mode === "SYNCHRONIZE" && (
              <label className="mt-3 flex items-start gap-2 text-ink">
                <input
                  type="checkbox"
                  checked={syncConfirmed}
                  onChange={(event) => setSyncConfirmed(event.target.checked)}
                />
                Confirmo a sincronização de {context.specialist.name}, tipo {productType}, com o impacto acima.
              </label>
            )}
            <Button
              className="mt-3"
              disabled={importing || (mode === "SYNCHRONIZE" && !syncConfirmed)}
              onClick={runImport}
            >
              {importing ? "Importando…" : "Executar importação"}
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface p-5">
        {loading ? (
          <p className="py-8 text-center text-muted">Carregando catálogo…</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted">
              <th className="pb-3">Produto</th><th className="pb-3">Valor</th><th className="pb-3">Estado</th><th className="pb-3">Catálogo</th><th className="pb-3 text-right">Ações</th>
            </tr></thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-border-soft">
                  <td className="py-3 font-medium text-ink">{product.marca} {product.modelo}</td>
                  <td className="py-3">{formatCurrency(product.valor, product.currency)}</td>
                  <td className="py-3 capitalize">{product.estado ?? "-"}</td>
                  <td className="py-3">
                    <span className={`rounded-full px-2 py-1 text-xs ${product.is_active ? "bg-status-good-wash text-status-good" : "bg-border-soft text-muted"}`}>
                      {product.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button className="mr-3 text-ink underline" onClick={() => navigate(`/admin/journey/products/edit/${productType.toLowerCase()}s/${product.id}`)}>Editar</button>
                    {product.is_active && <button className="text-status-bad underline" onClick={() => void remove(product.id)}>Desativar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-muted">Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="light" disabled={page <= 1} onClick={() => void load(page - 1)}><ChevronLeft size={16} /> Anterior</Button>
            <Button variant="light" disabled={page >= totalPages} onClick={() => void load(page + 1)}>Próxima <ChevronRight size={16} /></Button>
          </div>
        </div>
      </div>
    </section>
  );
}
