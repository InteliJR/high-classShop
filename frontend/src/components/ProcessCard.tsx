import { Check, ChevronDown, Edit2 } from "lucide-react";
import { useState } from "react";
import type { Process } from "../services/processes.service";
import type { Product } from "../types/types";
import React from "react";
import UpdateProcessStatusModal from "./UpdateProcessStatusModal";

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
}: ProcessCardProps) {
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Map process status to step index
  const statusSteps: Record<Process["status"], number> = {
    SCHEDULING: 0,
    NEGOTIATION: 1,
    DOCUMENTATION: 2,
    COMPLETED: 3,
  };

  const stepLabels = ["Agendamento", "Negociação", "Documentação", "Concluído"];

  const currentStep = statusSteps[process.status];

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-100 overflow-hidden">
      {/* Header: Process Title with Client and Product */}
      <div className="px-3 py-2 md:px-6 md:py-4 border-b border-gray-100 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm md:text-lg font-semibold text-gray-900 truncate">
            Processo - {process.client?.name || process.client_id} -{" "}
            {product?.modelo || "Produto"}
          </h3>
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
        <div className="hidden md:flex md:items-center md:justify-between">
          {/* Horizontal Stepper (Tablet and up) */}
          {stepLabels.map((label, index) => {
            const isCompleted = index <= currentStep;
            const isActive = index === currentStep;

            return (
              <React.Fragment key={index}>
                {/* Step Circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                      isCompleted
                        ? "bg-green-500 text-white"
                        : "bg-gray-300 text-gray-600"
                    } ${isActive ? "ring-2 ring-green-300 ring-offset-2" : ""}`}
                  >
                    {isCompleted && <Check size={20} />}
                    {!isCompleted && <span>{index + 1}</span>}
                  </div>
                  <span
                    className={`text-xs font-medium mt-2 text-center max-w-20 ${
                      isCompleted ? "text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {label}
                  </span>
                </div>

                {/* Connecting Line (not on last step) */}
                {index < stepLabels.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 transition-all ${
                      index < currentStep ? "bg-green-500" : "bg-gray-300"
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

            return (
              <div key={index} className="flex gap-3">
                <div className="flex flex-col items-center">
                  {/* Step Circle */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold transition-all shrink-0 ${
                      isCompleted
                        ? "bg-green-500 text-white"
                        : "bg-gray-300 text-gray-600"
                    } ${isActive ? "ring-2 ring-green-300 ring-offset-1" : ""}`}
                  >
                    {isCompleted && <Check size={16} />}
                    {!isCompleted && (
                      <span className="text-xs">{index + 1}</span>
                    )}
                  </div>

                  {/* Vertical Line (not on last step) */}
                  {index < stepLabels.length - 1 && (
                    <div
                      className={`w-1 h-6 transition-all ${
                        index < currentStep ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>

                {/* Step Label */}
                <div className="pb-6 flex items-center md:hidden">
                  <span
                    className={`text-xs font-medium ${
                      isCompleted ? "text-gray-900" : "text-gray-500"
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

            {/* Upload Documents Button: Only show if status is NEGOTIATION */}
            {process.status === "NEGOTIATION" && onUploadDocuments && (
              <button
                onClick={onUploadDocuments}
                className="flex-1 px-3 py-2 md:px-4 md:py-2 bg-slate-700 text-white text-xs md:text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Subir documentos
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
