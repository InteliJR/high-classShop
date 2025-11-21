import type {
  FiltersBoatsMeta,
  FiltersMeta,
  PaginationMeta,
  Product,
  ResponseAPI,
} from "../types/types";
import api from "./api";

interface RawBoats {
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
  created_at: string;
  updated_at: string;
}

// Get /boats
export async function getBoats(
  page = 1,
  perPage = 20,
  appliedFilters = []
): Promise<{
  boats: Product[];
  pagination: PaginationMeta;
  filters: FiltersMeta<FiltersBoatsMeta>;
}> {
  try {
    const response = await api.get<ResponseAPI<RawBoats, FiltersBoatsMeta>>(
      "/boats",
      {
        params: { page, perPage, appliedFilters },
      }
    );

    //Extrai a respota da api
    const rawBoats: RawBoats[] = response.data.data;
    const pagination: PaginationMeta = response.data.meta.pagination;
    const filters: FiltersMeta<FiltersBoatsMeta> = response.data.meta.filters;

    //Realiza o processo de formatação do array com as informações necessárias
    const boats: Product[] = rawBoats.map((rawBoats) => {
      const primaryImage =
        rawBoats.images?.find((imageUrl) => imageUrl.is_primary === true)
          ?.image_url ?? "";

      return {
        id: rawBoats.id,
        marca: rawBoats.marca,
        modelo: rawBoats.modelo,
        descricao: rawBoats.descricao,
        imageUrl: primaryImage ?? "",
        valor: rawBoats.valor,
      };
    });
    return { boats, pagination, filters };
  } catch (error) {
    console.error("Ocorreu um erro na busca dos barcos: ", error);
    throw error;
  }
}
