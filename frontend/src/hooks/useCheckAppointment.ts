import { useEffect, useState, useRef } from "react";
import { checkExistingAppointment } from "../services/appointments.service";
import type { Appointment } from "../services/appointments.service";

interface UseCheckAppointmentResult {
  existingAppointment: Appointment | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook para verificar se já existe agendamento entre cliente e especialista para um produto
 * Usado para impedir agendamentos duplicados
 * 
 * **Evita race conditions com debounce de 500ms**
 *
 * @param clientId - ID do cliente autenticado
 * @param specialistId - ID do especialista
 * @param productType - Tipo de produto (CAR, BOAT, AIRCRAFT)
 * @param productId - ID do produto
 * @returns { existingAppointment, isLoading, error }
 *
 * Exemplo:
 * const { existingAppointment, isLoading } = useCheckAppointment(
 *   userId,
 *   specialist.id,
 *   "CAR",
 *   product.id
 * );
 *
 * if (isLoading) return <div>Verificando...</div>;
 * if (existingAppointment) return <div>Você já tem agendamento marcado</div>;
 */
export function useCheckAppointment(
  clientId: string | undefined,
  specialistId: string | undefined,
  productType: "CAR" | "BOAT" | "AIRCRAFT" | undefined,
  productId: number | undefined
): UseCheckAppointmentResult {
  const [existingAppointment, setExistingAppointment] =
    useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Limpa timer anterior se existir
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Não faz nada se faltam parâmetros
    if (!clientId || !specialistId || !productType || !productId) {
      setExistingAppointment(null);
      setIsLoading(false);
      return;
    }

    // Debounce de 500ms para evitar múltiplas requisições
    debounceTimerRef.current = setTimeout(() => {
      const checkAppointment = async () => {
        setIsLoading(true);
        setError(null);

        try {
          console.log(
            `[useCheckAppointment] Verificando: cliente=${clientId}, especialista=${specialistId}, tipo=${productType}, produto=${productId}`
          );

          const appointment = await checkExistingAppointment(
            clientId,
            specialistId,
            productType,
            productId
          );

          console.log(
            `[useCheckAppointment] Resultado:`,
            appointment ? `Agendamento encontrado (${appointment.id})` : "Nenhum agendamento"
          );

          setExistingAppointment(appointment);
        } catch (err) {
          console.error("Erro ao verificar agendamento:", err);
          setError("Erro ao verificar agendamentos");
          setExistingAppointment(null);
        } finally {
          setIsLoading(false);
        }
      };

      checkAppointment();
    }, 500);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [clientId, specialistId, productType, productId]);

  return {
    existingAppointment,
    isLoading,
    error,
  };
}
