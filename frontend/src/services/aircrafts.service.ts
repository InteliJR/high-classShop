import type { FiltersAircraftsMeta, FiltersMeta, PaginationMeta, Product, ResponseAPI } from "../types/types";
import api from "./api";

export interface RawAircraft {
  id: number;
  marca: string;
  modelo: string;
  valor: number;
  estado: string;
  ano: number;
  categoria?: string;
  assentos?: number;
  tipo_aeronave?: string;
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

export interface ImageDto {
  data: string; // base64
  is_primary: boolean;
}

export interface CreateAircraftDto {
  marca: string;
  modelo: string;
  valor: number;
  estado: string;
  ano: number;
  categoria?: string;
  assentos?: number;
  tipo_aeronave?: string;
  descricao?: string;
  specialist_id?: string;
  images?: ImageDto[];
}

export interface UpdateAircraftDto extends Partial<CreateAircraftDto> {}

// Get /aircrafts
export async function getAircrafts(
  page = 1,
  perPage = 20,
  appliedFilters: Partial<FiltersAircraftsMeta> = {}
): Promise<{ aircrafts: Product[], pagination: PaginationMeta, filters: FiltersMeta<FiltersAircraftsMeta>}> {
  try {
    const response = await api.get<ResponseAPI<RawAircraft, FiltersAircraftsMeta>>(
      "/aircrafts",
      {
        params: { page, perPage, ...appliedFilters },
      }
    );

    //Extrai a respota da api
    const rawAircrafts: RawAircraft[] = response.data.data;
    const pagination: PaginationMeta = response.data.meta.pagination;
    const filters: FiltersMeta<FiltersAircraftsMeta> = response.data.meta.filters;

    //Realiza o processo de formatação do array com as informações necessárias
    const aircrafts: Product[] = rawAircrafts.map((rawAircraft) => {
      const primaryImage = rawAircraft.images?.find(
          (imageUrl) => imageUrl.is_primary === true
        )?.image_url

      return {
        id: rawAircraft.id,
        marca: rawAircraft.marca,
        modelo: rawAircraft.modelo,
        descricao: rawAircraft.descricao || "",
        imageUrl: primaryImage ?? "",
        images: rawAircraft.images,
        valor: rawAircraft.valor,
        ano: rawAircraft.ano,
        estado: rawAircraft.estado,
        specialist_id: rawAircraft.specialist_id,
        // Campos específicos de Aeronaves
        categoria: rawAircraft.categoria,
        assentos: rawAircraft.assentos,
        tipo_aeronave: rawAircraft.tipo_aeronave,
      };
    });
    return {aircrafts, pagination, filters};

  } catch (error) {
    console.error("Ocorreu um erro na busca das aeronaves: ", error);
    throw error;
  }
}

// Get /aircrafts/:id
export async function getAircraftById(id: number): Promise<RawAircraft> {
  try {
    const response = await api.get<RawAircraft>(`/aircrafts/${id}`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar aeronave:", error);
    throw error;
  }
}

// Post /aircrafts
export async function createAircraft(data: CreateAircraftDto): Promise<RawAircraft> {
  try {
    const response = await api.post<RawAircraft>("/aircrafts", data);
    return response.data;
  } catch (error: any) {
    console.error("Erro ao criar aeronave:", error);
    throw error;
  }
}

// Patch /aircrafts/:id
export async function updateAircraft(id: number, data: UpdateAircraftDto): Promise<RawAircraft> {
  try {
    const response = await api.patch<RawAircraft>(`/aircrafts/${id}`, data);
    return response.data;
  } catch (error) {
    console.error("Erro ao atualizar aeronave:", error);
    throw error;
  }
}

// Delete /aircrafts/:id
export async function deleteAircraft(id: number): Promise<void> {
  try {
    await api.delete(`/aircrafts/${id}`);
  } catch (error) {
    console.error("Erro ao deletar aeronave:", error);
    throw error;
  }
}

// CSV Import Types
export interface CsvErrorRow {
  row: number;
  reason: string;
  fields?: Record<string, any>;
}

export interface CsvImportResponse {
  success: boolean;
  message: string;
  insertedCount: number;
  errorCount: number;
  errorRows: CsvErrorRow[];
  insertedIds?: number[];
}

export interface CsvTemplateResponse {
  template: string;
  columns: {
    required: string[];
    optional: string[];
  };
  instructions: Record<string, string>;
  example: Record<string, any>;
}

// Get /aircrafts/csv-template
export async function getAircraftsCsvTemplate(): Promise<CsvTemplateResponse> {
  try {
    const response = await api.get<CsvTemplateResponse>("/aircrafts/csv-template");
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar template CSV:", error);
    throw error;
  }
}

// Post /aircrafts/import-csv
export async function importAircraftsCsv(file: File): Promise<CsvImportResponse> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await api.post<CsvImportResponse>("/aircrafts/import-csv", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (error: any) {
    console.error("Erro ao importar CSV:", error);
    if (error.response?.data) {
      throw error.response.data;
    }
    throw error;
  }
}
