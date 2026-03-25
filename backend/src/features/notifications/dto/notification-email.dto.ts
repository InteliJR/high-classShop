/**
 * DTOs para o sistema de notificações por email
 * Organização por categoria: Appointments, Proposals, Contracts
 */

// ============================================================================
// APPOINTMENT NOTIFICATIONS
// ============================================================================

export interface AppointmentConfirmedEmailDto {
  clientEmail: string;
  clientName: string;
  specialistName: string;
  appointmentDate: Date;
  productDetails: string;
  processId: string;
}

export interface AppointmentCreatedEmailDto {
  specialistEmail: string;
  specialistName: string;
  clientName: string;
  appointmentDate: Date;
  productDetails: string;
  processId: string;
}

export interface AppointmentCancelledEmailDto {
  recipientEmail: string;
  recipientName: string;
  cancellerName: string;
  wasClient: boolean;
  appointmentDate: Date;
  productDetails: string;
}

export interface MeetingStartedEmailDto {
  clientEmail: string;
  clientName: string;
  specialistName: string;
  processId: string;
  platformMeetingUrl: string;
  meetingLink?: string;
}

// ============================================================================
// PROPOSAL NOTIFICATIONS
// ============================================================================

export interface ProposalReceivedEmailDto {
  recipientEmail: string;
  recipientName: string;
  proposerName: string;
  proposedValue: number;
  originalValue: number;
  message?: string;
  processId: string;
}

export interface ProposalAcceptedEmailDto {
  proposerEmail: string;
  proposerName: string;
  recipientName: string;
  acceptedValue: number;
  processId: string;
}

export interface ProposalRejectedEmailDto {
  proposerEmail: string;
  proposerName: string;
  recipientName: string;
  rejectedValue: number;
  processId: string;
}

// ============================================================================
// CONTRACT NOTIFICATIONS
// ============================================================================

export interface ContractSignedEmailDto {
  buyerEmail: string;
  buyerName: string;
  sellerEmail: string;
  sellerName: string;
  contractId: string;
  vehicleModel: string;
  finalPrice: number;
  signedPdfUrl?: string;
}

export interface ContractGeneratedEmailDto {
  buyerEmail: string;
  buyerName: string;
  sellerEmail: string;
  sellerName: string;
  contractId: string;
  vehicleDetails: string;
  processId: string;
}

export interface ContractSentEmailDto {
  buyerEmail: string;
  buyerName: string;
  sellerEmail: string;
  sellerName: string;
  docusignLink: string;
  contractId: string;
}

export interface ContractStatusChangedEmailDto {
  specialistEmail: string;
  specialistName: string;
  clientEmail: string;
  clientName: string;
  declinedBy?: string;
  contractId: string;
  vehicleDetails: string;
}
