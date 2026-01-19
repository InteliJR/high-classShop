import api from "./api";

export interface Appointment {
  id: string;
  client_id: string;
  specialist_id: string;
  product_type: "CAR" | "BOAT" | "AIRCRAFT";
  product_id: number;
  appointment_datetime?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Verifica se existe um agendamento entre cliente e especialista para um produto específico
 * @param clientId - ID do cliente
 * @param specialistId - ID do especialista
 * @param productType - Tipo do produto (CAR, BOAT, AIRCRAFT)
 * @param productId - ID do produto
 * @returns true se existe agendamento ativo, false caso contrário
 */
export async function checkExistingAppointment(
  clientId: string,
  specialistId: string,
  productType: "CAR" | "BOAT" | "AIRCRAFT",
  productId: number
): Promise<Appointment | null> {
  try {
    const response = await api.get<ApiResponse<Appointment | null>>(
      `/appointments/check`,
      {
        withCredentials: true,
        params: {
          client_id: clientId,
          specialist_id: specialistId,
          product_type: productType,
          product_id: productId,
        },
      }
    );
    return response.data.data;
  } catch (error) {
    console.error("Erro ao verificar agendamento:", error);
    return null;
  }
}

/**
 * Lista agendamentos do usuário autenticado
 * @param page - Número da página
 * @param limit - Itens por página
 * @returns Lista de agendamentos com paginação
 */
export async function getMyAppointments(
  page: number = 1,
  limit: number = 20
): Promise<Appointment[]> {
  try {
    const response = await api.get<ApiResponse<Appointment[]>>(
      "/appointments",
      {
        withCredentials: true,
        params: { page, limit },
      }
    );
    return response.data.data;
  } catch (error) {
    console.error("Erro ao listar agendamentos:", error);
    return [];
  }
}
