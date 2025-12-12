import { Controller, Post, Headers, Body, Logger } from '@nestjs/common';
import { EnvelopeService } from './envelopes.service';

@Controller('docusign/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly envelopeService: EnvelopeService) {}

  /** Webhook de eventos do envelope */
  @Post()
  async handleWebhook(
    @Headers() headers: Record<string, string>,
    @Body() body: any,
  ): Promise<void> {
    // TODO:
    // - Validar assinatura do webhook (opcional)
    // - Passar payload para envelopeService.updateStatusFromWebhook
    this.logger.log('Webhook recebido da DocuSign');
  }
}
