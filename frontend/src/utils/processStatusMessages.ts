/**
 * Utility functions for process status messages and colors
 */

type ProcessStatus =
  | "SCHEDULING"
  | "NEGOTIATION"
  | "PROCESSING_CONTRACT"
  | "DOCUMENTATION"
  | "COMPLETED"
  | "REJECTED";

/**
 * Maps process status to a user-friendly step label
 * @param status - The process status
 * @returns User-friendly step label
 */
export function getProcessStatusMessage(status: ProcessStatus): string {
  const messages: Record<ProcessStatus, string> = {
    SCHEDULING: "Agendamento",
    NEGOTIATION: "Negociação",
    PROCESSING_CONTRACT: "Processando Contrato",
    DOCUMENTATION: "Documentação",
    COMPLETED: "Completo",
    REJECTED: "Rejeitado",
  };

  return messages[status] || status;
}

/**
 * Maps process status to a Tailwind CSS color class
 * @param status - The process status
 * @returns Tailwind CSS color class
 */
export function getProcessStatusColor(status: ProcessStatus): string {
  const colors: Record<ProcessStatus, string> = {
    SCHEDULING: "bg-blue-100 text-blue-800 border-blue-300",
    NEGOTIATION: "bg-yellow-100 text-yellow-800 border-yellow-300",
    PROCESSING_CONTRACT: "bg-orange-100 text-orange-800 border-orange-300",
    DOCUMENTATION: "bg-purple-100 text-purple-800 border-purple-300",
    COMPLETED: "bg-green-100 text-green-800 border-green-300",
    REJECTED: "bg-red-100 text-red-800 border-red-300",
  };

  return colors[status] || "bg-gray-100 text-gray-800 border-gray-300";
}

/**
 * Maps completion reason to a user-friendly message
 * @param reason - The completion reason
 * @returns User-friendly message
 */
export function getCompletionReasonMessage(
  reason: string | null | undefined
): string {
  if (!reason) return "Razão desconhecida";

  const messages: Record<string, string> = {
    CONTRACT_SIGNED: "Contrato assinado com sucesso",
    CLIENT_DECLINED: "Cliente recusou o contrato",
    CONTRACT_VOIDED: "Contrato foi cancelado",
    CONTRACT_TIMEDOUT: "Contrato expirou",
  };

  return messages[reason] || "Razão desconhecida";
}

/**
 * Generates a contextual message based on status and completion reason
 * Replaces the redundant status badge message
 * @param status - The process status
 * @param completionReason - The reason if status is COMPLETED
 * @param rejectionReason - The reason if status is REJECTED
 * @returns Contextual message for the user
 */
export function getContextualStatusMessage(
  status: ProcessStatus,
  completionReason?: string | null,
  rejectionReason?: string | null
): string {
  if (status === "SCHEDULING") {
    return "Agendamento em progresso";
  }

  if (status === "NEGOTIATION") {
    return "Aguardando envio de contrato";
  }

  if (status === "PROCESSING_CONTRACT") {
    return "Seu contrato está sendo processado. Isso pode levar alguns segundos...";
  }

  if (status === "DOCUMENTATION") {
    return "Aguardando assinatura do contrato";
  }

  if (status === "COMPLETED" && completionReason) {
    return getCompletionReasonMessage(completionReason);
  }

  if (status === "COMPLETED") {
    return "Processo concluído";
  }

  if (status === "REJECTED") {
    return rejectionReason
      ? `Processo rejeitado: ${rejectionReason}`
      : "Processo foi rejeitado";
  }

  return "Status desconhecido";
}

/**
 * Determines if a process is in a final state (completed, rejected or failed)
 * @param status - The process status
 * @returns Boolean indicating if process is final
 */
export function isProcessFinal(status: ProcessStatus): boolean {
  return status === "COMPLETED" || status === "REJECTED";
}

/**
 * Determines if a process can still be negotiated
 * @param status - The process status
 * @returns Boolean indicating if process is in negotiation
 */
export function isProcessInNegotiation(status: ProcessStatus): boolean {
  return status === "NEGOTIATION";
}

/**
 * Determines if a process is waiting for documentation
 * @param status - The process status
 * @returns Boolean indicating if process is in documentation stage
 */
export function isProcessInDocumentation(status: ProcessStatus): boolean {
  return status === "DOCUMENTATION";
}
