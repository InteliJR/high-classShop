import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { useAuth } from "../../store/authStateManager";
import { deleteCar } from "../../services/cars.service";
import { deleteBoat } from "../../services/boats.service";
import { deleteAircraft } from "../../services/aircrafts.service";
import {
  getAdminSpecialistProducts,
  type AdminCatalogProduct,
} from "../../services/admin-specialist-journey.service";
import type { SpecialityType } from "../../types/types";
import Button from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { PageHeader } from "../../components/patterns/PageHeader";
import ResponsiveProductList from "../../components/specialist/ResponsiveProductList";

const PRODUCTS_PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const productTypeRoute: Record<SpecialityType, string> = {
  CAR: "cars",
  BOAT: "boats",
  AIRCRAFT: "aircrafts",
};

const productTypeLabel: Record<SpecialityType, string> = {
  CAR: "Carros",
  BOAT: "Lanchas",
  AIRCRAFT: "Aeronaves",
};

/**
 * Gestão de produtos do especialista.
 *
 * Lista paginada no servidor via `/{tipo}/admin/all`, que o backend restringe
 * aos produtos do próprio especialista e inclui os inativos. Antes a tela
 * pegava os 100 primeiros produtos da plataforma inteira e filtrava no
 * navegador, então quem tinha itens fora desse recorte não os via.
 */
export default function ProductsPage() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const speciality = user?.speciality as SpecialityType | undefined;

  const [products, setProducts] = useState<AdminCatalogProduct[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(Boolean(speciality));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // A busca é local: o header do especialista não tem campo de pesquisa, e o
  // searchTerm do AppContext nunca era preenchido nesta tela.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Só a resposta da última requisição vale: digitar rápido dispara várias e
  // elas podem voltar fora de ordem.
  const latestRequest = useRef(0);

  useEffect(() => {
    const timer = setTimeout(
      () => setSearch(searchInput.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadProducts = useCallback(
    async (targetPage: number) => {
      if (!speciality) return;
      const requestId = ++latestRequest.current;
      setLoading(true);
      setError(null);
      try {
        const { products: pageProducts, pagination } =
          await getAdminSpecialistProducts(
            speciality,
            targetPage,
            PRODUCTS_PER_PAGE,
            search,
          );
        if (requestId !== latestRequest.current) return;
        setProducts(pageProducts);
        setPage(pagination.current_page);
        setTotal(pagination.total);
        setTotalPages(Math.max(1, Math.ceil(pagination.total_pages)));
      } catch (caught) {
        if (requestId !== latestRequest.current) return;
        console.error("Erro ao carregar produtos:", caught);
        setProducts([]);
        setError(
          (caught as { friendlyMessage?: string })?.friendlyMessage ??
            "Não foi possível carregar seus produtos.",
        );
      } finally {
        if (requestId === latestRequest.current) setLoading(false);
      }
    },
    [speciality, search],
  );

  // Busca nova sempre recomeça da primeira página.
  useEffect(() => {
    void loadProducts(1);
  }, [loadProducts]);

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "Desativar este produto? Ele sai do catálogo e continua na sua lista como inativo.",
      )
    ) {
      return;
    }

    setNotice(null);
    try {
      if (speciality === "CAR") await deleteCar(id);
      else if (speciality === "BOAT") await deleteBoat(id);
      else await deleteAircraft(id);
      // O produto continua na lista (agora inativo), então a página atual
      // segue válida.
      await loadProducts(page);
      setNotice("Produto desativado. Ele continua na lista como inativo.");
    } catch (caught) {
      console.error("Erro ao desativar produto:", caught);
      window.alert("Erro ao desativar produto");
    }
  };

  // Enquanto a busca digitada não foi aplicada (debounce), trocar de página
  // carregaria o resultado do termo antigo e logo voltaria para a página 1.
  const searchPending = searchInput.trim() !== search;

  const handleEdit = (id: string) => {
    if (!speciality) return;
    navigate(
      `/specialist/products/edit/${productTypeRoute[speciality]}/${id}`,
    );
  };

  return (
    <div className="w-full">
      <PageHeader
        title="Gestão de Produtos"
        actions={
          <Button type="button" onClick={() => navigate("/specialist/products/new")}>
            <Plus size={16} />
            Novo Produto
          </Button>
        }
      />

      {!speciality ? (
        <Alert variant="warning" className="mb-4">
          Sua conta não tem uma especialidade definida, então não é possível
          listar seus produtos. Peça ao administrador para configurá-la.
        </Alert>
      ) : (
        <>
          <Alert variant="info" className="mb-4">
            <p>
              <span className="font-semibold">Sua especialidade:</span>{" "}
              {productTypeLabel[speciality]}
            </p>
          </Alert>

          {notice && (
            <Alert variant="success" className="mb-4" role="status">
              {notice}
            </Alert>
          )}

          {error && (
            <Alert variant="danger" className="mb-4">
              {error}
            </Alert>
          )}

          <Card>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-h2 font-semibold text-ink">
                {productTypeLabel[speciality]}
              </h2>
              {!loading && !error && (
                <span className="text-sm text-muted">
                  {total === 1 ? "1 produto" : `${total} produtos`}
                </span>
              )}
            </div>

            <div className="relative mb-4 max-w-md">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
                aria-hidden
              />
              <Input
                type="search"
                value={searchInput}
                onChange={(event) => {
                  setNotice(null);
                  setSearchInput(event.target.value);
                }}
                placeholder="Buscar por marca, modelo, estado ou ano"
                aria-label="Buscar produtos"
                className="pl-9"
              />
            </div>

            {loading ? (
              <p className="text-center text-muted py-8">Carregando...</p>
            ) : products.length === 0 ? (
              !error && (
                <p className="text-center text-muted py-8">
                  {search
                    ? "Nenhum produto encontrado com esse termo de pesquisa"
                    : "Nenhum produto cadastrado"}
                </p>
              )
            ) : (
              <ResponsiveProductList
                products={products}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}

            {!loading && totalPages > 1 && (
              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs sm:text-sm text-muted">
                  Página <span className="font-semibold">{page}</span> de{" "}
                  <span className="font-semibold">{totalPages}</span>
                </div>
                <div className="flex gap-2 justify-center sm:justify-end">
                  <Button
                    type="button"
                    variant="light"
                    onClick={() => void loadProducts(page - 1)}
                    disabled={page <= 1 || searchPending}
                    title="Anterior"
                  >
                    <ChevronLeft size={16} />
                    <span className="hidden sm:inline">Anterior</span>
                  </Button>
                  <Button
                    type="button"
                    variant="light"
                    onClick={() => void loadProducts(page + 1)}
                    disabled={page >= totalPages || searchPending}
                    title="Próxima"
                  >
                    <span className="hidden sm:inline">Próxima</span>
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
