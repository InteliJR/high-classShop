/**
 * Utility functions for process status messages and colors
 */

type ProcessStatus =
  | "SCHEDULING"
  | "NEGOTIATION"
  | "DOCUMENTATION"
  | "COMPLETED";

/**
 * Maps process status to a user-friendly step label
 * @param status - The process status
 * @returns User-friendly step label
 */
export function getProcessStatusMessage(status: ProcessStatus): string {
  const messages: Record<ProcessStatus, string> = {
    SCHEDULING: "Agendamento",
    NEGOTIATION: "Negociação",
    DOCUMENTATION: "Documentação",
    COMPLETED: "Completo",
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
    DOCUMENTATION: "bg-purple-100 text-purple-800 border-purple-300",
    COMPLETED: "bg-green-100 text-green-800 border-green-300",
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
 * @returns Contextual message for the user
 */
export function getContextualStatusMessage(
  status: ProcessStatus,
  completionReason?: string | null
): string {
  if (status === "SCHEDULING") {
    return "Agendamento em progresso";
  }

  if (status === "NEGOTIATION") {
    return "Aguardando envio de contrato";
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

  return "Status desconhecido";
}

/**
 * Determines if a process is in a final state (completed or failed)
 * @param status - The process status
 * @returns Boolean indicating if process is final
 */
export function isProcessFinal(status: ProcessStatus): boolean {
  return status === "COMPLETED";
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
