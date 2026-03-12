import {
  Check,
  ChevronDown,
  Edit2,
  ExternalLink,
  Loader,
  X,
  MessageSquare,
  CheckCircle,
  XCircle,
  Package,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Process } from "../services/processes.service";
import type { Product, SpecialityType } from "../types/types";
import React from "react";
import UpdateProcessStatusModal from "./UpdateProcessStatusModal";
import { getContextualStatusMessage } from "../utils/processStatusMessages";
import {
  getProcessCompletionReason,
  getProcessWithActiveContract,
  confirmAppointment,
  cancelAppointment,
} from "../services/processes.service";

interface ProcessCardProps {
  process: Process;
  product?:
    | Product
    | {
        id: number | string;
        marca?: string;
        modelo?: string;
        descricao?: string;
        ano?: number;
        estado?: string;
      };
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onUploadDocuments?: () => void;
  onStatusUpdated?: () => void;
  isClientView?: boolean; // Se true, remove botões de ação (apenas visualização)
  onSelectProduct?: () => void; // Callback para abrir seleção de produto em consultoria
  specialistSpeciality?: SpecialityType; // Especialidade do especialista para filtrar produtos
}

/**
 * Reusable component for displaying a single process with status stepper
 * Shows client name, progress timeline, product details, and actions
 */
export default function ProcessCard({
  process,
  product,
  isExpanded = false,
  onToggleExpand,
  onUploadDocuments,
  onStatusUpdated,
  isClientView = false,
  onSelectProduct,
  specialistSpeciality,
}: ProcessCardProps) {
  const navigate = useNavigate();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [completionReason, setCompletionReason] = useState<string | null>(null);
  const [activeContract, setActiveContract] = useState<any>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Verifica se é um processo de consultoria (sem produto atribuído)
  const isConsultancy = !process.product_type || !process.product_id;

  // Load completion reason and active contract on mount and when process changes
  useEffect(() => {
    const loadDetails = async () => {
      try {
        const [reason, processData] = await Promise.all([
          getProcessCompletionReason(process.id),
          getProcessWithActiveContract(process.id),
        ]);
        setCompletionReason(reason);
        setActiveContract(processData.activeContract);
        console.log(processData);
      } catch (error) {
        console.error("Error loading process details:", error);
      }
    };

    loadDetails();
  }, [process.id]);

  // Handle confirm appointment
  const handleConfirmAppointment = async () => {
    if (isConfirming) return;

    try {
      setIsConfirming(true);
      await confirmAppointment(process.id);
      onStatusUpdated?.();
    } catch (error) {
      console.error("Error confirming appointment:", error);
      alert("Erro ao confirmar agendamento. Tente novamente.");
    } finally {
      setIsConfirming(false);
    }
  };

  // Handle cancel appointment
  const handleCancelAppointment = async () => {
    if (isCancelling) return;

    const confirmed = window.confirm(
      isClientView
        ? "Deseja cancelar este agendamento? Esta ação não pode ser desfeita."
        : "Deseja recusar este agendamento? Esta ação não pode ser desfeita.",
    );

    if (!confirmed) return;

    try {
      setIsCancelling(true);
      await cancelAppointment(process.id);
      onStatusUpdated?.();
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      alert("Erro ao cancelar agendamento. Tente novamente.");
    } finally {
      setIsCancelling(false);
    }
  };

  // Map process status to step index
  // REJECTED substitui o último passo (COMPLETED)
  const statusSteps: Record<string, number> = {
    SCHEDULING: 0,
    NEGOTIATION: 1,
    PROCESSING_CONTRACT: 1.5, // Between NEGOTIATION and DOCUMENTATION
    DOCUMENTATION: 2,
    COMPLETED: 3,
    REJECTED: 3, // Mesmo índice que COMPLETED, mas com visual diferente
  };

  // Labels dinâmicos: se rejeitado, muda o último label
  const isRejected = process.status === "REJECTED";
  const stepLabels = isRejected
    ? ["Agendamento", "Negociação", "Documentação", "Rejeitado"]
    : ["Agendamento", "Negociação", "Documentação", "Concluído"];

  const currentStep = statusSteps[process.status] ?? 0;

  return (
    <div
      className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-100 overflow-hidden relative ${
        process.status === "NEGOTIATION" && onUploadDocuments && !isExpanded
          ? "pb-20"
          : ""
      }`}
    >
      {/* Negotiation button - always visible on NEGOTIATION status (visible for both specialist and client) */}
      {process.status === "NEGOTIATION" && !isExpanded && (
        <div className="hidden md:block absolute top-6 right-6 z-20">
          <button
            onClick={() => navigate(`/processes/${process.id}/negotiation`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs md:text-sm font-medium rounded-lg shadow-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <MessageSquare size={16} />
            Negociar
          </button>
        </div>
      )}
      {/* Upload Contract Button: For DOCUMENTATION status (hidden in client view) */}
      {process.status === "DOCUMENTATION" &&
        onUploadDocuments &&
        !isExpanded &&
        !isClientView && (
          <div className="hidden md:block absolute top-6 right-6 z-20">
            <button
              onClick={onUploadDocuments}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-xs md:text-sm font-medium rounded-lg shadow-lg hover:bg-orange-700 transition-colors whitespace-nowrap"
            >
              Enviar Contrato
            </button>
          </div>
        )}
      {/* Upload Documents Button: Fixed bottom right with margin, only when not expanded */}

      {/* Header: Process Title with Client and Product */}
      <div className="px-3 py-2 md:px-6 md:py-4 border-b border-gray-100 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm md:text-lg font-semibold text-gray-900 truncate">
            {isConsultancy ? "Consultoria" : "Processo"} - {process.client?.name || process.client_id} -{" "}
            {isConsultancy ? "Aguardando produto" : (product?.modelo || "Produto")}
          </h3>
          {isConsultancy && (
            <p className="text-xs text-amber-600 mt-1">
              Especialista precisa selecionar um produto
            </p>
          )}
        </div>
        {onToggleExpand && (
          <button
            onClick={onToggleExpand}
            className="p-1 hover:bg-gray-100 rounded transition shrink-0"
            aria-label="Toggle details"
          >
            <ChevronDown
              size={20}
              className={`transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </button>
        )}
      </div>

      {/* Stepper/Timeline - Vertical on mobile, Horizontal on tablet+ */}
      <div className="px-3 py-4 md:px-6 md:py-6">
        {/* Contextual Status Message - No redundant badge */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            {process.status === "PROCESSING_CONTRACT" && (
              <Loader size={18} className="animate-spin text-orange-600" />
            )}
            {isRejected && <X size={18} className="text-red-600" />}
            <p
              className={`text-sm font-medium ${
                isRejected ? "text-red-600" : "text-gray-700"
              }`}
            >
              {getContextualStatusMessage(
                process.status,
                completionReason,
                process.rejection_reason,
              )}
            </p>
          </div>
        </div>

        {/* Appointment Confirmation Buttons - SCHEDULING Status */}
        {process.status === "SCHEDULING" && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-amber-900 mb-2">
                {isClientView
                  ? "Aguardando confirmação do especialista"
                  : "Solicitação de agendamento"}
              </p>

              {!isClientView ? (
                // Specialist view - Confirm or Reject buttons
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelAppointment}
                    disabled={isCancelling || isConfirming}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    {isCancelling ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
                    ) : (
                      <>
                        <XCircle size={16} />
                        Recusar
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleConfirmAppointment}
                    disabled={isConfirming || isCancelling}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {isConfirming ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        Confirmar
                      </>
                    )}
                  </button>
                </div>
              ) : (
                // Client view - Only Cancel button
                <button
                  onClick={handleCancelAppointment}
                  disabled={isCancelling}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-50 border border-red-300 text-red-700 rounded-lg font-medium hover:bg-red-100 transition disabled:opacity-50"
                >
                  {isCancelling ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-700"></div>
                  ) : (
                    <>
                      <XCircle size={16} />
                      Cancelar Agendamento
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Consultancy - Select Product Button (Specialist View Only) */}
        {isConsultancy && !isClientView && onSelectProduct && (
          <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-purple-900 mb-1">
                Este é um processo de consultoria
              </p>
              <p className="text-xs text-purple-700 mb-2">
                Após a reunião com o cliente, selecione o produto recomendado para continuar com a negociação.
              </p>
              <button
                onClick={onSelectProduct}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition"
              >
                <Package size={16} />
                Selecionar Produto
              </button>
            </div>
          </div>
        )}

        {/* Consultancy - Client View Info */}
        {isConsultancy && isClientView && (
          <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm font-medium text-purple-900 mb-1">
              Processo de consultoria
            </p>
            <p className="text-xs text-purple-700">
              Após a reunião, o especialista irá selecionar o produto mais adequado para você.
            </p>
          </div>
        )}

        {/* Mobile: botões logo abaixo do status, antes do stepper */}
        {process.status === "NEGOTIATION" && !isExpanded && (
          <div className="md:hidden w-full mb-2 flex flex-col gap-2">
            <button
              onClick={() => navigate(`/processes/${process.id}/negotiation`)}
              className="w-full px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg shadow-lg hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-1"
            >
              <MessageSquare size={14} />
              Negociar
            </button>
          </div>
        )}

        {/* Mobile: botão para enviar contrato em DOCUMENTATION */}
        {process.status === "DOCUMENTATION" &&
          onUploadDocuments &&
          !isExpanded &&
          !isClientView && (
            <div className="md:hidden w-full mb-2 flex flex-col gap-2">
              <button
                onClick={onUploadDocuments}
                className="w-full px-4 py-2 bg-orange-600 text-white text-xs font-medium rounded-lg shadow-lg hover:bg-orange-700 transition-colors inline-flex items-center justify-center gap-1"
              >
                Enviar Contrato
              </button>
            </div>
          )}

        {/* Desabilitar upload enquanto processa contrato */}

        {/* Document Link: Show if in DOCUMENTATION or COMPLETED status and contract exists with S3 URL */}
        {(process.status === "DOCUMENTATION" ||
          process.status === "COMPLETED") &&
          activeContract && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600 font-medium">
                    Documento Enviado
                  </p>
                  <p className="text-sm text-blue-900 font-semibold truncate">
                    {activeContract.file_name || "Contrato"}
                  </p>
                </div>
                {activeContract.original_pdf_url ? (
                  <a
                    href={activeContract.original_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    Baixar
                    <ExternalLink size={14} />
                  </a>
                ) : (
                  <span className="text-xs text-gray-500 italic">
                    Documento disponível para download na plataforma Docusign
                  </span>
                )}
              </div>
            </div>
          )}

        <div className="hidden md:flex md:items-center md:justify-between">
          {/* Horizontal Stepper (Tablet and up) */}
          {stepLabels.map((label, index) => {
            const isCompleted = index <= currentStep;
            const isActive = index === currentStep;
            const isRejectedStep = isRejected && index === 3; // Último step quando rejeitado

            return (
              <React.Fragment key={index}>
                {/* Step Circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                      isRejectedStep
                        ? "bg-red-500 text-white"
                        : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-gray-300 text-gray-600"
                    } ${
                      isActive && !isRejectedStep
                        ? "ring-2 ring-green-300 ring-offset-2"
                        : ""
                    } ${
                      isRejectedStep ? "ring-2 ring-red-300 ring-offset-2" : ""
                    }`}
                  >
                    {isRejectedStep && <X size={20} />}
                    {!isRejectedStep && isCompleted && <Check size={20} />}
                    {!isRejectedStep && !isCompleted && (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium mt-2 text-center max-w-20 ${
                      isRejectedStep
                        ? "text-red-600"
                        : isCompleted
                          ? "text-gray-900"
                          : "text-gray-500"
                    }`}
                  >
                    {label}
                  </span>
                </div>

                {/* Connecting Line (not on last step) */}
                {index < stepLabels.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 transition-all ${
                      isRejected && index >= currentStep - 1
                        ? "bg-red-400"
                        : index < currentStep
                          ? "bg-green-500"
                          : "bg-gray-300"
                    }`}
                    style={{ minWidth: "40px" }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Vertical Stepper (Mobile only) */}
        <div className="flex md:hidden flex-col">
          {stepLabels.map((label, index) => {
            const isCompleted = index <= currentStep;
            const isActive = index === currentStep;
            const isRejectedStep = isRejected && index === 3; // Último step quando rejeitado

            return (
              <div key={index} className="flex gap-3">
                <div className="flex flex-col items-center">
                  {/* Step Circle */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold transition-all shrink-0 ${
                      isRejectedStep
                        ? "bg-red-500 text-white"
                        : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-gray-300 text-gray-600"
                    } ${
                      isActive && !isRejectedStep
                        ? "ring-2 ring-green-300 ring-offset-1"
                        : ""
                    } ${
                      isRejectedStep ? "ring-2 ring-red-300 ring-offset-1" : ""
                    }`}
                  >
                    {isRejectedStep && <X size={16} />}
                    {!isRejectedStep && isCompleted && <Check size={16} />}
                    {!isRejectedStep && !isCompleted && (
                      <span className="text-xs">{index + 1}</span>
                    )}
                  </div>

                  {/* Vertical Line (not on last step) */}
                  {index < stepLabels.length - 1 && (
                    <div
                      className={`w-1 h-6 transition-all ${
                        isRejected && index >= currentStep - 1
                          ? "bg-red-400"
                          : index < currentStep
                            ? "bg-green-500"
                            : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>

                {/* Step Label */}
                <div className="pb-6 flex items-center md:hidden">
                  <span
                    className={`text-xs font-medium ${
                      isRejectedStep
                        ? "text-red-600"
                        : isCompleted
                          ? "text-gray-900"
                          : "text-gray-500"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expandable Details Section */}
      {isExpanded && (
        <div className="px-3 py-4 md:px-6 md:py-4 bg-gray-50 border-t border-gray-100">
          {product && (
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                <div>
                  <p className="text-xs text-gray-600 font-medium">Categoria</p>
                  <p className="text-xs md:text-sm font-semibold text-gray-900 truncate">
                    {process.product_type === "CAR"
                      ? "Carro"
                      : process.product_type === "BOAT"
                        ? "Barco"
                        : "Aeronave"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-medium">Modelo</p>
                  <p className="text-xs md:text-sm font-semibold text-gray-900 truncate">
                    {product.modelo}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-medium">Ano</p>
                  <p className="text-xs md:text-sm font-semibold text-gray-900">
                    {product.ano}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-medium">Estado</p>
                  <p className="text-xs md:text-sm font-semibold text-gray-900 truncate">
                    {product.estado || "Não especificado"}
                  </p>
                </div>
              </div>

              {/* Description */}
              {product.descricao && (
                <div>
                  <p className="text-xs text-gray-600 font-medium mb-1">
                    Descrição
                  </p>
                  <p className="text-xs md:text-sm text-gray-700 line-clamp-3">
                    {product.descricao}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-3 border-t border-gray-200">
            {/* Update Status Button */}
            <button
              onClick={() => setShowUpdateModal(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 md:px-4 md:py-2 border border-slate-700 text-slate-700 text-xs md:text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Edit2 size={16} />
              Alterar Status
            </button>

            {/* Negotiation Button: Only show if status is NEGOTIATION */}
            {process.status === "NEGOTIATION" && (
              <button
                onClick={() => navigate(`/processes/${process.id}/negotiation`)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-blue-600 text-white text-xs md:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                <MessageSquare size={16} />
                Ver Negociação
              </button>
            )}

            {/* Upload Contract Button: Only show if status is DOCUMENTATION */}
            {process.status === "DOCUMENTATION" && onUploadDocuments && (
              <button
                onClick={onUploadDocuments}
                className="flex-1 px-3 py-2 md:px-4 md:py-2 bg-orange-600 text-white text-xs md:text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap"
              >
                Enviar Contrato
              </button>
            )}
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      <UpdateProcessStatusModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onSuccess={() => {
          setShowUpdateModal(false);
          onStatusUpdated?.();
        }}
        process={process}
      />
    </div>
  );
}
