import {
  Controller,
  Post,
  Headers,
  Body,
  Logger,
  HttpCode,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { DocuSignWebhookService } from './webhook.service';
import { WebhookSignatureValidator } from './webhook-signature.validator';
import { InvalidWebhookSignatureException } from 'src/shared/exceptions/custom-exceptions';
import { Public } from 'src/shared/decorators/public.decorator';

/**
 * Controller para Webhooks da DocuSign
 *
 * Endpoint: POST /docusign/webhook
 *
 * Responsabilidades:
 * - Receber notificações de eventos do DocuSign
 * - Validar autenticidade (HMAC-SHA256)
 * - Processar eventos de status do envelope
 *
 * Segurança:
 * - Valida assinatura HMAC antes de processar
 * - Rejeita requests não autenticadas
 * - Logs detalhados de falhas de autenticação
 * - Timing-safe comparison para evitar timing attacks
 *
 * Eventos Suportados:
 * - created: envelope criado
 * - sent: envelope enviado para signer
 * - delivered: email entregue
 * - completed: assinado com sucesso
 * - declined: signer recusou
 * - voided: cancelado
 * - timedout: expirou
 */
@Controller('docusign/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: DocuSignWebhookService,
    private readonly signatureValidator: WebhookSignatureValidator,
  ) {}

  /**
   * Processa webhooks de eventos do envelope DocuSign
   *
   * Fluxo de Segurança:
   * 1. Extrair assinatura do header X-DocuSign-Signature-1
   * 2. Calcular HMAC-SHA256 do body localmente
   * 3. Comparar com assinatura do header (timing-safe)
   * 4. Se inválido → rejeita com 401
   * 5. Se válido → processa evento
   *
   * @param headers - Headers da requisição
   * @param body - Payload do webhook (XML ou JSON)
   * @param req - Request object (para extrair URI)
   * @returns {Promise<{message: string}>} Confirmação de processamento
   *
   * @throws InvalidWebhookSignatureException - Se assinatura HMAC inválida (401)
   *
   * @example
   * Webhook Event (enviado pela DocuSign):
   * POST /docusign/webhook
   * X-DocuSign-Signature-1: base64_encoded_hmac_sha256
   * Content-Type: application/json
   *
   * {
   *   "envelope_id": "uuid",
   *   "status": "completed",
   *   "recipients": {...},
   *   ...
   * }
   */
  @Post()
  @Public()
  @HttpCode(200)
  async handleWebhook(
    @Headers() headers: Record<string, string>,
    @Body() body: any,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    this.logger.log(`=== WEBHOOK RECEBIDO ===`);
    this.logger.debug(`Headers keys: ${Object.keys(headers).join(', ')}`);
    this.logger.debug(`Body keys: ${Object.keys(body).join(', ')}`);

    // ===== ETAPA 1: VALIDAR AUTENTICIDADE =====

    // Extrair assinatura do header
    const signature = this.signatureValidator.extractSignature(headers);

    if (!signature) {
      this.logger.error(
        'Webhook recebido sem assinatura HMAC. Possível ataque ou webhook test.',
      );
      throw new InvalidWebhookSignatureException();
    }

    // Converter body para string (preservar formato original)
    const bodyString = JSON.stringify(body);

    // Validar assinatura HMAC
    // Incluir URI para validação completa (recomendado pela DocuSign)
    const webhookUri = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    this.logger.debug(`=== DEBUG HMAC ===`);
    this.logger.debug(`Received Signature: ${signature.substring(0, 20)}...`);
    this.logger.debug(`Webhook URI: ${webhookUri}`);
    this.logger.debug(`Body String Length: ${bodyString.length}`);
    this.logger.debug(
      `Body String (first 200 chars): ${bodyString.substring(0, 200)}...`,
    );

    const isValidSignature = this.signatureValidator.isValidSignature(
      signature,
      bodyString,
    );

    if (!isValidSignature) {
      this.logger.error(
        'Assinatura HMAC inválida. Webhook rejeitado (possível ataque ou secret incorreto).',
      );
      this.logger.error(
        `[DEBUGGING] Signature recebido: ${signature.substring(0, 20)}...`,
      );
      this.logger.error(`[DEBUGGING] URI: ${webhookUri}`);
      this.logger.error(`[DEBUGGING] Body Length: ${bodyString.length}`);
      throw new InvalidWebhookSignatureException();
    }

    this.logger.log('✓ Assinatura HMAC validada com sucesso');

    // ===== ETAPA 2: PROCESSAR EVENTO =====

    try {
      this.logger.log(`Processando evento de status do envelope...`);

      await this.webhookService.handleEnvelopeStatusChanged(body);

      this.logger.log(`✓ Evento processado com sucesso`);

      return {
        message: 'Webhook processado com sucesso',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Erro ao processar webhook: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Re-lança erro (será capturado pelo filtro global)
      throw error;
    }
  }
}
