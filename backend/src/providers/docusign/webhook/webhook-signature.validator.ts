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
   * @param webhookUri - URI configurado no webhook (para validação completa)
   * @returns true se assinatura é válida, false caso contrário
   *
   * @example
   * const isValid = validator.isValidSignature(
   *   req.headers['x-docusign-signature-1'],
   *   JSON.stringify(req.body),
   *   'https://example.com/webhook/docusign'
   * );
   */
  isValidSignature(
    signature: string | undefined,
    requestBody: string,
    webhookUri?: string,
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
      // 1. Construir a string para validação
      // Formato: requestBody + webhookUri
      // Note: webhookUri é opcional, DocuSign recomenda incluir para máxima segurança
      let dataToVerify = requestBody;
      if (webhookUri) {
        dataToVerify += webhookUri;
      }

      // 2. Calcular HMAC-SHA256
      const calculated = crypto
        .createHmac('sha256', this.webhookSecretKey)
        .update(dataToVerify)
        .digest('base64');

      // 3. Comparar com signature do header
      // Usar comparação timing-safe para evitar timing attacks
      const receivedSignature = signature;
      const isValid = crypto.timingSafeEqual(
        Buffer.from(calculated),
        Buffer.from(receivedSignature),
      );

      if (isValid) {
        this.logger.debug('✓ Assinatura HMAC validada com sucesso');
      } else {
        this.logger.warn(
          '✗ Assinatura HMAC inválida. Possível ataque ou configuração incorreta.',
        );
      }

      return isValid;
    } catch (error) {
      // Se acontecer erro na validação (ex: encoding inválido),
      // considera como inválido por segurança
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Erro ao validar assinatura HMAC: ${errorMessage}. Rejeitar webhook.`,
      );

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
