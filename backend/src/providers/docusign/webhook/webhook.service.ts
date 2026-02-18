import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { mapDocusignStatusToProviderStatus } from '../mappers/envelope-status.mapper';
import { ProcessCompletionReason } from '@prisma/client';
import { NotificationService } from 'src/features/notifications/notification.service';

/**
 * Tipos de eventos suportados na webhooks v2.1 event-based
 */
type DocuSignEventType =
  | 'envelope-created'
  | 'envelope-sent'
  | 'envelope-delivered'
  | 'envelope-completed'
  | 'envelope-declined'
  | 'envelope-voided'
  | 'envelope-timedout';

/**
 * Payload de webhook v2.1 event-based da DocuSign
 */
interface WebhookPayloadV21 {
  event: DocuSignEventType;
  apiVersion: string;
  uri: string;
  retryCount: number;
  configurationId: number;
  generatedDateTime: string;
  data: {
    accountId: string;
    userId: string;
    envelopeId: string;
  };
}

/**
 * Mapeamento de status provider para status do contrato
 */
const PROVIDER_STATUS_TO_CONTRACT_STATUS: Record<string, string> = {
  created: 'PENDING',
  sent: 'PENDING',
  delivered: 'PENDING',
  completed: 'SIGNED',
  declined: 'REJECTED',
  voided: 'REJECTED',
  timeout: 'REJECTED',
  error: 'REJECTED',
};

/**
 * Serviço para processar webhooks da DocuSign.
 *
 * Responsabilidades:
 * - Extrair informações do evento webhook v2.1 event-based
 * - Validar e mapear eventos para status internos
 * - Atualizar status do contrato no banco de dados
 *
 * Suporta webhooks v2.1 event-based no formato:
 * {
 *   "event": "envelope-completed",
 *   "apiVersion": "v2.1",
 *   "uri": "/restapi/v2.1/accounts/{accountId}/envelopes/{envelopeId}",
 *   "retryCount": 0,
 *   "configurationId": 22002156,
 *   "generatedDateTime": "2025-12-17T14:44:34.1826724Z",
 *   "data": {
 *     "accountId": "uuid",
 *     "userId": "uuid",
 *     "envelopeId": "uuid"
 *   }
 * }
 */
@Injectable()
export class DocuSignWebhookService {
  private readonly logger = new Logger(DocuSignWebhookService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Valida se o payload é um webhook v2.1 event-based válido
   *
   * @param payload - Payload a validar
   * @returns true se válido, false caso contrário
   */
  private isValidWebhookPayload(payload: any): payload is WebhookPayloadV21 {
    return (
      payload &&
      typeof payload === 'object' &&
      payload.event && // Campo obrigatório
      payload.data &&
      typeof payload.data === 'object' &&
      payload.data.envelopeId && // Campo obrigatório
      typeof payload.data.envelopeId === 'string' &&
      payload.data.envelopeId.trim().length > 0
    );
  }

  /**
   * Mapeia evento DocuSign para status provider
   *
   * @param event - Evento do webhook
   * @returns Status provider correspondente
   */
  private mapEventToProviderStatus(event: string): string | null {
    return (
      mapDocusignStatusToProviderStatus(event.replace('envelope-', '')) || null
    );
  }

  /**
   * Mapeia status provider para status do contrato
   *
   * @param providerStatus - Status do provider
   * @returns Status do contrato (PENDING, SIGNED, REJECTED)
   */
  private mapProviderStatusToContractStatus(
    providerStatus: string,
  ): 'PENDING' | 'SIGNED' | 'REJECTED' {
    return (
      (PROVIDER_STATUS_TO_CONTRACT_STATUS[providerStatus] as
        | 'PENDING'
        | 'SIGNED'
        | 'REJECTED') || 'PENDING'
    );
  }

  /**
   * Processa um evento de webhook da DocuSign v2.1 event-based.
   *
   * Fluxo de processamento:
   * 1. Validar estructura do payload
   * 2. Extrair envelope ID e tipo de evento
   * 3. Mapear evento para status provider
   * 4. Buscar contrato pelo provider_id (envelope ID)
   * 5. Atualizar contrato com novo status
   * 6. Armazenar metadata do evento para auditoria
   *
   * @param payload - Payload do webhook recebido da DocuSign
   * @throws Não relança erros (log apenas) para evitar retry infinito
   *
   * @example
   * Entrada:
   * {
   *   "event": "envelope-completed",
   *   "data": { "envelopeId": "uuid-123" },
   *   "generatedDateTime": "2025-12-17T14:44:34.1826724Z",
   *   ...
   * }
   *
   * Saída:
   * Contrato atualizado com status SIGNED
   */
  async handleEnvelopeStatusChanged(payload: any): Promise<void> {
    try {
      // ===== ETAPA 1: VALIDAR PAYLOAD =====

      if (!this.isValidWebhookPayload(payload)) {
        this.logger.warn(
          'Webhook recebido com payload inválido ou incompleto',
          {
            hasEvent: !!payload?.event,
            hasData: !!payload?.data,
            hasEnvelopeId: !!payload?.data?.envelopeId,
            payloadKeys: Object.keys(payload || {}),
          },
        );
        return;
      }

      // ===== ETAPA 2: EXTRAIR INFORMAÇÕES =====

      const {
        event,
        data: { envelopeId },
        generatedDateTime,
      } = payload;

      this.logger.debug(`Processando webhook v2.1 event-based`, {
        event,
        envelopeId,
        generatedDateTime,
        apiVersion: payload.apiVersion,
        retryCount: payload.retryCount,
      });

      // ===== ETAPA 3: MAPEAR EVENTO PARA STATUS PROVIDER =====

      const providerStatus = this.mapEventToProviderStatus(event);

      if (!providerStatus) {
        this.logger.warn(
          `Evento DocuSign desconhecido ou não mapeado: ${event}`,
        );
        return;
      }

      this.logger.debug(`Evento mapeado: ${event} → ${providerStatus}`);

      // ===== ETAPA 4: BUSCAR CONTRATO PELO ENVELOPE ID =====

      const contract = await this.prismaService.contract.findFirst({
        where: {
          provider_id: envelopeId,
        },
      });

      if (!contract) {
        this.logger.warn(
          `Contrato não encontrado para envelope: ${envelopeId}`,
          {
            event,
            envelopeId,
            accountId: payload.data.accountId,
          },
        );
        return;
      }

      this.logger.log(
        `Contrato encontrado para envelope ${envelopeId}: ${contract.id}`,
      );

      // ===== ETAPA 5: MAPEAR STATUS PARA CONTRATO =====

      const contractStatus =
        this.mapProviderStatusToContractStatus(providerStatus);

      this.logger.debug(
        `Status mapeado: ${providerStatus} → ${contractStatus}`,
      );

      // ===== ETAPA 6: PREPARAR DADOS DE ATUALIZAÇÃO =====

      const updateData: any = {
        provider_status: providerStatus,
        status: contractStatus,
        provider_meta: {
          ...(contract.provider_meta as Record<string, any>),
          lastWebhookEvent: event,
          lastWebhookReceivedAt: new Date().toISOString(),
          webhookGeneratedDateTime: generatedDateTime,
          webhookRetryCount: payload.retryCount,
          webhookConfigurationId: payload.configurationId,
          apiVersion: payload.apiVersion,
        },
        signed_at: new Date(),
      };

      // Apenas atualizar signed_at se completado (evento de assinatura final)
      if (providerStatus === 'COMPLETED' && !contract.signed_at) {
        // Usar data do webhook como signed_at (moment da assinatura)
        updateData.signed_at = new Date(generatedDateTime);
        this.logger.log(
          `Contrato marcado como assinado em: ${generatedDateTime}`,
        );
      }

      // ===== ETAPA 7: ATUALIZAR CONTRATO E SINCRONIZAR PROCESSO =====

      const updated = await this.prismaService.$transaction(async (tx) => {
        // 7.1 Atualizar contrato
        const updatedContract = await tx.contract.update({
          where: { id: contract.id },
          data: updateData,
        });

        this.logger.log(`✓ Contrato atualizado com sucesso`, {
          contractId: contract.id,
          event,
          envelopeId,
          providerStatus,
          contractStatus,
          isSigned: contractStatus === 'SIGNED',
        });

        // 7.2 Buscar processo relacionado
        const process = await tx.process.findUnique({
          where: { id: contract.process_id },
          select: { id: true, status: true, active_contract_id: true },
        });

        if (!process) {
          this.logger.warn(
            `Processo não encontrado para contrato: ${contract.id}`,
          );
          return updatedContract;
        }

        // 7.3 Sincronizar status do processo com base no status do contrato
        let processStatusUpdate: any = {};
        let updateProcessActiveContract = false;

        if (
          providerStatus === 'SENT' &&
          (process.status === 'NEGOTIATION' ||
            process.status === 'PROCESSING_CONTRACT')
        ) {
          // Envelope foi enviado → mudar processo de NEGOTIATION/PROCESSING_CONTRACT para DOCUMENTATION
          processStatusUpdate.status = 'DOCUMENTATION';
          updateProcessActiveContract = true;
          this.logger.log(
            `[SYNC] Processo ${process.id}: ${process.status} → DOCUMENTATION (contrato enviado)`,
          );
        } else if (providerStatus === 'COMPLETED') {
          // Envelope foi assinado → mudar processo para COMPLETED
          processStatusUpdate.status = 'COMPLETED';
          updateProcessActiveContract = true;
          this.logger.log(
            `[SYNC] Processo ${process.id}: → COMPLETED (contrato assinado)`,
          );
          // Registrar razão de conclusão
          await tx.processStatusHistory.create({
            data: {
              processId: process.id,
              reason: ProcessCompletionReason.CONTRACT_SIGNED,
            },
          });
        } else if (
          ['DECLINED', 'VOIDED', 'TIMEDOUT'].includes(providerStatus)
        ) {
          // Envelope foi recusado/cancelado/expirou → marcar processo como REJECTED
          processStatusUpdate.status = 'REJECTED';
          processStatusUpdate.active_contract_id = null;
          this.logger.log(
            `[SYNC] Processo ${process.id}: → REJECTED (contrato ${providerStatus})`,
          );
          // Registrar razão de conclusão baseada no status do provider
          let completionReason: ProcessCompletionReason =
            ProcessCompletionReason.CLIENT_DECLINED;
          if (providerStatus === 'VOIDED') {
            completionReason = ProcessCompletionReason.CONTRACT_VOIDED;
          } else if (providerStatus === 'TIMEDOUT') {
            completionReason = ProcessCompletionReason.CONTRACT_TIMEDOUT;
          }
          await tx.processStatusHistory.create({
            data: {
              processId: process.id,
              reason: completionReason,
            },
          });
        } else if (process.active_contract_id === contract.id) {
          // Se este é o contrato ativo, manter status como está
          updateProcessActiveContract = true;
        }

        // 7.4 Atualizar processo se necessário
        if (
          Object.keys(processStatusUpdate).length > 0 ||
          updateProcessActiveContract
        ) {
          if (
            updateProcessActiveContract &&
            !processStatusUpdate.active_contract_id
          ) {
            processStatusUpdate.active_contract_id = contract.id;
          }

          await tx.process.update({
            where: { id: process.id },
            data: processStatusUpdate,
          });

          this.logger.log(`[SYNC] Processo atualizado:`, {
            processId: process.id,
            statusBefore: process.status,
            statusAfter: processStatusUpdate.status || process.status,
            activeContractId:
              processStatusUpdate.active_contract_id !== undefined
                ? processStatusUpdate.active_contract_id
                : process.active_contract_id,
          });
        }

        return updatedContract;
      });

      // ===== ETAPA 8: ENVIAR NOTIFICAÇÕES (Fire-and-forget) =====

      // Buscar dados do contrato para notificações
      const contractWithDetails = await this.prismaService.contract.findUnique({
        where: { id: contract.id },
        select: {
          id: true,
          buyer_name: true,
          seller_name: true,
          vehicle_model: true,
          vehicle_year: true,
          vehicle_price: true,
          process: {
            select: {
              client: { select: { email: true, name: true, surname: true } },
              specialist: { select: { email: true, name: true, surname: true } },
            },
          },
        },
      });

      if (contractWithDetails) {
        const buyerEmail = contractWithDetails.process?.client?.email;
        const buyerName = contractWithDetails.buyer_name || 
          `${contractWithDetails.process?.client?.name || ''} ${contractWithDetails.process?.client?.surname || ''}`.trim();
        const sellerEmail = contractWithDetails.process?.specialist?.email;
        const sellerName = contractWithDetails.seller_name ||
          `${contractWithDetails.process?.specialist?.name || ''} ${contractWithDetails.process?.specialist?.surname || ''}`.trim();
        const vehicleDetails = `${contractWithDetails.vehicle_model || ''} ${contractWithDetails.vehicle_year || ''}`.trim();

        setImmediate(() => {
          // Notificar baseado no status
          if (providerStatus === 'SENT' && buyerEmail && sellerEmail) {
            this.notificationService
              .sendContractSentEmail({
                buyerEmail,
                buyerName,
                sellerEmail,
                sellerName,
                docusignLink: `https://app.docusign.com/documents/details/${envelopeId}`,
                contractId: contract.id,
              })
              .catch((err) => {
                this.logger.error('Notification failed (non-critical)', {
                  method: 'handleEnvelopeStatusChanged',
                  event: 'SENT',
                  contractId: contract.id,
                  error: err.message,
                });
              });
          } else if (providerStatus === 'COMPLETED' && buyerEmail && sellerEmail) {
            this.notificationService
              .sendContractSignedEmail({
                buyerEmail,
                buyerName,
                sellerEmail,
                sellerName,
                contractId: contract.id,
                vehicleModel: vehicleDetails,
                finalPrice: Number(contractWithDetails.vehicle_price) || 0,
              })
              .catch((err) => {
                this.logger.error('Notification failed (non-critical)', {
                  method: 'handleEnvelopeStatusChanged',
                  event: 'COMPLETED',
                  contractId: contract.id,
                  error: err.message,
                });
              });
          } else if (providerStatus === 'DECLINED' && sellerEmail) {
            this.notificationService
              .sendContractDeclinedEmail({
                specialistEmail: sellerEmail,
                specialistName: sellerName,
                clientEmail: buyerEmail || '',
                clientName: buyerName,
                contractId: contract.id,
                vehicleDetails,
              })
              .catch((err) => {
                this.logger.error('Notification failed (non-critical)', {
                  method: 'handleEnvelopeStatusChanged',
                  event: 'DECLINED',
                  contractId: contract.id,
                  error: err.message,
                });
              });
          } else if (providerStatus === 'VOIDED' && sellerEmail) {
            this.notificationService
              .sendContractVoidedEmail({
                specialistEmail: sellerEmail,
                specialistName: sellerName,
                clientEmail: buyerEmail || '',
                clientName: buyerName,
                contractId: contract.id,
                vehicleDetails,
              })
              .catch((err) => {
                this.logger.error('Notification failed (non-critical)', {
                  method: 'handleEnvelopeStatusChanged',
                  event: 'VOIDED',
                  contractId: contract.id,
                  error: err.message,
                });
              });
          } else if (providerStatus === 'TIMEDOUT' && sellerEmail) {
            this.notificationService
              .sendContractTimeoutEmail({
                specialistEmail: sellerEmail,
                specialistName: sellerName,
                clientEmail: buyerEmail || '',
                clientName: buyerName,
                contractId: contract.id,
                vehicleDetails,
              })
              .catch((err) => {
                this.logger.error('Notification failed (non-critical)', {
                  method: 'handleEnvelopeStatusChanged',
                  event: 'TIMEDOUT',
                  contractId: contract.id,
                  error: err.message,
                });
              });
          }
        });
      }

      // ===== ETAPA 9: LOG DE AUDITORIA =====

      this.logger.debug(`Estado anterior vs novo:`, {
        before: {
          provider_status: contract.provider_status,
          status: contract.status,
          signed_at: contract.signed_at,
        },
        after: {
          provider_status: updated.provider_status,
          status: updated.status,
          signed_at: updated.signed_at,
        },
      });
    } catch (error) {
      // Não relançar erro para evitar retry infinito de webhooks
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `❌ Erro ao processar webhook DocuSign: ${errorMessage}`,
        errorStack,
      );

      // Log estruturado para debugging
      this.logger.debug(`Erro ao processar webhook - detalhes completos:`, {
        error: errorMessage,
        payload: payload,
        stack: errorStack,
      });
    }
  }
}
