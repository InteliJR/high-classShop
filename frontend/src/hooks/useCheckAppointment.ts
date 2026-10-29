import { useEffect, useRef, useState } from "react";
import { checkExistingAppointment } from "../services/appointments.service";
import type { ExistingAppointmentCheck } from "../services/appointments.service";
import { useAuth } from "../store/authStateManager";

interface UseCheckAppointmentResult {
  existingAppointment: ExistingAppointmentCheck | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Debounced own-request check; null means unchecked/failed, exists:false means a successful absence.
 * Refetches silently when the tab becomes visible again, keeping the last result meanwhile.
 */
export function useCheckAppointment(
  specialistId: string | undefined,
  productType: "CAR" | "BOAT" | "AIRCRAFT" | undefined,
  productId: string | undefined,
): UseCheckAppointmentResult {
  const userId = useAuth((state) => state.user?.id);
  const role = useAuth((state) => state.user?.role);
  const scopeKey = JSON.stringify([userId, role, specialistId, productType, productId]);
  const isEligible = Boolean(userId && role === "CUSTOMER" && specialistId && productType && productId);
  const [state, setState] = useState<UseCheckAppointmentResult & { scopeKey: string }>(() => ({
    scopeKey, existingAppointment: null, isLoading: isEligible, error: null,
  }));
  const requestToken = useRef(0);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!isEligible) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") setRefreshTick((tick) => tick + 1);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [isEligible]);

  useEffect(() => {
    const token = ++requestToken.current;
    if (!userId || role !== "CUSTOMER" || !specialistId || !productType || !productId) {
      setState({ scopeKey, existingAppointment: null, isLoading: false, error: null });
      return () => { requestToken.current = token + 1; };
    }
    // A focus refresh keeps the current result instead of flashing the loading state.
    setState((previous) =>
      previous.scopeKey === scopeKey && previous.existingAppointment
        ? previous
        : { scopeKey, existingAppointment: null, isLoading: true, error: null });
    const timer = setTimeout(async () => {
      try {
        const result = await checkExistingAppointment(specialistId, productType, productId);
        if (token === requestToken.current) {
          setState({ scopeKey, existingAppointment: result, isLoading: false, error: null });
        }
      } catch (error) {
        if (token === requestToken.current) {
          setState((previous) =>
            previous.scopeKey === scopeKey && previous.existingAppointment
              ? previous
              : {
                  scopeKey, existingAppointment: null, isLoading: false,
                  error: error instanceof Error ? error.message : "Erro ao verificar agendamentos",
                });
        }
      }
    }, 500);
    return () => {
      requestToken.current = token + 1;
      clearTimeout(timer);
    };
  }, [userId, role, specialistId, productType, productId, scopeKey, refreshTick]);

  // Scope changes must be safe during render, before passive effects reset state.
  if (!isEligible || state.scopeKey !== scopeKey) {
    return { existingAppointment: null, isLoading: isEligible, error: null };
  }
  return { existingAppointment: state.existingAppointment, isLoading: state.isLoading, error: state.error };
}
