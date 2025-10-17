import api from "./api";

interface rawAircrafts {
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

interface Aircrafts {
  id: string;
  marca: string;
  modelo: string;
  descricao: string;
  valor: number;
  imageUrl?: string;
}

// Get /boats
export async function getAircrafts(): Promise<Aircrafts[]> {
  try {
    const response = await api.get("/boats");

    //Extrai o array produto
    const rawAircrafts: rawAircrafts[] = await response.data.data;

    //Realiza o processo de formatação do array com as informações necessárias
    const boats: Aircrafts[] = rawAircrafts.map((rawAircrafts) => {
      return {
        id: rawAircrafts.id,
        marca: rawAircrafts.marca,
        modelo: rawAircrafts.modelo,
        descricao: rawAircrafts.descricao,
        imageUrl: rawAircrafts.images.find((imageUrl) => imageUrl.is_primary === true)
          ?.image_url,
        valor: rawAircrafts.valor,
      };
    });

    console.log("Raw ", rawAircrafts);

    console.log(boats);

    return boats;
  } catch (error) {
    console.log("Ocorreu algum erro: ", error);
    throw error;
  }
}
