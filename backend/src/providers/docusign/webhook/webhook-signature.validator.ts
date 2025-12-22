/**
 * Validador de Assinatura HMAC para Webhooks DocuSign
 *
 * Responsabilidades:
 * - Validar autenticidade de webhooks usando HMAC-SHA256
 * - Evitar ataques de spoofing/replay
 * - Conformidade com especificação DocuSign
 *
 * Como funciona:
 * 1. DocuSign envia webhook com header X-DocuSign-Signature-1
 * 2. Valor é HMAC-SHA256(body, secretKey) em base64
 * 3. Comparamos com HMAC calculado localmente
 * 4. Se não bater → rejeita requisição (não é da DocuSign)
 */

import crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WebhookSignatureValidator {
  private readonly logger = new Logger(WebhookSignatureValidator.name);
  private readonly webhookSecretKey: string;

  constructor(private readonly configService: ConfigService) {
    // Secret key para validação de webhook (configurar em .env)
    // DOCUSIGN_WEBHOOK_SECRET=sua_secret_key_aqui
    this.webhookSecretKey =
      this.configService.get<string>('DOCUSIGN_WEBHOOK_SECRET') || '';

    if (!this.webhookSecretKey) {
      this.logger.warn(
        'DOCUSIGN_WEBHOOK_SECRET não configurado. Validação de webhook desabilitada!',
      );
    }
  }

  /**
   * Valida a assinatura HMAC de um webhook da DocuSign
   *
   * Implementação baseada em:
   * https://developers.docusign.com/docs/webhooks/how-to/verify-signature/
   *
   * @param signature - Header X-DocuSign-Signature-1 (base64)
   * @param requestBody - Body da requisição (JSON stringificado)
   * @returns true se assinatura é válida, false caso contrário
   */
  isValidSignature(
    signature: string | undefined,
    requestBody: string,
  ): boolean {
    // Se não há secret key configurado, não podemos validar
    if (!this.webhookSecretKey) {
      this.logger.warn(
        'Validação de webhook desabilitada (DOCUSIGN_WEBHOOK_SECRET não configurado)',
      );
      return false;
    }

    // Se não há signature no header, é inválido
    if (!signature) {
      this.logger.warn('Header X-DocuSign-Signature-1 não encontrado');
      return false;
    }

    try {
      // Validar usando apenas o body (sem concatenação com URI)
      const calculated = crypto
        .createHmac('sha256', this.webhookSecretKey)
        .update(requestBody)
        .digest('base64');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(calculated),
        Buffer.from(signature),
      );

      if (isValid) {
        this.logger.log('✓ Assinatura HMAC validada com sucesso');
        return true;
      }

      this.logger.error(
        `✗ Assinatura HMAC inválida. Esperado: ${signature.substring(0, 30)}... Calculado: ${calculated.substring(0, 30)}...`,
      );
      return false;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Erro ao validar assinatura HMAC: ${errorMessage}. Rejeitar webhook.`,
      );

      if (error instanceof Error) {
        this.logger.debug(`Stack: ${error.stack}`);
      }

      return false;
    }
  }

  /**
   * Extrai a assinatura do header da requisição
   *
   * @param headers - Headers da requisição
   * @returns Valor da assinatura ou undefined se não existir
   */
  extractSignature(
    headers: Record<string, string | string[]>,
  ): string | undefined {
    // Header pode ser lowercase em alguns casos
    const signature =
      headers['x-docusign-signature-1'] || headers['X-DocuSign-Signature-1'];

    if (typeof signature === 'string') {
      return signature;
    }

    if (Array.isArray(signature) && signature.length > 0) {
      return signature[0];
    }

    return undefined;
  }
}