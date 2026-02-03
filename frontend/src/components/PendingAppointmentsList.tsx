import { useState, useEffect } from "react";
import { Clock, Check, X, Calendar, User, Package } from "lucide-react";
import {
  getPendingAppointments,
  confirmPendingAppointment,
  cancelPendingAppointment,
  type Appointment,
} from "../services/appointments.service";

interface PendingAppointmentsListProps {
  specialistId: string;
  onRefresh?: () => void;
}

/**
 * Component to display and manage pending appointments for specialists
 * Shows appointments where clients have clicked "schedule" but not yet confirmed
 */
export default function PendingAppointmentsList({
  specialistId,
  onRefresh,
}: PendingAppointmentsListProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Load pending appointments
  const loadAppointments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getPendingAppointments();
      setAppointments(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar agendamentos pendentes"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (specialistId) {
      loadAppointments();
    }
  }, [specialistId]);

  // Confirm pending appointment
  const handleConfirm = async (appointmentId: string) => {
    try {
      setProcessingId(appointmentId);
      await confirmPendingAppointment(appointmentId);
      // Remove from list
      setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
      onRefresh?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao confirmar agendamento"
      );
    } finally {
      setProcessingId(null);
    }
  };

  // Cancel pending appointment
  const handleCancel = async (appointmentId: string) => {
    try {
      setProcessingId(appointmentId);
      await cancelPendingAppointment(appointmentId);
      // Remove from list
      setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao cancelar agendamento"
      );
    } finally {
      setProcessingId(null);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get product type label
  const getProductTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CAR: "Carro",
      BOAT: "Barco",
      AIRCRAFT: "Aeronave",
    };
    return labels[type] || type;
  };

  // Don't render if no pending appointments
  if (!isLoading && appointments.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 bg-amber-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Clock size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
              Solicitações Pendentes
            </h3>
            <p className="text-xs sm:text-sm text-gray-600">
              Clientes aguardando confirmação de agendamento
            </p>
          </div>
          {!isLoading && appointments.length > 0 && (
            <span className="ml-auto px-2.5 py-0.5 bg-amber-200 text-amber-800 text-sm font-medium rounded-full">
              {appointments.length}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="divide-y divide-gray-100">
        {/* Loading */}
        {isLoading && (
          <div className="p-6 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"></div>
            <p className="mt-2 text-sm text-gray-600">Carregando...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 text-sm text-red-700">{error}</div>
        )}

        {/* Appointments List */}
        {!isLoading &&
          appointments.map((appointment) => (
            <div
              key={appointment.id}
              className="p-4 sm:p-5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Client Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <User size={16} className="text-gray-400 flex-shrink-0" />
                    <span className="font-medium text-gray-900 truncate">
                      {appointment.client?.name || "Cliente"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Package size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="truncate">
                      {getProductTypeLabel(appointment.product_type)} -{" "}
                      {appointment.product?.marca} {appointment.product?.modelo}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    <Calendar size={12} className="flex-shrink-0" />
                    <span>
                      Solicitado em{" "}
                      {appointment.user_clicked_at
                        ? formatDate(appointment.user_clicked_at)
                        : formatDate(appointment.created_at)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 sm:flex-shrink-0">
                  <button
                    onClick={() => handleCancel(appointment.id)}
                    disabled={processingId === appointment.id}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    {processingId === appointment.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
                    ) : (
                      <>
                        <X size={16} />
                        <span className="hidden sm:inline">Recusar</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleConfirm(appointment.id)}
                    disabled={processingId === appointment.id}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {processingId === appointment.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Check size={16} />
                        <span className="hidden sm:inline">Confirmar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
