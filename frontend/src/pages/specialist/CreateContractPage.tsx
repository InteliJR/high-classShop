import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Upload, AlertCircle, CheckCircle, Loader } from "lucide-react";
import { useIsMobile } from "../../hooks/use-is-mobile";
import { createContract } from "../../services/contracts.service";
import { getProcessById, type Process } from "../../services/processes.service";

interface CreateContractFormData {
  client_email: string;
  process_id: string;
  description: string;
  file?: FileList;
}

export default function CreateContractPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const processId = searchParams.get("processId");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<CreateContractFormData>({
    defaultValues: {
      client_email: "",
      process_id: "",
      description: "",
    },
  });

  const [processData, setProcessData] = useState<Process | null>(null);
  const [loadingProcess, setLoadingProcess] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const fileValue = watch("file");
  const fileName = fileValue?.[0]?.name || "";

  // Validate processId exists
  if (!processId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 font-semibold mb-4">
            Nenhum processo selecionado
          </p>
          <button
            onClick={() => navigate("/specialist/processes")}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Load process data on mount
  useEffect(() => {
    const loadProcess = async () => {
      try {
        setLoadingProcess(true);
        const process = await getProcessById(processId);
        setProcessData(process);

        // Preencher form com dados do processo
        setValue("client_email", process.client?.email || "");
        setValue("process_id", process.id);
      } catch (error) {
        console.error("Erro ao carregar processo:", error);
        setSubmitStatus({
          type: "error",
          message: "Erro ao carregar dados do processo",
        });
      } finally {
        setLoadingProcess(false);
      }
    };

    if (processId) {
      loadProcess();
    }
  }, [processId, setValue]);

  const onSubmit = async (formData: CreateContractFormData) => {
    if (!formData.file || formData.file.length === 0) {
      setSubmitStatus({
        type: "error",
        message: "Por favor, selecione um arquivo PDF.",
      });
      return;
    }

    // Verificar se processo foi carregado antes de submeter
    if (!processData) {
      setSubmitStatus({
        type: "error",
        message: "Erro ao carregar dados do processo",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });

    try {
      const result = await createContract({
        file: formData.file[0],
        client_email: processData.client?.email || formData.client_email,
        process_id: processData.id,
        description: formData.description || undefined,
      });

      setSubmitStatus({
        type: "success",
        message: `Documento enviado com sucesso! ID: ${result.id}`,
      });

      reset();
      setTimeout(() => {
        navigate("/specialist/processes");
      }, 2000);
    } catch (error: any) {
      console.error("Erro ao criar contrato:", error);

      // Tratamento específico para contrato já existente
      if (
        error.response?.status === 409 ||
        error.response?.data?.error === "CONTRACT_ALREADY_EXISTS"
      ) {
        setSubmitStatus({
          type: "error",
          message:
            "Já existe um contrato ativo para este processo. Aguarde a assinatura, recusa ou cancelamento antes de criar um novo.",
        });
      } else {
        setSubmitStatus({
          type: "error",
          message:
            error.response?.data?.message ||
            "Erro ao enviar documento. Tente novamente.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${isMobile ? "px-4 py-6" : "px-8 py-8"}`}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1
            className={`${
              isMobile ? "text-2xl" : "text-4xl"
            } font-bold text-gray-900 mb-2`}
          >
            Subir Documento
          </h1>
          <p className="text-gray-600">
            {processData
              ? `Cliente: ${
                  processData.client?.name || "Carregando..."
                } | Processo: ${processData.id.slice(0, 8)}`
              : "Carregando informações do processo..."}
          </p>
        </div>

        {/* Status Messages */}
        {submitStatus.type && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
              submitStatus.type === "success"
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            {submitStatus.type === "success" ? (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            )}
            <p
              className={`text-sm ${
                submitStatus.type === "success"
                  ? "text-green-800"
                  : "text-red-800"
              }`}
            >
              {submitStatus.message}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Email do Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email do Cliente
            </label>
            <input
              type="email"
              readOnly
              disabled
              {...register("client_email")}
              className={`w-full px-4 py-2 rounded-lg border border-gray-300 bg-gray-100 text-gray-700 cursor-not-allowed focus:outline-none transition`}
            />
          </div>

          {/* Hidden input para manter process_id */}
          <input type="hidden" {...register("process_id")} />

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descrição{" "}
              <span className="text-gray-500 text-xs">(opcional)</span>
            </label>
            <textarea
              placeholder="Descreva o documento (ex: Contrato de compra e venda assinado)"
              rows={3}
              {...register("description")}
              className={`w-full px-4 py-2 rounded-lg border ${
                errors.description ? "border-red-500" : "border-gray-300"
              } focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition resize-none`}
            />
            {errors.description && (
              <p className="text-red-500 text-sm mt-1">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Arquivo PDF
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".pdf"
                {...register("file", {
                  required: "Selecione um arquivo PDF",
                })}
                className="sr-only"
                id="file-input"
                disabled={isSubmitting || loadingProcess}
              />
              <label
                htmlFor="file-input"
                className={`block w-full px-4 py-3 rounded-lg border-2 border-dashed ${
                  errors.file ? "border-red-500" : "border-gray-300"
                } bg-gray-50 text-center cursor-pointer transition ${
                  isSubmitting || loadingProcess
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-100"
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-6 h-6 text-gray-400" />
                  {fileName ? (
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {fileName}
                      </p>
                      <p className="text-xs text-gray-500">
                        Clique para trocar
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Clique ou arraste um arquivo
                      </p>
                      <p className="text-xs text-gray-500">
                        Apenas PDF (máx 10MB)
                      </p>
                    </div>
                  )}
                </div>
              </label>
            </div>
            {errors.file && (
              <p className="text-red-500 text-sm mt-1">{errors.file.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting || loadingProcess}
              className={`flex-1 px-6 py-3 rounded-lg font-medium text-white transition ${
                isSubmitting || loadingProcess
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-slate-700 hover:bg-slate-800"
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  Enviando...
                </span>
              ) : loadingProcess ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  Carregando...
                </span>
              ) : (
                "Enviar Documento"
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={isSubmitting}
              className="px-6 py-3 rounded-lg font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
