import type {
  FiltersCarMeta,
  FiltersMeta,
  PaginationMeta,
  Product,
  ResponseAPI,
} from "../types/types";
import api from "./api";

export interface RawCar {
  id: number;
  marca: string;
  modelo: string;
  valor: number;
  estado: string;
  ano: number;
  cor?: string;
  km?: number;
  cambio?: string;
  combustivel?: string;
  tipo_categoria?: string;
  descricao?: string;
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

export interface CreateCarDto {
  marca: string;
  modelo: string;
  valor: number;
  estado: string;
  ano: number;
  cor?: string;
  km?: number;
  cambio?: string;
  combustivel?: string;
  tipo_categoria?: string;
  descricao?: string;
  specialist_id?: string;
}

export interface UpdateCarDto extends Partial<CreateCarDto> {}

// Get /cars
export async function getCars(
  page = 1,
  perPage = 20,
  appliedFilters = {}
): Promise<{
  cars: Product[];
  pagination: PaginationMeta;
  filters: FiltersMeta<FiltersCarMeta>;
}> {
  try {
    const response = await api.get<ResponseAPI<RawCar, FiltersCarMeta>>(
      "/cars",
      {
        params: { page, perPage, ...appliedFilters },
      }
    );

    //Extrai a respota da api
    const rawCars: RawCar[] = response.data.data;
    const pagination: PaginationMeta = response.data.meta.pagination;
    const filters: FiltersMeta<FiltersCarMeta> = response.data.meta.filters;

    //Realiza o processo de formatação do array com as informações necessárias
    const cars: Product[] = rawCars.map((rawCar) => {
      const primaryImage =
        rawCar.images?.find((imageUrl) => imageUrl.is_primary)?.image_url ?? "";

      return {
        id: rawCar.id,
        marca: rawCar.marca,
        modelo: rawCar.modelo,
        descricao: rawCar.descricao,
        imageUrl: primaryImage ?? "",
        valor: rawCar.valor,
      };
    });
    return { cars, pagination, filters };
  } catch (error) {
    console.log("Ocorreu um erro na busca dos carros: ", error);
    throw error;
  }
}

// Get /cars/:id
export async function getCarById(id: number): Promise<RawCar> {
  try {
    const response = await api.get<RawCar>(`/cars/${id}`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar carro:", error);
    throw error;
  }
}

// Post /cars
export async function createCar(data: CreateCarDto): Promise<RawCar> {
  try {
    const response = await api.post<RawCar>("/cars", data);
    return response.data;
  } catch (error: any) {
    console.error("Erro ao criar carro:", error);
    throw error;
  }
}

// Patch /cars/:id
export async function updateCar(id: number, data: UpdateCarDto): Promise<RawCar> {
  try {
    const response = await api.patch<RawCar>(`/cars/${id}`, data);
    return response.data;
  } catch (error) {
    console.error("Erro ao atualizar carro:", error);
    throw error;
  }
}

// Delete /cars/:id
export async function deleteCar(id: number): Promise<void> {
  try {
    await api.delete(`/cars/${id}`);
  } catch (error) {
    console.error("Erro ao deletar carro:", error);
    throw error;
  }
}
