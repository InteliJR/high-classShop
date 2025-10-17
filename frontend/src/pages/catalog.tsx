import { useEffect, useState } from "react";
import ProductCard from "../components/ProductCard.tsx";
import { getCars } from "../services/cars.service.ts";

interface Car {
  id: string;
  marca: string;
  modelo: string;
  descricao: string;
  valor: number;
  imageUrl?: string;
}

const title = "Carros";

export default function Catalog() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);

  //Consumo da api
  useEffect(() => {
    getCars()
      .then((carsCleaned) => {
        setCars(carsCleaned);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen w-screen text-6xl">
        <h1>Carregando...</h1>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 mx-auto w-full">
      <div className="flex justify-between">
        <h1 className="text-4xl">{title}</h1>
        <button className="bg-secondary text-white rounded-sm px-4 py-1 flex justify-center items-center text-base">
          Filtro
        </button>
      </div>

      {cars.length > 0 ? (
        <div className="grid grid-cols-4 gap-x-4 gap-y-10">
          {cars.map((element) => (
            <ProductCard key={element.id} {...element} />
          ))}
        </div>
      ) : (
        <p>Nenhum carro encontrado.</p>
      )}
    </div>
  );
}
