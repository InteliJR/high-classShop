import api from "./api";

interface rawCar {
  id: string;
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
  };
  images: [
    {
      id: number;
      image_url: string;
      is_primary: boolean;
    }
  ];
  created_at: Date;
  updated_at: Date;
}

interface Car {
  id: string;
  marca: string;
  modelo: string;
  descricao: string;
  valor: number;
  imageUrl?: string;
}

// Get /cars
export async function getCars(): Promise<Car[]> {
  try {
    const response = await api.get("/cars");

    //Extrai o array produto
    const rawCars: rawCar[] = await response.data.data;

    //Realiza o processo de formatação do array com as informações necessárias
    const cars: Car[] = rawCars.map((rawCar) => {
      return {
        id: rawCar.id,
        marca: rawCar.marca,
        modelo: rawCar.modelo,
        descricao: rawCar.descricao,
        imageUrl: rawCar.images.find((imageUrl) => imageUrl.is_primary === true)
          ?.image_url,
        valor: rawCar.valor,
      };
    });

    console.log("Raw ", rawCars);

    console.log(cars);

    return cars;
  } catch (error) {
    console.log("Ocorreu algum erro: ", error);
    throw error;
  }
}
