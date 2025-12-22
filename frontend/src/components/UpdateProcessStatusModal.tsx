import { useState } from "react";
import { X } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import type { Process } from "../services/processes.service";
import { updateProcessStatus } from "../services/processes.service";

interface UpdateProcessStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  process: Process;
}

interface UpdateProcessFormData {
  status: Process["status"];
  notes?: string;
}

/**
 * Modal for updating process status and notes
 */
export default function UpdateProcessStatusModal({
  isOpen,
  onClose,
  onSuccess,
  process,
}: UpdateProcessStatusModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateProcessFormData>({
    defaultValues: {
      status: process.status,
      notes: process.notes || "",
    },
  });

  const statusOptions: Array<{
    value: Process["status"];
    label: string;
  }> = [
    { value: "SCHEDULING", label: "Agendamento" },
    { value: "NEGOTIATION", label: "Negociação" },
    { value: "DOCUMENTATION", label: "Documentação" },
    { value: "COMPLETED", label: "Concluído" },
  ];

  const onSubmit = async (data: UpdateProcessFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);

      await updateProcessStatus(process.id, data.status, data.notes);

      reset();
      onClose();
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao atualizar processo"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm md:max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">
            Alterar Status do Processo
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded transition shrink-0"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="p-4 sm:p-6 space-y-4 sm:space-y-5"
        >
          {/* Error Alert */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs sm:text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Current Info */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600 font-medium">Cliente</p>
            <p className="text-sm font-semibold text-gray-900">
              {process.client?.name || process.client_id}
            </p>
          </div>

          {/* Status Select */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Novo Status <span className="text-red-500">*</span>
            </label>
            <Controller
              name="status"
              control={control}
              rules={{ required: "Status é obrigatório" }}
              render={({ field }) => (
                <select
                  {...field}
                  className={`w-full px-3 py-2 sm:py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition ${
                    errors.status
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                  }`}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.status && (
              <p className="text-xs sm:text-sm text-red-600 mt-1">
                {errors.status.message}
              </p>
            )}
          </div>

          {/* Notes Textarea */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Anotações
            </label>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <textarea
                  {...field}
                  placeholder="Adicione observações sobre este processo..."
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition resize-none"
                />
              )}
            />
            <p className="text-xs text-gray-500 mt-1">
              Digite suas anotações sobre o processo (máx 500 caracteres)
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isSubmitting ? "Atualizando..." : "Atualizar Status"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
