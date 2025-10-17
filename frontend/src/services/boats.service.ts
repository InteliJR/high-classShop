import api from "./api";

interface rawBoats {
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

interface Boats {
  id: string;
  marca: string;
  modelo: string;
  descricao: string;
  valor: number;
  imageUrl?: string;
}

// Get /boats
export async function getBoats(): Promise<Boats[]> {
  try {
    const response = await api.get("/boats");

    //Extrai o array produto
    const rawBoats: rawBoats[] = await response.data.data;

    //Realiza o processo de formatação do array com as informações necessárias
    const boats: Boats[] = rawBoats.map((rawBoats) => {
      return {
        id: rawBoats.id,
        marca: rawBoats.marca,
        modelo: rawBoats.modelo,
        descricao: rawBoats.descricao,
        imageUrl: rawBoats.images.find((imageUrl) => imageUrl.is_primary === true)
          ?.image_url,
        valor: rawBoats.valor,
      };
    });

    console.log("Raw ", rawBoats);

    console.log(boats);

    return boats;
  } catch (error) {
    console.log("Ocorreu algum erro: ", error);
    throw error;
  }
}
