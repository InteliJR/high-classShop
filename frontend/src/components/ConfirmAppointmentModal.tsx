import { useState } from "react";
import { X, CheckCircle, AlertCircle } from "lucide-react";
import { useCreateAppointment } from "../hooks/useCreateAppointment";

interface ConfirmAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  specialistId: string;
  clientId: string;
  productType: "CAR" | "BOAT" | "AIRCRAFT";
  productId: string | number;
  specialistName?: string;
}

export default function ConfirmAppointmentModal({
  isOpen,
  onClose,
  specialistId,
  clientId,
  productType,
  productId,
  specialistName,
}: ConfirmAppointmentModalProps) {
  const [notes, setNotes] = useState("");
  const [appointmentDatetime, setAppointmentDatetime] = useState("");
  const { createAppointment, loading, error, success, resetState } =
    useCreateAppointment();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Converter datetime-local para ISO 8601 UTC
    const datetimeValue = appointmentDatetime
      ? new Date(appointmentDatetime).toISOString()
      : undefined;

    const result = await createAppointment({
      specialist_id: specialistId,
      client_id: clientId,
      product_type: productType,
      product_id: productId,
      appointment_datetime: datetimeValue,
      notes: notes || undefined,
    });

    if (result) {
      setTimeout(() => {
        resetState();
        onClose();
      }, 2000);
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Confirmar Agendamento
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            /* Success State */
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="text-green-600" size={48} />
              </div>
              <h3 className="text-lg font-semibold text-green-600">
                Agendamento Confirmado!
              </h3>
              <p className="text-sm text-gray-600">
                Seu agendamento com{" "}
                <strong>{specialistName || "o especialista"}</strong> foi criado
                com sucesso. Você receberá uma confirmação por e-mail em breve.
              </p>
              <button
                onClick={handleClose}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          ) : (
            /* Form State */
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="text-red-600 shrink-0" size={20} />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Especialista
                </label>
                <input
                  type="text"
                  value={specialistName || "Carregando..."}
                  disabled
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 cursor-not-allowed"
                />
              </div>

              <div>
                <label
                  htmlFor="date"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Data e Hora do Agendamento (Opcional)
                </label>
                <input
                  id="date"
                  type="datetime-local"
                  value={appointmentDatetime}
                  onChange={(e) => setAppointmentDatetime(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Horário será convertido para UTC e confirmado
                </p>
              </div>

              <div>
                <label
                  htmlFor="notes"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Observações (Opcional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading}
                  placeholder="Adicione qualquer informação relevante para o agendamento..."
                  maxLength={500}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">{notes.length}/500</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processando...
                    </>
                  ) : (
                    "Confirmar"
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Ao confirmar, você concorda que agendou uma reunião com este
                especialista.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
