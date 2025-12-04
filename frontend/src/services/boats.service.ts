import type {
  FiltersBoatsMeta,
  FiltersMeta,
  PaginationMeta,
  Product,
  ResponseAPI,
} from "../types/types";
import api from "./api";

export interface RawBoat {
  id: number;
  marca: string;
  modelo: string;
  valor: number;
  estado: string;
  ano: number;
  fabricante?: string;
  tamanho?: string;
  estilo?: string;
  combustivel?: string;
  motor?: string;
  ano_motor?: number;
  tipo_embarcacao?: string;
  descricao_completa?: string;
  acessorios?: string;
  specialist_id?: string;
  specialist?: {
    id: number;
    name: string;
    email: string;
    especialidade: string;
  };
  images?: {
    id: number;
    image_url: string;
    is_primary: boolean;
  }[];
  created_at: string;
  updated_at: string;
}

export interface CreateBoatDto {
  marca: string;
  modelo: string;
  valor: number;
  estado: string;
  ano: number;
  fabricante?: string;
  tamanho?: string;
  estilo?: string;
  combustivel?: string;
  motor?: string;
  ano_motor?: number;
  tipo_embarcacao?: string;
  descricao_completa?: string;
  acessorios?: string;
  specialist_id?: string;
}

export interface UpdateBoatDto extends Partial<CreateBoatDto> {}

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
    const response = await api.get<ResponseAPI<RawBoat, FiltersBoatsMeta>>(
      "/boats",
      {
        params: { page, perPage, appliedFilters },
      }
    );

    //Extrai a respota da api
    const rawBoats: RawBoat[] = response.data.data;
    const pagination: PaginationMeta = response.data.meta.pagination;
    const filters: FiltersMeta<FiltersBoatsMeta> = response.data.meta.filters;

    //Realiza o processo de formatação do array com as informações necessárias
    const boats: Product[] = rawBoats.map((rawBoat) => {
      const primaryImage =
        rawBoat.images?.find((imageUrl) => imageUrl.is_primary === true)
          ?.image_url ?? "";

      return {
        id: rawBoat.id,
        marca: rawBoat.marca,
        modelo: rawBoat.modelo,
        descricao: rawBoat.descricao_completa || "",
        imageUrl: primaryImage ?? "",
        valor: rawBoat.valor,
        ano: rawBoat.ano,
        estado: rawBoat.estado,
      };
    });
    return { boats, pagination, filters };
  } catch (error) {
    console.error("Ocorreu um erro na busca dos barcos: ", error);
    throw error;
  }
}

// Get /boats/:id
export async function getBoatById(id: number): Promise<RawBoat> {
  try {
    const response = await api.get<RawBoat>(`/boats/${id}`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar lancha:", error);
    throw error;
  }
}

// Post /boats
export async function createBoat(data: CreateBoatDto): Promise<RawBoat> {
  try {
    const response = await api.post<RawBoat>("/boats", data);
    return response.data;
  } catch (error: any) {
    console.error("Erro ao criar lancha:", error);
    throw error;
  }
}

// Patch /boats/:id
export async function updateBoat(id: number, data: UpdateBoatDto): Promise<RawBoat> {
  try {
    const response = await api.patch<RawBoat>(`/boats/${id}`, data);
    return response.data;
  } catch (error) {
    console.error("Erro ao atualizar lancha:", error);
    throw error;
  }
}

// Delete /boats/:id
export async function deleteBoat(id: number): Promise<void> {
  try {
    await api.delete(`/boats/${id}`);
  } catch (error) {
    console.error("Erro ao deletar lancha:", error);
    throw error;
  }
}
