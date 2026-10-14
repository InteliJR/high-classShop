import { useEffect, useRef, useState } from "react";
import { checkExistingAppointment } from "../services/appointments.service";
import type { ExistingAppointmentCheck } from "../services/appointments.service";
import { useAuth } from "../store/authStateManager";

interface UseCheckAppointmentResult {
  existingAppointment: ExistingAppointmentCheck | null;
  isLoading: boolean;
  error: string | null;
}

/** Debounced own-request check; null means unchecked/failed, exists:false means a successful absence. */
export function useCheckAppointment(
  specialistId: string | undefined,
  productType: "CAR" | "BOAT" | "AIRCRAFT" | undefined,
  productId: string | undefined,
): UseCheckAppointmentResult {
  const userId = useAuth((state) => state.user?.id);
  const role = useAuth((state) => state.user?.role);
  const [existingAppointment, setExistingAppointment] = useState<ExistingAppointmentCheck | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestToken = useRef(0);

  useEffect(() => {
    const token = ++requestToken.current;
    setExistingAppointment(null);
    setError(null);
    if (!userId || role !== "CUSTOMER" || !specialistId || !productType || !productId) {
      setIsLoading(false);
      return () => { requestToken.current = token + 1; };
    }
    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result = await checkExistingAppointment(specialistId, productType, productId);
        if (token === requestToken.current) setExistingAppointment(result);
      } catch (error) {
        if (token === requestToken.current) {
          setExistingAppointment(null);
          setError(error instanceof Error ? error.message : "Erro ao verificar agendamentos");
        }
      } finally {
        if (token === requestToken.current) setIsLoading(false);
      }
    }, 500);
    return () => {
      requestToken.current = token + 1;
      clearTimeout(timer);
    };
  }, [userId, role, specialistId, productType, productId]);

  return { existingAppointment, isLoading, error };
}
