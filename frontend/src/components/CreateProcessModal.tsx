import { useState } from "react";
import { useForm } from "react-hook-form";
import { X } from "lucide-react";
import {
  fetchClients,
  fetchAvailableProducts,
} from "../services/select-options.service";
import { createProcess } from "../services/processes.service";
import { useAuth } from "../store/authStateManager";
import InfiniteScrollSelect from "./InfiniteScrollSelect";

interface CreateProcessFormData {
  client_id: string;
  product_id: string;
}

interface CreateProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Modal for creating a new process with client and product selection
 * Products are automatically filtered by specialist's speciality
 * Uses InfiniteScrollSelect for better performance with many records
 */
export default function CreateProcessModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateProcessModalProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CreateProcessFormData>({
    defaultValues: {
      client_id: "",
      product_id: "",
    },
  });

  const clientId = watch("client_id");
  const productId = watch("product_id");

  const onSubmit = async (data: CreateProcessFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Validação manual adicional
      if (!data.client_id) {
        setError("Por favor, selecione um cliente");
        return;
      }
      if (!data.product_id) {
        setError("Por favor, selecione um produto");
        return;
      }

      await createProcess({
        client_id: data.client_id,
        specialist_id: user?.id,
        product_type: user?.speciality as "CAR" | "BOAT" | "AIRCRAFT",
        product_id: data.product_id,
      });

      reset();
      onClose();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar processo");
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4" onClick={!isSubmitting ? handleClose : undefined}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm md:max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">
            Novo Processo
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

          {/* Client Select - Infinite Scroll */}
          <InfiniteScrollSelect
            label="Cliente"
            placeholder="Selecione um cliente"
            value={clientId}
            onChange={(value) => {
              setValue("client_id", value);
              setError(null);
            }}
            onLoadMore={async (page) => {
              try {
                const clients = await fetchClients(page, 20);
                return clients;
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Erro ao carregar clientes"
                );
                return [];
              }
            }}
            error={errors.client_id?.message}
            required
          />

          {/* Product Select - Infinite Scroll */}
          <InfiniteScrollSelect
            label="Produto"
            placeholder={
              !user?.speciality
                ? "Especialidade não configurada"
                : "Selecione um produto"
            }
            value={productId}
            onChange={(value) => {
              setValue("product_id", value);
              setError(null);
            }}
            onLoadMore={async (page) => {
              if (!user?.speciality) return [];
              try {
                const products = await fetchAvailableProducts(
                  user.speciality as "CAR" | "BOAT" | "AIRCRAFT",
                  page,
                  20
                );
                return products;
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Erro ao carregar produtos"
                );
                return [];
              }
            }}
            disabled={!user?.speciality}
            error={errors.product_id?.message}
            required
          />

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
              {isSubmitting ? "Criando..." : "Criar Processo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
