import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle, Loader, FileText } from "lucide-react";
import { useIsMobile } from "../../hooks/use-is-mobile";
import {
  prefillContract,
  generateContract,
  type GenerateContractData,
  type PrefillContractResponse,
  applyCpfMask,
  applyCnpjMask,
  applyCepMask,
  formatBRL,
} from "../../services/contracts.service";

interface ContractFormData {
  // Vendedor
  seller_name: string;
  seller_email: string;
  seller_cpf: string;
  seller_rg: string;
  seller_address: string;
  seller_cep: string;
  seller_bank: string;
  seller_agency: string;
  seller_checking_account: string;

  // Comprador
  buyer_name: string;
  buyer_email: string;
  buyer_cpf: string;
  buyer_rg: string;
  buyer_address: string;
  buyer_cep: string;

  // Veículo
  vehicle_model: string;
  vehicle_year: string;
  vehicle_registration_id: string;
  vehicle_serial_number: string;
  vehicle_technical_info: string;
  vehicle_price: number;

  // Pagamento
  payment_seller_value: number;

  // Comissão
  commission_value: number;
  commission_name: string;
  commission_cpf: string;
  commission_bank: string;
  commission_agency: string;
  commission_checking_account: string;

  // Cidade
  city: string;

  // Descrição
  description: string;
}

export default function CreateContractPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const processId = searchParams.get("processId");

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContractFormData>({
    defaultValues: {
      seller_name: "",
      seller_email: "",
      seller_cpf: "",
      seller_rg: "",
      seller_address: "",
      seller_cep: "",
      seller_bank: "",
      seller_agency: "",
      seller_checking_account: "",
      buyer_name: "",
      buyer_email: "",
      buyer_cpf: "",
      buyer_rg: "",
      buyer_address: "",
      buyer_cep: "",
      vehicle_model: "",
      vehicle_year: "",
      vehicle_registration_id: "",
      vehicle_serial_number: "",
      vehicle_technical_info: "",
      vehicle_price: 0,
      payment_seller_value: 0,
      commission_value: 0,
      commission_name: "",
      commission_cpf: "",
      commission_bank: "",
      commission_agency: "",
      commission_checking_account: "",
      city: "",
      description: "",
    },
  });

  const [prefillData, setPrefillData] =
    useState<PrefillContractResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const vehiclePrice = watch("vehicle_price");
  const commissionValue = watch("commission_value");

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

  // Load prefill data on mount
  useEffect(() => {
    const loadPrefillData = async () => {
      try {
        setLoading(true);
        const data = await prefillContract(processId);
        setPrefillData(data);

        // Preencher formulário com dados
        // Vendedor (especialista)
        setValue("seller_name", data.seller.name);
        setValue("seller_email", data.seller.email);
        setValue(
          "seller_cpf",
          data.seller.cpf ? applyCpfMask(data.seller.cpf) : "",
        );
        setValue("seller_rg", data.seller.rg || "");
        setValue("seller_address", data.seller.address || "");
        setValue(
          "seller_cep",
          data.seller.cep ? applyCepMask(data.seller.cep) : "",
        );

        // Comprador (cliente)
        setValue("buyer_name", data.buyer.name);
        setValue("buyer_email", data.buyer.email);
        setValue(
          "buyer_cpf",
          data.buyer.cpf ? applyCpfMask(data.buyer.cpf) : "",
        );
        setValue("buyer_rg", data.buyer.rg || "");
        setValue("buyer_address", data.buyer.address || "");
        setValue(
          "buyer_cep",
          data.buyer.cep ? applyCepMask(data.buyer.cep) : "",
        );

        // Veículo
        setValue(
          "vehicle_model",
          `${data.product.brand} ${data.product.model}`,
        );
        setValue("vehicle_year", String(data.product.year));
        setValue("vehicle_registration_id", data.product.registration_id || "");
        setValue("vehicle_serial_number", data.product.serial_number || "");
        setValue("vehicle_technical_info", data.product.technical_info || "");

        // Valores
        const proposalValue = data.proposal?.value || data.product.price;
        setValue("vehicle_price", proposalValue);

        // Comissão da plataforma
        if (data.commission) {
          setValue("commission_name", data.commission.name || "");
          setValue(
            "commission_cpf",
            data.commission.cpf ? applyCnpjMask(data.commission.cpf) : "",
          );
          setValue("commission_bank", data.commission.bank || "");
          setValue("commission_agency", data.commission.agency || "");
          setValue(
            "commission_checking_account",
            data.commission.checking_account || "",
          );
        }
      } catch (error: unknown) {
        console.error("Erro ao carregar dados do contrato:", error);

        // Verificar se é erro de produto não associado
        const axiosError = error as {
          response?: { data?: { error?: string; details?: { hint?: string } } };
        };
        const errorCode = axiosError?.response?.data?.error;
        const hint = axiosError?.response?.data?.details?.hint;

        if (errorCode === "PRODUCT_NOT_ASSOCIATED") {
          setSubmitStatus({
            type: "error",
            message:
              hint ||
              "Este processo ainda não tem um produto associado. Por favor, selecione um produto antes de gerar o contrato.",
          });
        } else {
          setSubmitStatus({
            type: "error",
            message: "Erro ao carregar dados do processo",
          });
        }
      } finally {
        setLoading(false);
      }
    };

    if (processId) {
      loadPrefillData();
    }
  }, [processId, setValue]);

  const onSubmit = async (formData: ContractFormData) => {
    if (!processId) return;

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });

    try {
      const contractData: GenerateContractData = {
        process_id: processId,
        seller_name: formData.seller_name,
        seller_email: formData.seller_email,
        seller_cpf: formData.seller_cpf,
        seller_rg: formData.seller_rg || undefined,
        seller_address: formData.seller_address,
        seller_cep: formData.seller_cep,
        seller_bank: formData.seller_bank,
        seller_agency: formData.seller_agency,
        seller_checking_account: formData.seller_checking_account,
        buyer_name: formData.buyer_name,
        buyer_email: formData.buyer_email,
        buyer_cpf: formData.buyer_cpf,
        buyer_rg: formData.buyer_rg || undefined,
        buyer_address: formData.buyer_address,
        buyer_cep: formData.buyer_cep,
        vehicle_model: formData.vehicle_model,
        vehicle_year: formData.vehicle_year,
        vehicle_registration_id: formData.vehicle_registration_id,
        vehicle_serial_number: formData.vehicle_serial_number,
        vehicle_technical_info: formData.vehicle_technical_info || undefined,
        vehicle_price: formData.vehicle_price,
        payment_seller_value: formData.payment_seller_value,
        commission_value: formData.commission_value,
        commission_name: formData.commission_name,
        commission_cpf: formData.commission_cpf,
        commission_bank: formData.commission_bank,
        commission_agency: formData.commission_agency,
        commission_checking_account: formData.commission_checking_account,
        city: formData.city,
        description: formData.description || undefined,
      };

      const result = await generateContract(contractData);

      setSubmitStatus({
        type: "success",
        message: `Contrato gerado com sucesso! ID: ${result.id}`,
      });

      setTimeout(() => {
        navigate("/specialist/processes");
      }, 2000);
    } catch (error: any) {
      console.error("Erro ao gerar contrato:", error);

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
            "Erro ao gerar contrato. Tente novamente.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calcular valor do vendedor automaticamente
  useEffect(() => {
    if (vehiclePrice && commissionValue) {
      const sellerValue = vehiclePrice - commissionValue;
      setValue("payment_seller_value", sellerValue > 0 ? sellerValue : 0);
    }
  }, [vehiclePrice, commissionValue, setValue]);

  const getProductTypeLabel = (type?: string) => {
    switch (type) {
      case "CAR":
        return "Veículo";
      case "BOAT":
        return "Embarcação";
      case "AIRCRAFT":
        return "Aeronave";
      default:
        return "Produto";
    }
  };

  const getRegistrationLabel = (type?: string) => {
    switch (type) {
      case "CAR":
        return "Placa";
      case "BOAT":
        return "Inscrição Marítima";
      case "AIRCRAFT":
        return "Prefixo (Matrícula)";
      default:
        return "Identificação";
    }
  };

  const getSerialLabel = (type?: string) => {
    switch (type) {
      case "CAR":
        return "Chassi";
      case "BOAT":
        return "Número do Casco (Hull Number)";
      case "AIRCRAFT":
        return "Número de Série";
      default:
        return "Número Serial";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-slate-700" />
        <span className="ml-2 text-slate-600">
          Carregando dados do contrato...
        </span>
      </div>
    );
  }

  return (
    <div className={`${isMobile ? "px-4 py-6" : "px-8 py-8"}`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-8 h-8 text-slate-700" />
            <h1
              className={`${isMobile ? "text-2xl" : "text-4xl"} font-bold text-gray-900`}
            >
              Gerar Contrato de Venda
            </h1>
          </div>
          <p className="text-gray-600">
            {prefillData
              ? `${getProductTypeLabel(prefillData.product_type)}: ${prefillData.product.brand} ${prefillData.product.model} | Cliente: ${prefillData.buyer.name}`
              : "Carregando..."}
          </p>
          {prefillData?.proposal && (
            <p className="text-sm text-green-600 mt-1">
              Proposta aceita: {formatBRL(prefillData.proposal.value)}
            </p>
          )}
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Seção: Vendedor */}
          <section className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Dados do Vendedor
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  {...register("seller_name", {
                    required: "Nome é obrigatório",
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {errors.seller_name && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.seller_name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-mail *
                </label>
                <input
                  type="email"
                  {...register("seller_email", {
                    required: "E-mail é obrigatório",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "E-mail inválido",
                    },
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {errors.seller_email && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.seller_email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CPF *
                </label>
                <Controller
                  name="seller_cpf"
                  control={control}
                  rules={{ required: "CPF é obrigatório" }}
                  render={({ field }) => (
                    <input
                      type="text"
                      {...field}
                      onChange={(e) =>
                        field.onChange(applyCpfMask(e.target.value))
                      }
                      maxLength={14}
                      placeholder="000.000.000-00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  )}
                />
                {errors.seller_cpf && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.seller_cpf.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RG
                </label>
                <input
                  type="text"
                  {...register("seller_rg")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CEP *
                </label>
                <Controller
                  name="seller_cep"
                  control={control}
                  rules={{ required: "CEP é obrigatório" }}
                  render={({ field }) => (
                    <input
                      type="text"
                      {...field}
                      onChange={(e) =>
                        field.onChange(applyCepMask(e.target.value))
                      }
                      maxLength={9}
                      placeholder="00000-000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  )}
                />
                {errors.seller_cep && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.seller_cep.message}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Endereço Completo *
                </label>
                <input
                  type="text"
                  {...register("seller_address", {
                    required: "Endereço é obrigatório",
                  })}
                  placeholder="Rua, número, complemento, bairro, cidade - UF"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {errors.seller_address && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.seller_address.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Banco *
                </label>
                <input
                  type="text"
                  {...register("seller_bank", {
                    required: "Banco é obrigatório",
                  })}
                  placeholder="Ex: Itaú, Bradesco, Nubank"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {errors.seller_bank && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.seller_bank.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Agência *
                </label>
                <input
                  type="text"
                  {...register("seller_agency", {
                    required: "Agência é obrigatória",
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {errors.seller_agency && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.seller_agency.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Conta Corrente *
                </label>
                <input
                  type="text"
                  {...register("seller_checking_account", {
                    required: "Conta é obrigatória",
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {errors.seller_checking_account && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.seller_checking_account.message}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Seção: Comprador */}
          <section className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Dados do Comprador
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  {...register("buyer_name", {
                    required: "Nome é obrigatório",
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {errors.buyer_name && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.buyer_name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  {...register("buyer_email", {
                    required: "Email é obrigatório",
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-gray-50"
                />
                {errors.buyer_email && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.buyer_email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CPF *
                </label>
                <Controller
                  name="buyer_cpf"
                  control={control}
                  rules={{ required: "CPF é obrigatório" }}
                  render={({ field }) => (
                    <input
                      type="text"
                      {...field}
                      onChange={(e) =>
                        field.onChange(applyCpfMask(e.target.value))
                      }
                      maxLength={14}
                      placeholder="000.000.000-00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  )}
                />
                {errors.buyer_cpf && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.buyer_cpf.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RG
                </label>
                <input
                  type="text"
                  {...register("buyer_rg")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CEP *
                </label>
                <Controller
                  name="buyer_cep"
                  control={control}
                  rules={{ required: "CEP é obrigatório" }}
                  render={({ field }) => (
                    <input
                      type="text"
                      {...field}
                      onChange={(e) =>
                        field.onChange(applyCepMask(e.target.value))
                      }
                      maxLength={9}
                      placeholder="00000-000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  )}
                />
                {errors.buyer_cep && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.buyer_cep.message}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Endereço Completo *
                </label>
                <input
                  type="text"
                  {...register("buyer_address", {
                    required: "Endereço é obrigatório",
                  })}
                  placeholder="Rua, número, complemento, bairro, cidade - UF"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {errors.buyer_address && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.buyer_address.message}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Seção: Veículo/Produto */}
          <section className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Dados do {getProductTypeLabel(prefillData?.product_type)}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Marca e Modelo *
                </label>
                <input
                  type="text"
                  {...register("vehicle_model", {
                    required: "Modelo é obrigatório",
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {errors.vehicle_model && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.vehicle_model.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ano *
                </label>
                <input
                  type="text"
                  {...register("vehicle_year", {
                    required: "Ano é obrigatório",
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {errors.vehicle_year && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.vehicle_year.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getRegistrationLabel(prefillData?.product_type)} *
                </label>
                <input
                  type="text"
                  {...register("vehicle_registration_id", {
                    required: "Identificação é obrigatória",
                  })}
                  placeholder={
                    prefillData?.product_type === "CAR"
                      ? "ABC-1234"
                      : prefillData?.product_type === "AIRCRAFT"
                        ? "PT-ABC"
                        : "Número de inscrição"
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {errors.vehicle_registration_id && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.vehicle_registration_id.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getSerialLabel(prefillData?.product_type)} *
                </label>
                <input
                  type="text"
                  {...register("vehicle_serial_number", {
                    required: "Número serial é obrigatório",
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {errors.vehicle_serial_number && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.vehicle_serial_number.message}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Informações Técnicas
                </label>
                <textarea
                  {...register("vehicle_technical_info")}
                  rows={2}
                  placeholder="Motor, cor, quilometragem, acessórios, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </section>

          {/* Seção: Valores */}
          <section className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Valores da Transação
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Total do{" "}
                  {getProductTypeLabel(prefillData?.product_type)} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register("vehicle_price", {
                    required: "Valor é obrigatório",
                    valueAsNumber: true,
                    min: { value: 0, message: "Valor deve ser positivo" },
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {vehiclePrice > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    {formatBRL(vehiclePrice)}
                  </p>
                )}
                {errors.vehicle_price && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.vehicle_price.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comissão da Plataforma *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register("commission_value", {
                    required: "Comissão é obrigatória",
                    valueAsNumber: true,
                    min: { value: 0, message: "Valor deve ser positivo" },
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {commissionValue > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    {formatBRL(commissionValue)}
                  </p>
                )}
                {errors.commission_value && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.commission_value.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Líquido do Vendedor
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register("payment_seller_value", { valueAsNumber: true })}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                />
                {vehiclePrice - commissionValue > 0 && (
                  <p className="text-sm text-green-600 mt-1">
                    {formatBRL(vehiclePrice - commissionValue)}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Seção: Comissão */}
          <section className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Dados da Plataforma (Comissão)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Razão Social *
                </label>
                <input
                  type="text"
                  {...register("commission_name", {
                    required: "Razão social é obrigatória",
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {errors.commission_name && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.commission_name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CNPJ *
                </label>
                <Controller
                  name="commission_cpf"
                  control={control}
                  rules={{ required: "CNPJ é obrigatório" }}
                  render={({ field }) => (
                    <input
                      type="text"
                      {...field}
                      onChange={(e) =>
                        field.onChange(applyCnpjMask(e.target.value))
                      }
                      maxLength={18}
                      placeholder="00.000.000/0000-00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  )}
                />
                {errors.commission_cpf && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.commission_cpf.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Banco *
                </label>
                <input
                  type="text"
                  {...register("commission_bank", {
                    required: "Banco é obrigatório",
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {errors.commission_bank && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.commission_bank.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Agência *
                </label>
                <input
                  type="text"
                  {...register("commission_agency", {
                    required: "Agência é obrigatória",
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {errors.commission_agency && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.commission_agency.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Conta Corrente *
                </label>
                <input
                  type="text"
                  {...register("commission_checking_account", {
                    required: "Conta é obrigatória",
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {errors.commission_checking_account && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.commission_checking_account.message}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Seção: Cidade e Descrição */}
          <section className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Informações Adicionais
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cidade de Assinatura *
                </label>
                <input
                  type="text"
                  {...register("city", { required: "Cidade é obrigatória" })}
                  placeholder="Ex: São Paulo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                {errors.city && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.city.message}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição / Observações
                </label>
                <textarea
                  {...register("description")}
                  rows={3}
                  placeholder="Informações adicionais sobre o contrato..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </section>

          {/* Submit Buttons */}
          <div className="flex flex-col gap-3 pt-4">
            {/* Mensagem de erro/sucesso próximo aos botões */}
            {submitStatus.type && (
              <div
                className={`flex items-start gap-2 p-4 rounded-lg ${
                  submitStatus.type === "success"
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                {submitStatus.type === "success" ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <p
                  className={`text-sm ${
                    submitStatus.type === "success"
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {submitStatus.message}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex-1 px-6 py-3 rounded-lg font-medium text-white transition ${
                  isSubmitting
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-slate-700 hover:bg-slate-800"
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader className="w-4 h-4 animate-spin" />
                    Gerando contrato...
                  </span>
                ) : (
                  "Gerar e Enviar Contrato"
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
          </div>
        </form>
      </div>
    </div>
  );
}
