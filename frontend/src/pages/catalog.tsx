import { useEffect, useState } from "react";
import ProductCard from "../components/ProductCard.tsx";
import { useParams } from "react-router-dom";
import { getCars } from "../services/cars.service.ts";
import { getBoats } from "../services/boats.service.ts";
import { getAircrafts } from "../services/aircrafts.service.ts";

interface Product {
  id: number;
  marca: string;
  modelo: string;
  descricao: string;
  valor: number;
  imageUrl: string;
}

// Mapeamento dos títulos de acordo com a rota passada
const titles: { [key: string]: string } = {
  cars: "Carros",
  boats: "Barcos",
  aircrafts: "Aeronaves",
};

export default function Catalog() {
  // Coleta a categoria passada na rota
  const { category } = useParams();

  //Gerenciamento dos estados dos produtos e carregamento
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  //Consumir a api
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        let data: Product[] = [];
        switch (category) {
          case "cars":
            data = await getCars();
            break;

          case "boats":
            data = await getBoats();
            break;

          case "aircrafts":
            data = await getAircrafts();
            break;

          default:
            console.warn("Categoria desconhecida", category);
        }

        setProducts(data);

      } catch (error) {
        console.error("Ocorreu um erro: ", error);

      } finally {
        setLoading(false);
      }
    };
    if (category) {
      fetchData();
    }
  }, [category]); //Repete cada vez que a categoria for trocada

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

      {products.length > 0 ? (
        <div className="grid grid-cols-4 gap-x-4 gap-y-10">
          {products.map((element) => (
            <ProductCard key={element.id} {...element} />
          ))}
        </div>
      ) : (
        <p>Nenhum produto encontrado.</p>
      )}
    </div>
  );
}
