import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getCars } from "../services/cars.service.ts";
import { getBoats } from "../services/boats.service.ts";
import { getAircrafts } from "../services/aircrafts.service.ts";
import type {
  FiltersAircraftsMeta,
  FiltersBoatsMeta,
  FiltersCarMeta,
  FiltersMeta,
  PaginationMeta,
  Product,
} from "../types/types.ts";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FunnelIcon,
  X,
} from "lucide-react";
import Button from "../components/ui/button.tsx";
import Modal from "../components/ui/Modal.tsx";
import ProductCard from "../components/ProductCard.tsx";
import Loading from "../components/ui/Loading.tsx";
import ProductDetails from "../components/product/ProductDetails.tsx";

// Mapeamento dos títulos de acordo com a rota passada
const titles: { [key: string]: string } = {
  cars: "Carros",
  boats: "Embarcações",
  aircrafts: "Aeronaves",
};

export default function Catalog() {
  // Coleta a categoria passada na rota
  const { category } = useParams();

  //Gerenciamento dos estados dos produtos, carregamento, e páginas
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [filter, setFilters] = useState<
    | FiltersMeta<FiltersCarMeta>
    | FiltersMeta<FiltersBoatsMeta>
    | FiltersMeta<FiltersAircraftsMeta>
    | null
  >(null);
  const [filterModal, setFilterModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDetails, setShowProductDetails] = useState(false);

  //Consumir a api
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        let data: Product[] = [];
        let pagination: PaginationMeta | null = null;
        switch (category) {
          case "cars":
            ({ cars: data, pagination } = await getCars(page));
            break;

          case "boats":
            ({ boats: data, pagination } = await getBoats(page));
            break;

          case "aircrafts":
            ({ aircrafts: data, pagination } = await getAircrafts(page));
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

  // Tela de carregamento
  if (loading) {
    return <Loading size="lg" text="Carregando produtos..." fullScreen />;
  }

  const title = titles[category || ""] || "Catálogo";
  return (
    <div className="flex flex-col gap-8 mx-auto w-full">
      <div className="flex justify-between">
        <h1 className="text-4xl">{title}</h1>
        <Button
          className="bg-secondary text-white rounded-sm px-4 py-1 flex justify-center items-center text-base gap-2"
          onClick={() => setFilterModal(true)}
        >
          <FunnelIcon fill="#FFFFFF" />
          Filtro
        </Button>
      </div>

      {/* Apresentação dos produtos */}
      {products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-10 min-h-screen">
          {products.map((element) => (
            <div
              key={element.id}
              onClick={() => {
                setSelectedProduct(element);
                setShowProductDetails(true);
              }}
            >
              <ProductCard {...element} />
            </div>
          ))}
        </div>
      ) : (
        <p className="min-h-screen">Nenhum produto encontrado.</p>
      )}

      {/* Numeração das páginas*/}
      {pagination && pagination?.total_pages > 1 && (
        <div className="w-full h-full flex flex-row justify-center items-center gap-2">
          {pagination?.has_prev && (
            <>
              <button onClick={goFirstPage}>
                <ChevronsLeft />
              </button>
              <button onClick={goPrevPage}>
                <ChevronLeft />
              </button>
            </>
          )}
          <span>{page}</span>
          {pagination?.has_next && (
            <>
              <button onClick={goNextPage}>
                <ChevronRight />
              </button>
              <button onClick={goLastPage}>
                <ChevronsRight />
              </button>
            </>
          )}
        </div>
      )}

      {/* Modal de filtros */}
      <Modal
        isOpen={filterModal}
        onClose={() => {
          setFilters(filter);
          setFilterModal(false);
        }}
      >
        Inserir informações
      </Modal>

      {/* Modal de Detalhes do Produto */}
      {showProductDetails && selectedProduct && (
        <div className="fixed inset-0 bg-white/10 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center rounded-t-lg">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedProduct.marca} {selectedProduct.modelo}
              </h2>
              <button
                onClick={() => setShowProductDetails(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <ProductDetails product={selectedProduct} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
