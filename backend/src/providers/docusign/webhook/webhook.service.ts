import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Serviço para processar webhooks da DocuSign.
 *
 * Responsabilidades:
 * - Extrair informações do envelope do payload do webhook
 * - Atualizar status do contrato no banco de dados
 * - Mapear status da DocuSign para status do contrato
 */
@Injectable()
export class DocuSignWebhookService {
  private readonly logger = new Logger(DocuSignWebhookService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Processa um evento de webhook da DocuSign.
   *
   * Payload esperado:
   * {
   *   "data": {
   *     "envelopes": [
   *       {
   *         "envelopeId": "...",
   *         "status": "completed" | "sent" | "delivered" | "declined" | "voided" | "timedout",
   *         "statusDateTime": "2024-12-16T10:00:00.000Z",
   *         "recipients": { ... }
   *       }
   *     ]
   *   }
   * }
   *
   * @param payload - Payload do webhook recebido da DocuSign
   * @throws Error se envelope não for encontrado ou se o update falhar
   */
  async handleEnvelopeStatusChanged(payload: any): Promise<void> {
    try {
      // Extrair informações do payload
      const envelopes = payload?.data?.envelopes || [];

      if (!Array.isArray(envelopes) || envelopes.length === 0) {
        this.logger.warn(
          'Webhook recebido mas sem envelopes no payload',
          payload,
        );
        return;
      }

      // Processar cada envelope
      for (const envelope of envelopes) {
        const { envelopeId, status, statusDateTime } = envelope;

        if (!envelopeId || !status) {
          this.logger.warn(
            `Envelope inválido no webhook: ${JSON.stringify(envelope)}`,
          );
          continue;
        }

        // Buscar contrato pelo provider_id (envelopeId)
        const contract = await this.prismaService.contract.findFirst({
          where: {
            provider_id: envelopeId,
          },
        });

        if (!contract) {
          this.logger.warn(
            `Contrato não encontrado para envelope ${envelopeId}`,
          );
          continue;
        }

        // Mapear status da DocuSign para status do contrato
        let contractStatus = contract.status;

        if (status === 'completed') {
          contractStatus = 'SIGNED';
        } else if (
          status === 'declined' ||
          status === 'voided' ||
          status === 'timedout'
        ) {
          contractStatus = 'REJECTED';
        }
        // PENDING permanece para outros status (sent, delivered, created)

        // Atualizar contrato no banco
        const metaData = {
          ...(contract.provider_meta as Record<string, any>),
          lastWebhookUpdate: new Date().toISOString(),
          lastWebhookStatus: status,
          statusDateTime,
        };

        await this.prismaService.contract.update({
          where: { id: contract.id },
          data: {
            provider_status: status as any,
            status: contractStatus as any,
            signed_at:
              status === 'completed' ? new Date(statusDateTime) : undefined,
            provider_meta: metaData,
          },
        });

        this.logger.log(
          `Contrato ${contract.id} atualizado. Status provider: ${status}, Status contrato: ${contractStatus}`,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Erro ao processar webhook DocuSign: ${errorMessage}`,
        error,
      );
      // Não relançar erro para evitar retry infinito
    }
  }
}
