import { useRef, useState, type RefObject } from "react";
import { X, AlertTriangle } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import type { Process } from "../../services/processes.service";
import {
  updateProcessStatus,
  rejectProcess,
} from "../../services/processes.service";
import { Alert } from "../ui/alert";
import { Dialog, DialogContent } from "../ui/dialog";

interface UpdateProcessStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  process: Process;
  action?: "status" | "reject";
  returnFocusRef?: RefObject<HTMLElement | null>;
}

interface UpdateProcessFormData {
  status: Process["status"];
  notes?: string;
}

function getProcessActionErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error === null) return fallback;

  const candidate = error as {
    friendlyMessage?: unknown;
    response?: { data?: { message?: unknown } };
    message?: unknown;
  };

  for (const message of [
    candidate.friendlyMessage,
    candidate.response?.data?.message,
    candidate.message,
  ]) {
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
}

/**
 * Keeps the sole manual status transition separate from process rejection.
 */
export default function UpdateProcessStatusModal({
  isOpen,
  onClose,
  onSuccess,
  process,
  action = "status",
  returnFocusRef,
}: UpdateProcessStatusModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const rejectionInFlight = useRef(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateProcessFormData>({
    defaultValues: {
      status: "DOCUMENTATION",
      notes: process.notes || "",
    },
  });

  const statusOptions: Array<{
    value: Process["status"];
    label: string;
  }> = [
    { value: "DOCUMENTATION", label: "Documentação" },
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
      setError(getProcessActionErrorMessage(err, "Erro ao atualizar processo"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (rejectionInFlight.current) return;
    rejectionInFlight.current = true;

    try {
      setIsSubmitting(true);
      setError(null);

      await rejectProcess(process.id, rejectionReason || undefined);

      setRejectionReason("");
      reset();
      onClose();
      onSuccess?.();
    } catch (err) {
      setError(getProcessActionErrorMessage(err, "Erro ao rejeitar processo"));
    } finally {
      rejectionInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  const handleRejectCancel = () => {
    setRejectionReason("");
    setError(null);
    onClose();
  };

  const handleClose = () => {
    reset();
    setError(null);
    setRejectionReason("");
    onClose();
  };

  if (!isOpen) return null;

  if (action === "reject") {
    return (
      <Dialog
        open={isOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isSubmitting) handleRejectCancel();
        }}
      >
        <DialogContent
          open={isOpen}
          title="Rejeitar Processo"
          dismissible={!isSubmitting}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef?.current?.focus();
          }}
          className="max-w-md"
        >
          <div className="space-y-4">
            <Alert variant="warning">
              <AlertTriangle size={20} aria-hidden="true" />
              <span>
                Tem certeza que deseja rejeitar este processo? Esta ação não
                pode ser desfeita.
              </span>
            </Alert>
            <div>
              <label
                htmlFor="process-rejection-reason"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Motivo da Rejeição{" "}
                <span className="text-gray-400">(opcional)</span>
              </label>
              <textarea
                id="process-rejection-reason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Informe o motivo da rejeição..."
                rows={3}
                maxLength={1000}
                disabled={isSubmitting}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                {rejectionReason.length}/1000 caracteres
              </p>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleRejectCancel}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {isSubmitting ? "Rejeitando..." : "Confirmar Rejeição"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4"
      onClick={!isSubmitting ? handleClose : undefined}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-sm md:max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
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
            <label
              htmlFor="process-next-status"
              className="block text-xs sm:text-sm font-medium text-gray-700 mb-2"
            >
              Novo Status <span className="text-red-500">*</span>
            </label>
            <Controller
              name="status"
              control={control}
              rules={{ required: "Status é obrigatório" }}
              render={({ field }) => (
                <select
                  {...field}
                  id="process-next-status"
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
