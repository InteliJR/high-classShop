import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getCars } from "../../services/cars.service.ts";
import { getBoats } from "../../services/boats.service.ts";
import { getAircrafts } from "../../services/aircrafts.service.ts";
import type { PaginationMeta, Product } from "../../types/types.ts";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
} from "lucide-react";
import Button from "../../components/ui/button.tsx";
import { Dialog, DialogContent } from "../../components/ui/dialog.tsx";
import { Input } from "../../components/ui/input.tsx";
import { PageHeader } from "../../components/patterns/PageHeader.tsx";
import { EmptyState } from "../../components/patterns/EmptyState.tsx";
import ProductCard from "../../components/product/ProductCard";
import Loading from "../../components/ui/Loading.tsx";

// Mapeamento dos títulos de acordo com a rota passada
const titles: { [key: string]: string } = {
  cars: "Carros",
  boats: "Embarcações",
  aircrafts: "Aeronaves",
};

// Filtro aplicado pelo cliente no catálogo — só os 6 campos comuns às 3
// categorias (marca/modelo/ano/preço). Estruturalmente compatível com
// Partial<FiltersCarMeta>/Partial<FiltersBoatsMeta>/Partial<FiltersAircraftsMeta>,
// então passa direto pros services sem cast.
interface ProductFilters {
  marca?: string;
  modelo?: string;
  ano_min?: number;
  ano_max?: number;
  preco_min?: number;
  preco_max?: number;
}

const EMPTY_FILTERS: ProductFilters = {};

export default function Catalog() {
  // Coleta a categoria passada na rota
  const { category } = useParams();
  const navigate = useNavigate();

  //Gerenciamento dos estados dos produtos, carregamento, e páginas
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [filter, setFilter] = useState<ProductFilters | null>(null);
  const [filterModal, setFilterModal] = useState(false);
  // Rascunho do formulário do modal — só vira o filtro aplicado ao clicar "Aplicar"
  const [filterDraft, setFilterDraft] = useState<ProductFilters>(EMPTY_FILTERS);

  //Consumir a api
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        let data: Product[] = [];
        let pagination: PaginationMeta | null = null;
        const appliedFilters = filter ?? EMPTY_FILTERS;
        switch (category) {
          case "cars":
            ({ cars: data, pagination } = await getCars(
              page,
              20,
              appliedFilters,
            ));
            break;

          case "boats":
            ({ boats: data, pagination } = await getBoats(
              page,
              20,
              appliedFilters,
            ));
            break;

          case "aircrafts":
            ({ aircrafts: data, pagination } = await getAircrafts(
              page,
              20,
              appliedFilters,
            ));
            break;

          default:
            console.warn("Categoria desconhecida", category);
        }

        setProducts(data);
        setPagination(pagination);
      } catch (error) {
        console.error("Ocorreu um erro: ", error);
      } finally {
        setLoading(false);
      }
    };
    if (category) {
      fetchData();
    }
  }, [category, page, filter]); //Repete cada vez que a categoria, página ou filtro for trocado
  // Funções para torcar de página
  function goNextPage() {
    if (pagination?.has_next) {
      setPage((page) => page + 1);
    }
  }
  function goPrevPage() {
    if (pagination?.has_prev) {
      setPage((page) => page - 1);
    }
  }
  function goLastPage() {
    setPage(pagination?.total_pages || page);
  }
  function goFirstPage() {
    setPage(1);
  }

  // Abre o modal de filtro, iniciando o rascunho a partir do filtro já aplicado
  function openFilterModal() {
    setFilterDraft(filter ?? EMPTY_FILTERS);
    setFilterModal(true);
  }

  function updateDraftText(field: "marca" | "modelo", value: string) {
    setFilterDraft((prev) => ({ ...prev, [field]: value || undefined }));
  }

  function updateDraftNumber(
    field: "ano_min" | "ano_max" | "preco_min" | "preco_max",
    value: string,
  ) {
    setFilterDraft((prev) => ({
      ...prev,
      [field]: value === "" ? undefined : Number(value),
    }));
  }

  // Aplica o rascunho como filtro ativo: fecha o modal, reseta a página e
  // dispara o refetch (o useEffect já reage à mudança de `filter`)
  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    setFilter(filterDraft);
    setPage(1);
    setFilterModal(false);
  }

  // Limpa o filtro ativo (não só o rascunho do modal) e volta pra página 1
  function clearFilters() {
    setFilterDraft(EMPTY_FILTERS);
    setFilter(EMPTY_FILTERS);
    setPage(1);
    setFilterModal(false);
  }

  // Tela de carregamento
  if (loading) {
    return <Loading size="lg" text="Carregando produtos..." fullScreen />;
  }

  const title = titles[category || ""] || "Catálogo";
  return (
    <div className="flex flex-col gap-8 mx-auto w-full">
      <PageHeader
        title={title}
        actions={
          <Button variant="light" onClick={openFilterModal}>
            <Filter className="w-4 h-4" />
            Filtro
          </Button>
        }
      />

      {/* Apresentação dos produtos */}
      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 min-h-screen auto-rows-max">
          {products.map((element) => {
            // Mapear categoria para productType da URL
            const productTypeMap: Record<string, string> = {
              cars: "car",
              boats: "boat",
              aircrafts: "aircraft",
            };
            const productType = productTypeMap[category || "cars"];

            return (
              <div
                key={element.id}
                onClick={() =>
                  navigate(`/catalog/${productType}/${element.id}`)
                }
                className="cursor-pointer w-full"
              >
                <ProductCard {...element} />
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Filter}
          title="Nenhum produto encontrado."
          description="Tente ajustar os filtros de busca."
        />
      )}

      {/* Numeração das páginas*/}
      {pagination && pagination?.total_pages > 1 && (
        <div className="w-full h-full flex flex-row justify-center items-center gap-2">
          {pagination?.has_prev && (
            <>
              <button
                onClick={goFirstPage}
                className="p-1.5 rounded hover:bg-border-soft text-ink-soft transition-colors"
              >
                <ChevronsLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goPrevPage}
                className="p-1.5 rounded hover:bg-border-soft text-ink-soft transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </>
          )}
          <span>{page}</span>
          {pagination?.has_next && (
            <>
              <button
                onClick={goNextPage}
                className="p-1.5 rounded hover:bg-border-soft text-ink-soft transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={goLastPage}
                className="p-1.5 rounded hover:bg-border-soft text-ink-soft transition-colors"
              >
                <ChevronsRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Modal de filtros */}
      <Dialog open={filterModal} onOpenChange={setFilterModal}>
        <DialogContent open={filterModal} title="Filtrar catálogo">
          <form onSubmit={applyFilters} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="filter-marca"
                  className="block text-sm font-medium text-ink-soft mb-1"
                >
                  Marca
                </label>
                <Input
                  id="filter-marca"
                  value={filterDraft.marca ?? ""}
                  onChange={(e) => updateDraftText("marca", e.target.value)}
                  placeholder="Ex: Ferrari"
                />
              </div>
              <div>
                <label
                  htmlFor="filter-modelo"
                  className="block text-sm font-medium text-ink-soft mb-1"
                >
                  Modelo
                </label>
                <Input
                  id="filter-modelo"
                  value={filterDraft.modelo ?? ""}
                  onChange={(e) => updateDraftText("modelo", e.target.value)}
                  placeholder="Ex: 488 GTB"
                />
              </div>
              <div>
                <label
                  htmlFor="filter-ano-min"
                  className="block text-sm font-medium text-ink-soft mb-1"
                >
                  Ano mínimo
                </label>
                <Input
                  id="filter-ano-min"
                  type="number"
                  value={filterDraft.ano_min ?? ""}
                  onChange={(e) =>
                    updateDraftNumber("ano_min", e.target.value)
                  }
                  placeholder="Ex: 2018"
                />
              </div>
              <div>
                <label
                  htmlFor="filter-ano-max"
                  className="block text-sm font-medium text-ink-soft mb-1"
                >
                  Ano máximo
                </label>
                <Input
                  id="filter-ano-max"
                  type="number"
                  value={filterDraft.ano_max ?? ""}
                  onChange={(e) =>
                    updateDraftNumber("ano_max", e.target.value)
                  }
                  placeholder="Ex: 2024"
                />
              </div>
              <div>
                <label
                  htmlFor="filter-preco-min"
                  className="block text-sm font-medium text-ink-soft mb-1"
                >
                  Preço mínimo
                </label>
                <Input
                  id="filter-preco-min"
                  type="number"
                  value={filterDraft.preco_min ?? ""}
                  onChange={(e) =>
                    updateDraftNumber("preco_min", e.target.value)
                  }
                  placeholder="R$"
                />
              </div>
              <div>
                <label
                  htmlFor="filter-preco-max"
                  className="block text-sm font-medium text-ink-soft mb-1"
                >
                  Preço máximo
                </label>
                <Input
                  id="filter-preco-max"
                  type="number"
                  value={filterDraft.preco_max ?? ""}
                  onChange={(e) =>
                    updateDraftNumber("preco_max", e.target.value)
                  }
                  placeholder="R$"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="light" onClick={clearFilters}>
                Limpar filtros
              </Button>
              <Button type="submit">Aplicar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
