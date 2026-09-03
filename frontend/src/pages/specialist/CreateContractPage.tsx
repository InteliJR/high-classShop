import { useEffect, useState, useCallback, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  FileText,
  Eye,
  ChevronDown,
  Check,
} from "lucide-react";
import { useIsMobile } from "../../hooks/use-is-mobile";
import ContractCommissionStep from "./ContractCommissionStep";
import {
  prefillContract,
  previewContract,
  sendContractAfterPreview,
  cancelContractPreview,
  listContractTemplates,
  type GenerateContractData,
  type PrefillContractResponse,
  type PreviewContractData,
  type PreviewContractResponse,
  type ContractTemplate,
} from "../../services/contracts.service";
import {
  applyCpfMask,
  applyCnpjMask,
  applyCepMask,
  applyRgMask,
  stripFormatting,
} from "../../utils/mask";
import DocuSignPreviewModal from "../../components/contracts/DocuSignPreviewModal";
import Button from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { getCommissionPreview } from "../../lib/contract-commission";
import { formatCurrency } from "../../lib/currency";

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

  // Comissão total da venda — único valor de comissão editável
  total_commission_rate: number;

  // Dados da Plataforma (Split 1)
  platform_name: string;
  platform_cnpj: string;
  platform_bank: string;
  platform_agency: string;
  platform_checking_account: string;

  // Dados do Escritório (Split 2)
  office_name: string;
  office_cnpj: string;
  office_bank: string;
  office_agency: string;
  office_checking_account: string;

  // Dados do Especialista (Split 3)
  specialist_name: string;
  specialist_email: string;
  specialist_document: string;
  specialist_bank: string;
  specialist_agency: string;
  specialist_checking_account: string;

  // Testemunhas (opcionais)
  testimonial1_name: string;
  testimonial1_cpf: string;
  testimonial1_email: string;
  testimonial2_name: string;
  testimonial2_cpf: string;
  testimonial2_email: string;

  // Cidade
  city: string;

  // Descrição
  description: string;
}

function extractBackendMessage(error: any): string {
  const candidate =
    error?.response?.data?.error?.message ??
    error?.response?.data?.message ??
    error?.friendlyMessage ??
    "";

  if (Array.isArray(candidate)) return candidate.join(", ");
  if (typeof candidate === "string") return candidate;
  if (candidate == null) return "";
  return String(candidate);
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
    trigger,
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
      total_commission_rate: 0,
      platform_name: "",
      platform_cnpj: "",
      platform_bank: "",
      platform_agency: "",
      platform_checking_account: "",
      office_name: "",
      office_cnpj: "",
      office_bank: "",
      office_agency: "",
      office_checking_account: "",
      specialist_name: "",
      specialist_email: "",
      specialist_document: "",
      specialist_bank: "",
      specialist_agency: "",
      specialist_checking_account: "",
      testimonial1_name: "",
      testimonial1_cpf: "",
      testimonial1_email: "",
      testimonial2_name: "",
      testimonial2_cpf: "",
      testimonial2_email: "",
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

  // Preview states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] =
    useState<PreviewContractResponse | null>(null);
  const [previewFormData, setPreviewFormData] =
    useState<PreviewContractData | null>(null);
  const [isSendingAfterPreview, setIsSendingAfterPreview] = useState(false);

  // Wizard: a comissão é decidida antes de o especialista ver o resto do
  // contrato. Um único useForm cobre as duas etapas, então o payload final
  // continua sendo montado exatamente como antes.
  const [step, setStep] = useState<1 | 2>(1);

  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  const vehiclePrice = watch("vehicle_price");
  const totalCommissionRate = watch("total_commission_rate");

  // A porcentagem total é a única entrada: a API preserva as regras de split
  // cadastradas e o especialista confere todas as parcelas antes do envio.
  const specialistRate = prefillData?.specialist?.rate ?? 0;
  const officeRate = prefillData?.office?.rate ?? 0;
  const {
    totalCommissionValue,
    platformValue,
    officeValue,
    specialistValue,
  } = getCommissionPreview({
    saleValue: vehiclePrice,
    totalCommissionRate,
    specialistShareRate: specialistRate,
    officeShareRate: officeRate,
  });
  const sellerNetPreviewValue = (vehiclePrice || 0) - totalCommissionValue;

  // Load prefill data on mount
  useEffect(() => {
    const loadPrefillData = async () => {
      if (!processId) return;
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
        setValue(
          "seller_rg",
          data.seller.rg ? applyRgMask(data.seller.rg) : "",
        );
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
        setValue(
          "buyer_rg",
          data.buyer.rg ? applyRgMask(data.buyer.rg) : "",
        );
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

        // Dados da Plataforma (Split 1)
        if (data.platform) {
          setValue("platform_name", data.platform.name || "");
          setValue(
            "platform_cnpj",
            data.platform.cnpj ? applyCnpjMask(data.platform.cnpj) : "",
          );
          setValue("platform_bank", data.platform.bank || "");
          setValue("platform_agency", data.platform.agency || "");
          setValue(
            "platform_checking_account",
            data.platform.checking_account || "",
          );
        }

        // Dados do Escritório (Split 2)
        if (data.office) {
          setValue("office_name", data.office.name || "");
          setValue(
            "office_cnpj",
            data.office.cnpj ? applyCnpjMask(data.office.cnpj) : "",
          );
          setValue("office_bank", data.office.bank || "");
          setValue("office_agency", data.office.agency || "");
          setValue(
            "office_checking_account",
            data.office.checking_account || "",
          );
        }

        // Dados do Especialista (Split 3)
        if (data.specialist) {
          setValue("specialist_name", data.specialist.name || "");
          setValue("specialist_email", data.specialist.email || "");
          setValue(
            "specialist_document",
            data.specialist.cnpj ? applyCnpjMask(data.specialist.cnpj) : "",
          );
          setValue("specialist_bank", data.specialist.bank || "");
          setValue("specialist_agency", data.specialist.agency || "");
          setValue(
            "specialist_checking_account",
            data.specialist.checking_account || "",
          );
        }

        // Comissão total sugerida (plataforma + escritório + especialista) — editável
        if (data.suggested_total_rate != null) {
          setValue("total_commission_rate", data.suggested_total_rate);
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

  // Carregar templates disponíveis + auto-seleção pelo tipo do produto
  useEffect(() => {
    const load = async () => {
      try {
        const list = await listContractTemplates();
        setTemplates(list);
        // auto-seleção pelo tipo do produto (casa por nome do template)
        const key =
          prefillData?.product_type === "CAR"
            ? "carro"
            : prefillData?.product_type === "BOAT"
              ? "embarca"
              : prefillData?.product_type === "AIRCRAFT"
                ? "aeronave"
                : "";
        const match = list.find((t) => t.name.toLowerCase().includes(key));
        if (match) setSelectedTemplateId(match.templateId);
      } catch (e) {
        console.error("Erro ao carregar templates:", e);
      }
    };
    if (prefillData) load();
  }, [prefillData]);

  // Fecha o dropdown de template ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        templateDropdownRef.current &&
        !templateDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTemplateDropdownOpen(false);
      }
    };
    if (isTemplateDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isTemplateDropdownOpen]);

  const selectedTemplate = templates.find(
    (t) => t.templateId === selectedTemplateId,
  );

  // Build contract data from form
  const buildContractData = (
    formData: ContractFormData,
  ): GenerateContractData => ({
    process_id: processId!,
    template_id: selectedTemplateId || undefined,
    seller_name: formData.seller_name,
    seller_email: formData.seller_email,
    seller_cpf: stripFormatting(formData.seller_cpf),
    seller_rg: formData.seller_rg
      ? stripFormatting(formData.seller_rg)
      : undefined,
    seller_address: formData.seller_address,
    seller_cep: stripFormatting(formData.seller_cep),
    seller_bank: formData.seller_bank,
    seller_agency: formData.seller_agency,
    seller_checking_account: formData.seller_checking_account,
    buyer_name: formData.buyer_name,
    buyer_email: formData.buyer_email,
    buyer_cpf: stripFormatting(formData.buyer_cpf),
    buyer_rg: formData.buyer_rg
      ? stripFormatting(formData.buyer_rg)
      : undefined,
    buyer_address: formData.buyer_address,
    buyer_cep: stripFormatting(formData.buyer_cep),
    vehicle_model: formData.vehicle_model,
    vehicle_year: formData.vehicle_year,
    vehicle_registration_id: formData.vehicle_registration_id,
    vehicle_serial_number: formData.vehicle_serial_number,
    vehicle_technical_info: formData.vehicle_technical_info || undefined,
    vehicle_price: formData.vehicle_price,
    payment_seller_value: formData.payment_seller_value,
    // Comissão total (único valor editável — plataforma/escritório travados no backend)
    total_commission_rate: formData.total_commission_rate,
    // Platform split (opcional — nem todo ambiente tem esses dados cadastrados)
    platform_name: formData.platform_name || undefined,
    platform_cnpj: formData.platform_cnpj
      ? stripFormatting(formData.platform_cnpj)
      : undefined,
    platform_bank: formData.platform_bank || undefined,
    platform_agency: formData.platform_agency || undefined,
    platform_checking_account:
      formData.platform_checking_account || undefined,
    // Office split
    office_name: formData.office_name || undefined,
    office_cnpj: formData.office_cnpj
      ? stripFormatting(formData.office_cnpj)
      : undefined,
    office_bank: formData.office_bank || undefined,
    office_agency: formData.office_agency || undefined,
    office_checking_account: formData.office_checking_account || undefined,
    // Specialist split
    specialist_name: formData.specialist_name || undefined,
    specialist_email: formData.specialist_email || undefined,
    specialist_document: formData.specialist_document
      ? stripFormatting(formData.specialist_document)
      : undefined,
    specialist_bank: formData.specialist_bank || undefined,
    specialist_agency: formData.specialist_agency || undefined,
    specialist_checking_account:
      formData.specialist_checking_account || undefined,
    // Witnesses (optional)
    testimonial1_name: formData.testimonial1_name || undefined,
    testimonial1_cpf: formData.testimonial1_cpf
      ? stripFormatting(formData.testimonial1_cpf)
      : undefined,
    testimonial1_email: formData.testimonial1_email || undefined,
    testimonial2_name: formData.testimonial2_name || undefined,
    testimonial2_cpf: formData.testimonial2_cpf
      ? stripFormatting(formData.testimonial2_cpf)
      : undefined,
    testimonial2_email: formData.testimonial2_email || undefined,
    city: formData.city,
    description: formData.description || undefined,
  });

  // Handler para preview do contrato
  const onPreview = async (formData: ContractFormData) => {
    if (!processId) return;

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });

    try {
      const contractData = buildContractData(formData);

      const previewPayload: PreviewContractData = {
        ...contractData,
        return_url: `${window.location.origin}/specialist/contracts/preview-callback`,
      };

      const result = await previewContract(previewPayload);

      // Salvar dados para usar ao confirmar
      setPreviewData(result);
      setPreviewFormData(previewPayload);
      setShowPreviewModal(true);
    } catch (error: any) {
      console.error("Erro ao criar preview:", error);

      const backendMessage = extractBackendMessage(error);
      const lowerMessage = backendMessage.toLowerCase();

      const isEmailConflict =
        (lowerMessage.includes("vendedor") &&
          lowerMessage.includes("especialista")) ||
        lowerMessage.includes("same") ||
        (error.response?.data?.error?.code === 400 &&
          error.response?.data?.error?.details?.seller_email != null);

      if (isEmailConflict) {
        setSubmitStatus({
          type: "error",
          message:
            "O e-mail do comprador não pode ser o mesmo do consultor ou vendedor. Utilize e-mails diferentes para cada parte.",
        });
      } else if (
        error.response?.status === 409 ||
        error.response?.data?.error === "CONTRACT_ALREADY_EXISTS"
      ) {
        setSubmitStatus({
          type: "error",
          message:
            "Já existe um contrato ativo para este processo. Aguarde a assinatura, recusa ou cancelamento antes de criar um novo.",
        });
      } else if (error.response?.status === 429) {
        setSubmitStatus({
          type: "error",
          message:
            "Muitas requisições. Aguarde um momento antes de tentar novamente.",
        });
      } else {
        setSubmitStatus({
          type: "error",
          message:
            backendMessage || "Erro ao criar preview. Tente novamente.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler para confirmar envio após preview
  const handleConfirmSend = useCallback(async () => {
    if (!previewData || !previewFormData) return;

    setIsSendingAfterPreview(true);

    try {
      const result = await sendContractAfterPreview(
        previewData.envelope_id,
        previewFormData,
      );

      setShowPreviewModal(false);
      setSubmitStatus({
        type: "success",
        message: `Contrato enviado com sucesso! ID: ${result.id}`,
      });

      setTimeout(() => {
        navigate("/specialist/processes");
      }, 2000);
    } catch (error: any) {
      console.error("Erro ao enviar contrato:", error);
      setShowPreviewModal(false);

      const backendMessage = extractBackendMessage(error);
      const lowerMessage = backendMessage.toLowerCase();

      const isEmailConflict =
        (lowerMessage.includes("vendedor") &&
          lowerMessage.includes("especialista")) ||
        lowerMessage.includes("same") ||
        (error.response?.data?.error?.code === 400 &&
          error.response?.data?.error?.details?.seller_email != null);

      setSubmitStatus({
        type: "error",
        message: isEmailConflict
          ? "O e-mail do comprador não pode ser o mesmo do consultor ou vendedor. Utilize e-mails diferentes para cada parte."
          : backendMessage || "Erro ao enviar contrato. Tente novamente.",
      });
    } finally {
      setIsSendingAfterPreview(false);
    }
  }, [previewData, previewFormData, navigate]);

  // Handler para cancelar preview
  const handleCancelPreview = useCallback(async () => {
    setShowPreviewModal(false);

    if (previewData?.envelope_id) {
      try {
        await cancelContractPreview(previewData.envelope_id, processId!);
      } catch (error) {
        console.error("Erro ao cancelar preview (não crítico):", error);
      }
    }

    setPreviewData(null);
    setPreviewFormData(null);
  }, [previewData]);

  // Handler para preview expirado
  const handlePreviewExpired = useCallback(() => {
    setShowPreviewModal(false);
    setPreviewData(null);
    setPreviewFormData(null);
    setSubmitStatus({
      type: "error",
      message:
        "O preview expirou após 10 minutos. Por favor, gere um novo preview.",
    });
  }, []);

  // Calcular valor do vendedor automaticamente (seller = price - comissão total)
  useEffect(() => {
    if (vehiclePrice && totalCommissionValue) {
      const sellerValue = vehiclePrice - totalCommissionValue;
      setValue("payment_seller_value", sellerValue > 0 ? sellerValue : 0);
    }
  }, [vehiclePrice, totalCommissionValue, setValue]);

  const getProductTypeLabel = (type?: string) => {
    switch (type) {
      case "CAR":
        return "Produto";
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

  // processId ausente (todos os hooks já foram declarados acima — Rules of
  // Hooks exige que este branch condicional venha depois, não no meio deles).
  if (!processId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-status-bad mx-auto mb-4" />
          <p className="text-status-bad font-semibold mb-4">
            Nenhum processo selecionado
          </p>
          <Button onClick={() => navigate("/specialist/processes")}>
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-ink-soft" />
        <span className="ml-2 text-muted">
          Carregando dados do contrato...
        </span>
      </div>
    );
  }

  // Carregamento terminou sem dados (erro genérico ao buscar prefill) — não
  // deixa o formulário abrir em branco/editável sem os dados travados de
  // plataforma/escritório/especialista.
  if (!prefillData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-status-bad mx-auto mb-4" />
          <p className="text-status-bad font-semibold mb-4">
            {submitStatus.message || "Erro ao carregar dados do processo"}
          </p>
          <Button onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isMobile ? "px-4 py-6" : "px-8 py-8"}`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-8 h-8 text-ink" />
            <h1
              className={`${isMobile ? "text-2xl" : "text-4xl"} font-bold text-ink`}
            >
              Gerar Contrato de Venda
            </h1>
          </div>
          <p className="text-muted">
            {prefillData
              ? `${getProductTypeLabel(prefillData.product_type)}: ${prefillData.product.brand} ${prefillData.product.model} | Cliente: ${prefillData.buyer.name}`
              : "Carregando..."}
          </p>
          {prefillData.proposal && (
            <p className="text-sm text-status-ok mt-1">
              Proposta aceita:{" "}
              {formatCurrency(prefillData.proposal.value, prefillData.currency)}
            </p>
          )}
        </div>

        {/* Status Messages */}
        {submitStatus.type && (
          <Alert
            variant={submitStatus.type === "success" ? "success" : "danger"}
            className="mb-6"
          >
            {submitStatus.type === "success" ? (
              <CheckCircle className="w-5 h-5 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 mt-0.5" />
            )}
            <p className="text-sm">{submitStatus.message}</p>
          </Alert>
        )}

        {/* Etapa 1: comissão */}
        {step === 1 && (
          <ContractCommissionStep
            register={register}
            errors={errors}
            productLabel={getProductTypeLabel(prefillData.product_type)}
            currency={prefillData.currency}
            vehiclePrice={vehiclePrice || 0}
            totalCommissionValue={totalCommissionValue}
            sellerNetPreviewValue={sellerNetPreviewValue}
            platformValue={platformValue}
            officeValue={officeValue}
            specialistValue={specialistValue}
            showOffice={Boolean(prefillData.office)}
            onCancel={() => navigate(-1)}
            onContinue={async () => {
              // Valida só a comissão: o resto do contrato ainda nem foi exibido.
              const ok = await trigger("total_commission_rate");
              if (ok) setStep(2);
            }}
          />
        )}

        {/* Etapa 2: demais dados do contrato */}
        {step === 2 && (
        <form onSubmit={handleSubmit(onPreview)} className="space-y-8">

          {/* Seção: Modelo de contrato */}
          <section className="bg-surface rounded-lg border border-border p-6">
            <div className="flex items-center gap-2 border-b pb-2 mb-2">
              <FileText className="w-4 h-4 text-brand-primary" />
              <h2 className="text-base font-semibold text-ink">
                Modelo de contrato
              </h2>
            </div>
            <p className="text-sm text-muted mb-3">
              Selecionado automaticamente pelo tipo do produto — troque se
              necessário.
            </p>
            <div className="relative" ref={templateDropdownRef}>
              <button
                type="button"
                onClick={() => setIsTemplateDropdownOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-border rounded-lg bg-surface text-sm hover:border-brand-primary focus:outline-none focus:ring-2 focus:ring-focus-ring transition-colors"
              >
                <span
                  className={
                    selectedTemplate
                      ? "font-medium text-ink"
                      : "text-subtle"
                  }
                >
                  {selectedTemplate ? selectedTemplate.name : "Selecione um modelo…"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 text-muted transition-transform ${
                    isTemplateDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isTemplateDropdownOpen && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-ds-floating overflow-hidden py-1">
                  {templates.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-subtle">
                      Nenhum modelo disponível.
                    </p>
                  ) : (
                    templates.map((t) => {
                      const isSelected = t.templateId === selectedTemplateId;
                      return (
                        <button
                          key={t.templateId}
                          type="button"
                          onClick={() => {
                            setSelectedTemplateId(t.templateId);
                            setIsTemplateDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors ${
                            isSelected
                              ? "bg-brand-primary/10 text-brand-primary font-medium"
                              : "text-ink hover:bg-border-soft"
                          }`}
                        >
                          {t.name}
                          {isSelected && <Check className="w-4 h-4 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── Grupo: Dados das partes ── */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-subtle mb-3 px-1">
              Dados das partes
            </h2>

          {/* Seção: Vendedor */}
          <section className="bg-surface rounded-lg border border-border p-6 mb-6">
            <div className="flex items-center justify-between border-b pb-2 mb-4">
              <h3 className="text-base font-semibold text-ink">
                Vendedor
              </h3>
              <span className="text-xs text-subtle bg-border-soft rounded px-2 py-0.5">
                Preenchido automaticamente — edite se necessário
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  {...register("seller_name", {
                    required: "Nome é obrigatório",
                  })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                />
                {errors.seller_name && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.seller_name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
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
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                />
                {errors.seller_email && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.seller_email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  CPF *
                </label>
                <Controller
                  name="seller_cpf"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="text"
                      {...field}
                      onChange={(e) =>
                        field.onChange(applyCpfMask(e.target.value))
                      }
                      maxLength={14}
                      placeholder="000.000.000-00"
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                    />
                  )}
                />
                {errors.seller_cpf && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.seller_cpf.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  RG
                </label>
                <Controller
                  name="seller_rg"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="text"
                      {...field}
                      onChange={(e) =>
                        field.onChange(applyRgMask(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                    />
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  CEP *
                </label>
                <Controller
                  name="seller_cep"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="text"
                      {...field}
                      onChange={(e) =>
                        field.onChange(applyCepMask(e.target.value))
                      }
                      maxLength={9}
                      placeholder="00000-000"
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                    />
                  )}
                />
                {errors.seller_cep && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.seller_cep.message}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Endereço Completo *
                </label>
                <input
                  type="text"
                  {...register("seller_address", {
                  })}
                  placeholder="Rua, número, complemento, bairro, cidade - UF"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                />
                {errors.seller_address && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.seller_address.message}
                  </p>
                )}
              </div>

              <div className="md:col-span-2 border-t pt-4 mt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-subtle mb-3">
                  Dados bancários do vendedor
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Banco *
                </label>
                <input
                  type="text"
                  {...register("seller_bank", {
                  })}
                  placeholder="Ex: Itaú, Bradesco, Nubank"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                />
                {errors.seller_bank && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.seller_bank.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Agência *
                </label>
                <input
                  type="text"
                  {...register("seller_agency", {
                  })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                />
                {errors.seller_agency && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.seller_agency.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Conta Corrente *
                </label>
                <input
                  type="text"
                  {...register("seller_checking_account", {
                  })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                />
                {errors.seller_checking_account && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.seller_checking_account.message}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Seção: Comprador */}
          <section className="bg-surface rounded-lg border border-border p-6">
            <div className="flex items-center justify-between border-b pb-2 mb-4">
              <h3 className="text-base font-semibold text-ink">
                Comprador
              </h3>
              <span className="text-xs text-subtle bg-border-soft rounded px-2 py-0.5">
                Preenchido automaticamente — edite se necessário
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  {...register("buyer_name", { required: "Nome é obrigatório" })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                />
                {errors.buyer_name && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.buyer_name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  E-mail *
                </label>
                <input
                  type="email"
                  {...register("buyer_email", { required: "E-mail é obrigatório" })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                />
                {errors.buyer_email && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.buyer_email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  CPF *
                </label>
                <Controller
                  name="buyer_cpf"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="text"
                      {...field}
                      onChange={(e) =>
                        field.onChange(applyCpfMask(e.target.value))
                      }
                      maxLength={14}
                      placeholder="000.000.000-00"
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                    />
                  )}
                />
                {errors.buyer_cpf && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.buyer_cpf.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  RG
                </label>
                <Controller
                  name="buyer_rg"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="text"
                      {...field}
                      onChange={(e) =>
                        field.onChange(applyRgMask(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                    />
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  CEP *
                </label>
                <input
                  type="text"
                  {...register("buyer_cep")}
                  placeholder="00000-000"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                />
                {errors.buyer_cep && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.buyer_cep.message}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Endereço Completo *
                </label>
                <input
                  type="text"
                  {...register("buyer_address")}
                  placeholder="Rua, número, bairro, cidade — UF"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                />
                {errors.buyer_address && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.buyer_address.message}
                  </p>
                )}
              </div>
            </div>
          </section>
          </div>{/* end Dados das partes */}

          {/* ── Grupo: Dados do produto ── */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-subtle mb-3 px-1">
              Dados do produto
            </h2>

          {/* Seção: Veículo/Produto */}
          <section className="bg-surface rounded-lg border border-border p-6">
            <div className="flex items-center justify-between border-b pb-2 mb-4">
              <h3 className="text-base font-semibold text-ink">
                {getProductTypeLabel(prefillData?.product_type)}
              </h3>
              <span className="text-xs text-subtle bg-border-soft rounded px-2 py-0.5">
                Preenchido automaticamente — edite se necessário
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Marca e Modelo *
                </label>
                <input
                  type="text"
                  {...register("vehicle_model", {
                  })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                />
                {errors.vehicle_model && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.vehicle_model.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Ano *
                </label>
                <input
                  type="text"
                  {...register("vehicle_year", {
                  })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                />
                {errors.vehicle_year && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.vehicle_year.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  {getRegistrationLabel(prefillData?.product_type)} *
                </label>
                <input
                  type="text"
                  {...register("vehicle_registration_id", {
                  })}
                  placeholder={
                    prefillData?.product_type === "CAR"
                      ? "ABC-1234"
                      : prefillData?.product_type === "AIRCRAFT"
                        ? "PT-ABC"
                        : "Número de inscrição"
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                />
                {errors.vehicle_registration_id && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.vehicle_registration_id.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  {getSerialLabel(prefillData?.product_type)} *
                </label>
                <input
                  type="text"
                  {...register("vehicle_serial_number", {
                  })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                />
                {errors.vehicle_serial_number && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.vehicle_serial_number.message}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Informações Técnicas
                </label>
                <textarea
                  {...register("vehicle_technical_info")}
                  rows={2}
                  placeholder="Motor, cor, quilometragem, acessórios, etc."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent resize-none bg-surface"
                />
              </div>
            </div>
          </section>
          </div>{/* end Dados do produto */}

          {/* ── Grupo: Condições comerciais ── */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-subtle mb-3 px-1">
              Condições comerciais
            </h2>

          {/* Seção: Valores */}
          <section className="bg-surface rounded-lg border border-border p-6 mb-6">
            <div className="flex items-center justify-between border-b pb-2 mb-4">
              <h3 className="text-base font-semibold text-ink">
                Valores da Transação
              </h3>
              <span className="text-xs text-subtle bg-border-soft rounded px-2 py-0.5">
                Calculado automaticamente
              </span>
            </div>
            <input
              type="hidden"
              {...register("vehicle_price", { valueAsNumber: true })}
            />
            <input
              type="hidden"
              {...register("payment_seller_value", { valueAsNumber: true })}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  Valor Total do{" "}
                  {getProductTypeLabel(prefillData?.product_type)}
                </label>
                <div className="w-full px-3 py-2 bg-border-soft border border-border rounded-lg text-ink-soft cursor-default text-sm min-h-[38px] font-medium">
                  {vehiclePrice > 0 ? (
                    formatCurrency(vehiclePrice, prefillData.currency)
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </div>
                {errors.vehicle_price && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.vehicle_price.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Valor do Vendedor
                </label>
                <div className="w-full px-3 py-2 bg-border-soft border border-border rounded-lg text-ink-soft cursor-default text-sm min-h-[38px] font-medium">
                  {formatCurrency(sellerNetPreviewValue, prefillData.currency)}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Comissão Total
                </label>
                <div className="w-full px-3 py-2 bg-border-soft border border-border rounded-lg text-ink-soft cursor-default text-sm min-h-[38px] font-medium">
                  {formatCurrency(totalCommissionValue, prefillData.currency)}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Valor da Plataforma
                </label>
                <div className="w-full px-3 py-2 bg-border-soft border border-border rounded-lg text-ink-soft cursor-default text-sm min-h-[38px] font-medium">
                  {formatCurrency(platformValue, prefillData.currency)}
                </div>
              </div>

              {prefillData.office && (
                <div>
                  <label className="block text-sm font-medium text-ink-soft mb-1">
                    Valor do Escritório
                    <span className="text-xs text-muted ml-1">
                      ({officeRate.toFixed(2)}% da comissão)
                    </span>
                  </label>
                  <div className="w-full px-3 py-2 bg-border-soft border border-border rounded-lg text-ink-soft cursor-default text-sm min-h-[38px] font-medium">
                    {formatCurrency(officeValue, prefillData.currency)}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Valor do Especialista
                  <span className="text-xs text-muted ml-1">
                    ({specialistRate.toFixed(2)}% da comissão)
                  </span>
                </label>
                <div className="w-full px-3 py-2 bg-border-soft border border-border rounded-lg text-ink-soft cursor-default text-sm min-h-[38px] font-medium">
                  {formatCurrency(specialistValue, prefillData.currency)}
                </div>
              </div>
            </div>
          </section>

          {/* Seção: Dados da Plataforma */}
          <section className="hidden bg-surface rounded-lg border border-border p-6 mb-6">
            <div className="flex items-center justify-between border-b pb-2 mb-4">
              <h3 className="text-base font-semibold text-ink">
                Dados da Plataforma
              </h3>
              <span className="text-xs text-muted bg-border-soft rounded px-2 py-0.5">
                Pré-preenchido (editável)
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Razão Social *
                </label>
                <input
                  type="text"
                  {...register("platform_name")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface text-sm"
                  placeholder="Razão social da plataforma"
                />
                {errors.platform_name && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.platform_name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  CNPJ *
                </label>
                <input
                  type="text"
                  {...register("platform_cnpj")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface text-sm"
                  placeholder="00.000.000/0000-00"
                />
                {errors.platform_cnpj && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.platform_cnpj.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Banco *
                </label>
                <input
                  type="text"
                  {...register("platform_bank")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface text-sm"
                  placeholder="Banco"
                />
                {errors.platform_bank && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.platform_bank.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Agência *
                </label>
                <input
                  type="text"
                  {...register("platform_agency")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface text-sm"
                  placeholder="Agência"
                />
                {errors.platform_agency && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.platform_agency.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Conta Corrente *
                </label>
                <input
                  type="text"
                  {...register("platform_checking_account")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface text-sm"
                  placeholder="Conta corrente"
                />
                {errors.platform_checking_account && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.platform_checking_account.message}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Seção: Dados do Escritório */}
          <section className="hidden bg-surface rounded-lg border border-border p-6 mb-6">
            <div className="flex items-center justify-between border-b pb-2 mb-4">
              <h3 className="text-base font-semibold text-ink">
                Dados do Escritório
              </h3>
              <span className="text-xs text-muted bg-border-soft rounded px-2 py-0.5">
                Pré-preenchido (editável)
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Razão Social *
                </label>
                <input
                  type="text"
                  {...register("office_name")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface text-sm"
                  placeholder="Razão social do escritório"
                />
                {errors.office_name && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.office_name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  CNPJ *
                </label>
                <input
                  type="text"
                  {...register("office_cnpj")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface text-sm"
                  placeholder="00.000.000/0000-00"
                />
                {errors.office_cnpj && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.office_cnpj.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Banco
                </label>
                <input
                  type="text"
                  {...register("office_bank")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface text-sm"
                  placeholder="Banco"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Agência
                </label>
                <input
                  type="text"
                  {...register("office_agency")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface text-sm"
                  placeholder="Agência"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Conta Corrente
                </label>
                <input
                  type="text"
                  {...register("office_checking_account")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface text-sm"
                  placeholder="Conta corrente"
                />
              </div>
            </div>
          </section>

          {/* Seção: Dados do Especialista */}
          <section className="hidden bg-surface rounded-lg border border-border p-6">
            <div className="flex items-center justify-between border-b pb-2 mb-4">
              <h3 className="text-base font-semibold text-ink">
                Dados do Especialista
              </h3>
              <span className="text-xs text-muted bg-border-soft rounded px-2 py-0.5">
                Pré-preenchido (editável)
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  {...register("specialist_name")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface text-sm"
                  placeholder="Nome completo"
                />
                {errors.specialist_name && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.specialist_name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  E-mail *
                </label>
                <input
                  type="email"
                  {...register("specialist_email")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface text-sm"
                  placeholder="email@exemplo.com"
                />
                {errors.specialist_email && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.specialist_email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  CNPJ *
                </label>
                <input
                  type="text"
                  {...register("specialist_document")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface text-sm"
                  placeholder="00.000.000/0000-00"
                />
                {errors.specialist_document && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.specialist_document.message}
                  </p>
                )}
              </div>

              <div className="md:col-span-2 border-t pt-4 mt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-subtle mb-3">
                  Dados bancários do especialista — preencha abaixo
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Banco *
                </label>
                <input
                  type="text"
                  {...register("specialist_bank")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                  placeholder="Banco do especialista"
                />
                {errors.specialist_bank && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.specialist_bank.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Agência *
                </label>
                <input
                  type="text"
                  {...register("specialist_agency")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                  placeholder="Agência"
                />
                {errors.specialist_agency && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.specialist_agency.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Conta Corrente *
                </label>
                <input
                  type="text"
                  {...register("specialist_checking_account")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                  placeholder="Conta corrente"
                />
                {errors.specialist_checking_account && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.specialist_checking_account.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Valor da Comissão *
                </label>
                <div>
                  <input
                    type="text"
                    value={formatCurrency(specialistValue, prefillData.currency)}
                    readOnly
                    className="w-full px-3 py-2 border border-border rounded-lg bg-border-soft cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </section>
          </div>{/* end Condições comerciais */}

          {/* Seção: Testemunhas (Opcional) */}
          <section className="bg-surface rounded-lg border border-border p-6">
            <h2 className="text-base font-semibold text-ink mb-4 border-b pb-2">
              Testemunhas (Opcional)
            </h2>
            <p className="text-sm text-muted mb-4">
              Adicione até duas testemunhas para o contrato. Ambos os campos são
              opcionais.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Testemunha 1 */}
              <div className="md:col-span-2">
                <h3 className="text-sm font-semibold text-ink-soft mb-2">
                  Testemunha 1
                </h3>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  {...register("testimonial1_name")}
                  placeholder="Nome completo da testemunha 1"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  CPF
                </label>
                <Controller
                  name="testimonial1_cpf"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="text"
                      {...field}
                      maxLength={14}
                      placeholder="000.000.000-00"
                      onChange={(e) => {
                        const masked = applyCpfMask(e.target.value);
                        field.onChange(masked);
                      }}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent"
                    />
                  )}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  {...register("testimonial1_email")}
                  placeholder="testemunha1@email.com"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent"
                />
              </div>

              {/* Testemunha 2 */}
              <div className="md:col-span-2 mt-4">
                <h3 className="text-sm font-semibold text-ink-soft mb-2">
                  Testemunha 2
                </h3>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  {...register("testimonial2_name")}
                  placeholder="Nome completo da testemunha 2"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  CPF
                </label>
                <Controller
                  name="testimonial2_cpf"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="text"
                      {...field}
                      maxLength={14}
                      placeholder="000.000.000-00"
                      onChange={(e) => {
                        const masked = applyCpfMask(e.target.value);
                        field.onChange(masked);
                      }}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent"
                    />
                  )}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  {...register("testimonial2_email")}
                  placeholder="testemunha2@email.com"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent"
                />
              </div>
            </div>
          </section>

          {/* Seção: Cidade e Descrição */}
          <section className="bg-surface rounded-lg border border-border p-6">
            <h2 className="text-base font-semibold text-ink mb-4 border-b pb-2">
              Informações Adicionais
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Cidade de Assinatura *
                </label>
                <input
                  type="text"
                  {...register("city")}
                  placeholder="Ex: São Paulo"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
                />
                {errors.city && (
                  <p className="text-status-bad text-sm mt-1">
                    {errors.city.message}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Observações
                </label>
                <textarea
                  {...register("description")}
                  rows={3}
                  placeholder="Informações adicionais sobre o contrato..."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent resize-none bg-surface"
                />
              </div>
            </div>
          </section>

          {/* Submit Buttons */}
          <div className="flex flex-col gap-3 pt-2 pb-8">
            {/* Resumo de erros de validação (campos obrigatórios faltando) */}
            {Object.keys(errors).length > 0 && (
              <Alert variant="danger">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold mb-1">
                    Corrija os campos abaixo antes de pré-visualizar:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {Object.entries(errors).map(([key, err]) => (
                      <li key={key}>
                        {(err as { message?: string })?.message || key}
                      </li>
                    ))}
                  </ul>
                </div>
              </Alert>
            )}
            {/* Mensagem de erro/sucesso próximo aos botões */}
            {submitStatus.type && (
              <Alert variant={submitStatus.type === "success" ? "success" : "danger"}>
                {submitStatus.type === "success" ? (
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                )}
                <p className="text-sm">{submitStatus.message}</p>
              </Alert>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  submitStatus.type === "success" ||
                  !selectedTemplateId
                }
                className="flex-1 px-8 py-4 text-base shadow-sm"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Preparando preview...
                  </span>
                ) : submitStatus.type === "success" ? (
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Contrato Enviado
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Eye className="w-5 h-5" />
                    Pré-visualizar e Enviar Contrato
                  </span>
                )}
              </Button>
              <Button
                type="button"
                variant="light"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="sm:w-auto px-8 py-4"
              >
                Voltar
              </Button>
              <Button
                type="button"
                variant="light"
                onClick={() => navigate(-1)}
                disabled={isSubmitting}
                className="sm:w-auto px-8 py-4"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </form>
        )}
      </div>

      {/* Modal de Preview do Contrato */}
      {showPreviewModal && previewData && (
        <DocuSignPreviewModal
          previewUrl={previewData.preview_url}
          envelopeId={previewData.envelope_id}
          expiresAt={previewData.expires_at}
          onConfirm={handleConfirmSend}
          onCancel={handleCancelPreview}
          onExpired={handlePreviewExpired}
          isLoading={isSendingAfterPreview}
        />
      )}
    </div>
  );
}
