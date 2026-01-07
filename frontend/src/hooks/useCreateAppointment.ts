import { useState } from "react";
import api from "../services/api";

export interface AppointmentData {
  specialist_id: string;
  client_id: string;
  product_type: "CAR" | "BOAT" | "AIRCRAFT";
  product_id: string | number;
  appointment_datetime?: string;
  notes?: string;
}

export interface AppointmentResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    scheduled_date?: string;
    client_id: string;
    specialist_id: string;
    status: string;
  };
}

/**
 * Hook para criar um agendamento via Calendly
 */
export const useCreateAppointment = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const createAppointment = async (data: AppointmentData) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await api.post<AppointmentResponse>(
        "/appointments",
        {
          specialist_id: data.specialist_id,
          client_id: data.client_id,
          product_type: data.product_type,
          product_id: data.product_id,
          appointment_datetime: data.appointment_datetime,
          notes: data.notes,
        },
        {
          withCredentials: true,
        }
      );

      if (response.data.success) {
        setSuccess(true);
        return response.data.data;
      } else {
        setError(response.data.message || "Erro ao criar agendamento");
        return null;
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Erro ao criar agendamento";
      setError(errorMessage);
      console.error("Erro ao criar agendamento:", err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setError(null);
    setSuccess(false);
    setLoading(false);
  };

  return {
    createAppointment,
    loading,
    error,
    success,
    resetState,
  };
};
