import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { X } from "lucide-react";
import {
  fetchClients,
  fetchAvailableProducts,
} from "../services/select-options.service";
import { createProcess } from "../services/processes.service";
import { useAuth } from "../store/authStateManager";

interface SelectOption {
  id: string | number;
  label: string;
}

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
 */
export default function CreateProcessModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateProcessModalProps) {
  const { user } = useAuth();
  const [clients, setClients] = useState<SelectOption[]>([]);
  const [products, setProducts] = useState<SelectOption[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateProcessFormData>({
    defaultValues: {
      client_id: "",
      product_id: "",
    },
  });

  // Fetch clients on component mount
  useEffect(() => {
    if (!isOpen) return;

    const loadClients = async () => {
      try {
        setIsLoadingClients(true);
        setError(null);
        const clientList = await fetchClients();
        setClients(clientList);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar clientes"
        );
      } finally {
        setIsLoadingClients(false);
      }
    };

    loadClients();
  }, [isOpen]);

  // Fetch products when product_type changes
  useEffect(() => {
    if (!isOpen || !user?.speciality) return;

    const loadProducts = async () => {
      try {
        setIsLoadingProducts(true);
        setError(null);
        const productList = await fetchAvailableProducts(
          user.speciality as "CAR" | "BOAT" | "AIRCRAFT"
        );
        setProducts(productList);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar produtos"
        );
      } finally {
        setIsLoadingProducts(false);
      }
    };

    loadProducts();
  }, [isOpen, user?.speciality]);

  const onSubmit = async (data: CreateProcessFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm md:max-w-md max-h-[90vh] overflow-y-auto">
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

          {/* Client Select */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Cliente <span className="text-red-500">*</span>
            </label>
            <Controller
              name="client_id"
              control={control}
              rules={{ required: "Cliente é obrigatório" }}
              render={({ field }) => (
                <select
                  {...field}
                  disabled={isLoadingClients}
                  className={`w-full px-3 py-2 sm:py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition ${
                    errors.client_id
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                  } ${isLoadingClients ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <option value="">
                    {isLoadingClients
                      ? "Carregando clientes..."
                      : "Selecione um cliente"}
                  </option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.label}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.client_id && (
              <p className="text-xs sm:text-sm text-red-600 mt-1">
                {errors.client_id.message}
              </p>
            )}
          </div>

          {/* Product Select */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Produto <span className="text-red-500">*</span>
            </label>
            <Controller
              name="product_id"
              control={control}
              rules={{ required: "Produto é obrigatório" }}
              render={({ field }) => (
                <select
                  {...field}
                  disabled={isLoadingProducts || !user?.speciality}
                  className={`w-full px-3 py-2 sm:py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition ${
                    errors.product_id
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                  } ${
                    isLoadingProducts || !user?.speciality
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  <option value="">
                    {isLoadingProducts
                      ? "Carregando produtos..."
                      : !user?.speciality
                      ? "Especialidade não configurada"
                      : "Selecione um produto"}
                  </option>
                  {products.map((product) => (
                    <option key={product.id} value={String(product.id)}>
                      {product.label}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.product_id && (
              <p className="text-xs sm:text-sm text-red-600 mt-1">
                {errors.product_id.message}
              </p>
            )}
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
              {isSubmitting ? "Criando..." : "Criar Processo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
