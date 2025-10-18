import { useEffect, useState } from "react";
import ProductCard from "../components/ProductCard.tsx";
import { useParams } from "react-router-dom";
import { getCars } from "../services/cars.service.ts";
import { getBoats } from "../services/boats.service.ts";
import { getAircrafts } from "../services/aircrafts.service.ts";
import type { PaginationMeta, Product } from "../types/types.ts";

// Mapeamento dos títulos de acordo com a rota passada
const titles: { [key: string]: string } = {
  cars: "Carros",
  boats: "Barcos",
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
  }, [category, page]); //Repete cada vez que a categoria ou página for trocada

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
    return (
      <div className="flex justify-center items-center h-full w-full text-6xl">
        <h1>Carregando...</h1>
      </div>
    );
  }

  const title = titles[category || ""] || "Catálogo";
  return (
    <div className="flex flex-col gap-8 mx-auto w-full">
      <div className="flex justify-between">
        <h1 className="text-4xl">{title}</h1>
        <button className="bg-secondary text-white rounded-sm px-4 py-1 flex justify-center items-center text-base">
          Filtro
        </button>
      </div>

      {/* Apresentação dos produtos */}
      {products.length > 0 ? (
        <div className="grid grid-cols-4 gap-x-4 gap-y-10 min-h-screen">
          {products.map((element) => (
            <ProductCard key={element.id} {...element} />
          ))}
        </div>
      ) : (
        <p className="min-h-screen">Nenhum produto encontrado.</p>
      )}

      {/* Numeração das páginas*/}
      {pagination && pagination?.total_pages > 1 && (
        <div className="border w-full h-full flex flex-row justify-center items-center gap-2">
          {pagination?.has_prev && (
            <>
              <button onClick={goFirstPage}></button>
              <button onClick={goPrevPage}></button>
            </>
          )}
          <span>{page}</span>
          {pagination?.has_next && (
            <>
              <button onClick={goNextPage}></button>
              <button onClick={goLastPage}></button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
