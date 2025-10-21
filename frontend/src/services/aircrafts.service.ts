import type { PaginationMeta, Product } from "../types/types";
import api from "./api";

interface RawAircrafts {
  id: number;
  marca: string;
  modelo: string;
  valor: number;
  estado: string;
  ano: number;
  fabricante: string;
  tamanho: string;
  estilo: string;
  combustivel: string;
  motor: string;
  ano_motor: string;
  tipo_embarcacao: string;
  descricao: string;
  acessorios: string;
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
  created_at: number;
  updated_at: number;
}

// Get /aircrafts
export async function getAircrafts(page = 1, perPage = 20): Promise<{ aircrafts: Product[], pagination: PaginationMeta}> {
  try {
    const response = await api.get("/aircrafts", {
      params: {page, perPage},
    });

    //Extrai a respota da api
    const rawAircrafts: RawAircrafts[] = response.data.data;
    const pagination: PaginationMeta = response.data.meta.pagination;

    //Realiza o processo de formatação do array com as informações necessárias
    const aircrafts: Product[] = rawAircrafts.map((rawAircraft) => {
      const primaryImage = rawAircraft.images.find(
          (imageUrl) => imageUrl.is_primary === true
        )?.image_url

      return {
        id: rawAircraft.id,
        marca: rawAircraft.marca,
        modelo: rawAircraft.modelo,
        descricao: rawAircraft.descricao,
        imageUrl: primaryImage ?? "",
        valor: rawAircraft.valor,
      };
    });
    return {aircrafts, pagination};

  } catch (error) {
    console.error("Ocorreu um erro na busca das aeronaves: ", error);
    throw error;
  }
}
