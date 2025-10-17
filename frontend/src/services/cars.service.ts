import api from "./api";

interface RawCar {
  id: number;
  marca: string;
  modelo: string;
  valor: number;
  estado: string;
  ano: number;
  cor: string;
  km: number;
  cambio: string;
  combustivel: string;
  tipo_categoria: string;
  descricao: string;
  specialist: {
    id: number;
    name: string;
    email: string;
    especialidade: string;
  };
  images: {
    id: number;
    image_url: string;
    is_primary: boolean;
  }[];
  created_at: string;
  updated_at: string;
}

interface Car {
  id: number;
  marca: string;
  modelo: string;
  descricao: string;
  valor: number;
  imageUrl: string;
}

// Get /cars
export async function getCars(): Promise<Car[]> {
  try {
    const response = await api.get("/cars");

    //Extrai o array da respota da api
    const rawCars: RawCar[] = response.data.data;

    //Realiza o processo de formatação do array com as informações necessárias
    const cars: Car[] = rawCars.map((rawCar) => {
      const primaryImage = rawCar.images.find(
        (imageUrl) => imageUrl.is_primary
      )?.image_url;

      return {
        id: rawCar.id,
        marca: rawCar.marca,
        modelo: rawCar.modelo,
        descricao: rawCar.descricao,
        imageUrl: primaryImage ?? "",
        valor: rawCar.valor,
      };
    });
    return cars;

  } catch (error) {
    console.log("Ocorreu um erro na busca dos carros: ", error);
    throw error;
  }
}
