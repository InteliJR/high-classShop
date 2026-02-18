import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SesService } from 'src/aws/ses.service';
import { randomUUID } from 'crypto';
import {
  AppointmentConfirmedEmailDto,
  AppointmentCreatedEmailDto,
  AppointmentCancelledEmailDto,
  ProposalReceivedEmailDto,
  ProposalAcceptedEmailDto,
  ProposalRejectedEmailDto,
  ContractSignedEmailDto,
  ContractGeneratedEmailDto,
  ContractSentEmailDto,
  ContractStatusChangedEmailDto,
} from './dto/notification-email.dto';

// ============================================================================
// NOTIFICATION SERVICE
// ============================================================================

/**
 * NotificationService - Sistema de Notificações por Email com Fire-and-Forget
 * 
 * Características:
 * - Totalmente assíncrono (não bloqueia transações)
 * - 3 camadas de proteção de erro:
 *   1. Circuit Breaker (fail-fast após 5 falhas)
 *   2. Timeout Protection (5s máximo por email)
 *   3. Exponential Backoff Retry (3 tentativas: 1s, 2s, 4s)
 * - Logs estruturados com correlation IDs
 * - Feature flag para disable emergencial
 * - Nunca lança exceções (graceful degradation)
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly sesClient: SESClient;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;
  private readonly notificationsEnabled: boolean;

  // Circuit Breaker State
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minuto

  // Retry Configuration
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 2000, 4000]; // ms
  private readonly EMAIL_TIMEOUT = 5000; // 5 segundos

  constructor(
    private readonly sesService: SesService,
    private readonly configService: ConfigService,
  ) {
    // Reuse SES client from SesService
    this.sesClient = (this.sesService as any).sesClient;
    this.fromEmail = this.configService.get('EMAIL_FROM', 'noreply@highclass.com');
    this.frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:5173');
    this.notificationsEnabled = this.configService.get('NOTIFICATIONS_ENABLED', 'true') === 'true';

    if (!this.notificationsEnabled) {
      this.logger.warn('⚠️ Notifications DISABLED via NOTIFICATIONS_ENABLED config');
    }
  }

  // ==========================================================================
  // CIRCUIT BREAKER & ERROR HANDLING
  // ==========================================================================

  /**
   * Verifica se o circuit breaker está aberto
   * Se aberto, bloqueia tentativas de envio (fail-fast)
   */
  private isCircuitOpen(): boolean {
    if (this.failureCount < this.CIRCUIT_BREAKER_THRESHOLD) {
      return false;
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    if (timeSinceLastFailure >= this.CIRCUIT_BREAKER_TIMEOUT) {
      // Timeout expirou - resetar circuit breaker
      this.logger.log('Circuit breaker resetting - attempting recovery');
      this.failureCount = 0;
      return false;
    }

    return true;
  }

  /**
   * Cria promise com timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Delay assíncrono para retry
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Core: Envio de email com 3 camadas de proteção
   * 
   * Layer 1: Circuit Breaker - Fail fast se sistema está instável
   * Layer 2: Timeout Protection - Cancela após 5s
   * Layer 3: Exponential Backoff Retry - 3 tentativas com delays crescentes
   * 
   * NUNCA lança exceções - graceful degradation
   */
  private async sendEmailSafely(
    type: string,
    recipientEmail: string,
    subject: string,
    htmlBody: string,
    textBody: string,
  ): Promise<void> {
    const correlationId = randomUUID();

    try {
      // LAYER 1: Circuit Breaker Check
      if (this.isCircuitOpen()) {
        this.logger.warn(`⚠️ Circuit breaker OPEN - email blocked`, {
          correlationId,
          type,
          recipient: recipientEmail,
          failureCount: this.failureCount,
          threshold: this.CIRCUIT_BREAKER_THRESHOLD,
        });
        return;
      }

      // LAYER 2 & 3: Retry with Timeout
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
        try {
          this.logger.debug(`Sending email attempt ${attempt}/${this.MAX_RETRIES}`, {
            correlationId,
            type,
            recipient: recipientEmail,
          });

          // Wrap SES call with timeout
          const sendCommand = new SendEmailCommand({
            Source: this.fromEmail,
            Destination: { ToAddresses: [recipientEmail] },
            Message: {
              Subject: { Data: subject, Charset: 'UTF-8' },
              Body: {
                Html: { Data: htmlBody, Charset: 'UTF-8' },
                Text: { Data: textBody, Charset: 'UTF-8' },
              },
            },
          });

          const result = await this.withTimeout(
            this.sesClient.send(sendCommand),
            this.EMAIL_TIMEOUT,
          );

          // SUCCESS - Reset circuit breaker and log
          this.failureCount = 0;
          this.logger.log(`✓ Email sent successfully`, {
            correlationId,
            type,
            recipient: recipientEmail,
            messageId: result.MessageId,
            attemptNumber: attempt,
            timestamp: new Date().toISOString(),
          });

          return; // Exit on success
        } catch (error) {
          lastError = error as Error;

          // Log retry (except on last attempt)
          if (attempt < this.MAX_RETRIES) {
            const nextDelay = this.RETRY_DELAYS[attempt - 1];
            this.logger.warn(`⚠️ Email retry ${attempt}/${this.MAX_RETRIES}`, {
              correlationId,
              type,
              recipient: recipientEmail,
              error: lastError.message,
              nextRetryIn: `${nextDelay}ms`,
            });

            await this.delay(nextDelay);
          }
        }
      }

      // All retries failed - increment circuit breaker and log
      this.failureCount++;
      this.lastFailureTime = Date.now();

      this.logger.error(`❌ Email failed after ${this.MAX_RETRIES} attempts`, {
        correlationId,
        type,
        recipient: recipientEmail,
        finalError: lastError?.message,
        circuitBreakerState: `${this.failureCount}/${this.CIRCUIT_BREAKER_THRESHOLD}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Catch unexpected errors (should never happen)
      this.logger.error(`❌ Unexpected error in sendEmailSafely`, {
        correlationId,
        type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ==========================================================================
  // NOTIFICATION METHODS - PRIORITY GROUP 1 (Core)
  // ==========================================================================

  /**
   * Event 2: Appointment Confirmed
   * Notifica cliente que especialista confirmou o agendamento
   */
  async sendAppointmentConfirmedEmail(data: AppointmentConfirmedEmailDto): Promise<void> {
    if (!this.notificationsEnabled) {
      this.logger.debug('Notifications disabled - skipping sendAppointmentConfirmedEmail');
      return;
    }

    const subject = `🎉 Seu agendamento foi confirmado - High-class Shop`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5;">
        <div style="background-color: #1e293b; color: #fff; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">High-class Shop</h1>
        </div>
        <div style="padding: 40px 30px; background-color: #ffffff;">
          <h2 style="color: #1e293b; margin-top: 0;">Agendamento Confirmado! ✅</h2>
          <p style="font-size: 16px; color: #334155;">Olá <strong>${data.clientName}</strong>,</p>
          <p style="font-size: 16px; color: #334155;">
            Temos uma ótima notícia! O especialista <strong>${data.specialistName}</strong> 
            confirmou sua reunião.
          </p>
          <div style="background-color: #f0f9ff; padding: 20px; border-left: 4px solid #3b82f6; margin: 25px 0;">
            <p style="margin: 8px 0; color: #1e40af;"><strong>📅 Data:</strong> ${new Date(data.appointmentDate).toLocaleDateString('pt-BR', { 
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            })}</p>
            <p style="margin: 8px 0; color: #1e40af;"><strong>🕐 Horário:</strong> ${new Date(data.appointmentDate).toLocaleTimeString('pt-BR', { 
              hour: '2-digit', minute: '2-digit' 
            })}</p>
            <p style="margin: 8px 0; color: #1e40af;"><strong>🚗 Produto:</strong> ${data.productDetails}</p>
          </div>
          <p style="font-size: 16px; color: #334155;">
            Agora você pode iniciar a negociação! Acesse o processo e envie sua primeira proposta.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.frontendUrl}/processes/${data.processId}" 
               style="display: inline-block; background-color: #3b82f6; color: #fff; 
                      padding: 14px 32px; text-decoration: none; border-radius: 6px; 
                      font-weight: 600; font-size: 16px;">
              Ver Processo
            </a>
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #64748b;">
          <p style="margin: 5px 0;">© 2026 High-class Shop. Todos os direitos reservados.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
High-class Shop - Agendamento Confirmado

Olá ${data.clientName},

O especialista ${data.specialistName} confirmou sua reunião!

Data: ${new Date(data.appointmentDate).toLocaleDateString('pt-BR')}
Horário: ${new Date(data.appointmentDate).toLocaleTimeString('pt-BR')}
Produto: ${data.productDetails}

Acesse ${this.frontendUrl}/processes/${data.processId} para ver detalhes e iniciar a negociação.

© 2026 High-class Shop
    `.trim();

    await this.sendEmailSafely('APPOINTMENT_CONFIRMED', data.clientEmail, subject, html, text);
  }

  /**
   * Event 4: New Proposal Received
   * Notifica destinatário sobre nova proposta ou contraproposta
   */
  async sendProposalReceivedEmail(data: ProposalReceivedEmailDto): Promise<void> {
    if (!this.notificationsEnabled) {
      this.logger.debug('Notifications disabled - skipping sendProposalReceivedEmail');
      return;
    }

    const percentageOfOriginal = ((data.proposedValue / data.originalValue) * 100).toFixed(1);
    const subject = `💰 Nova proposta recebida - High-class Shop`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5;">
        <div style="background-color: #1e293b; color: #fff; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">High-class Shop</h1>
        </div>
        <div style="padding: 40px 30px; background-color: #ffffff;">
          <h2 style="color: #1e293b; margin-top: 0;">Nova Proposta Recebida! 💰</h2>
          <p style="font-size: 16px; color: #334155;">Olá <strong>${data.recipientName}</strong>,</p>
          <p style="font-size: 16px; color: #334155;">
            <strong>${data.proposerName}</strong> enviou uma nova proposta de valor.
          </p>
          <div style="background-color: #f0fdf4; padding: 20px; border-left: 4px solid #22c55e; margin: 25px 0;">
            <p style="margin: 8px 0; color: #166534;"><strong>💵 Valor Proposto:</strong> R$ ${data.proposedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p style="margin: 8px 0; color: #166534;"><strong>📊 Valor Original:</strong> R$ ${data.originalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p style="margin: 8px 0; color: #166534;"><strong>📈 Percentual:</strong> ${percentageOfOriginal}% do valor original</p>
            ${data.message ? `<p style="margin: 12px 0 8px 0; color: #166534;"><strong>📝 Mensagem:</strong></p><p style="margin: 0; padding: 12px; background-color: #dcfce7; border-radius: 4px; color: #14532d;">${data.message}</p>` : ''}
          </div>
          <p style="font-size: 16px; color: #334155;">Você pode aceitar, rejeitar ou enviar uma contraproposta.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.frontendUrl}/processes/${data.processId}/negotiation" 
               style="display: inline-block; background-color: #22c55e; color: #fff; 
                      padding: 14px 32px; text-decoration: none; border-radius: 6px; 
                      font-weight: 600; font-size: 16px;">
              Responder Proposta
            </a>
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #64748b;">
          <p style="margin: 5px 0;">© 2026 High-class Shop. Todos os direitos reservados.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
High-class Shop - Nova Proposta Recebida

Olá ${data.recipientName},

${data.proposerName} enviou uma nova proposta!

Valor Proposto: R$ ${data.proposedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Valor Original: R$ ${data.originalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Percentual: ${percentageOfOriginal}% do valor original

${data.message ? `Mensagem: ${data.message}` : ''}

Acesse ${this.frontendUrl}/processes/${data.processId}/negotiation para responder.

© 2026 High-class Shop
    `.trim();

    await this.sendEmailSafely('PROPOSAL_RECEIVED', data.recipientEmail, subject, html, text);
  }

  /**
   * Event 10: Contract Signed
   * Notifica ambas as partes (buyer e seller) sobre assinatura do contrato
   * Usa Promise.allSettled para garantir que falha de um não bloqueia o outro
   */
  async sendContractSignedEmail(data: ContractSignedEmailDto): Promise<void> {
    if (!this.notificationsEnabled) {
      this.logger.debug('Notifications disabled - skipping sendContractSignedEmail');
      return;
    }

    const subject = `🎊 Contrato assinado com sucesso - High-class Shop`;

    // Send to both parties - use Promise.allSettled to ensure one failure doesn't block the other
    await Promise.allSettled([
      this.sendContractSignedEmailToParty(data, 'buyer', subject),
      this.sendContractSignedEmailToParty(data, 'seller', subject),
    ]);
  }

  private async sendContractSignedEmailToParty(
    data: ContractSignedEmailDto,
    role: 'buyer' | 'seller',
    subject: string,
  ): Promise<void> {
    const isBuyer = role === 'buyer';
    const recipientName = isBuyer ? data.buyerName : data.sellerName;
    const recipientEmail = isBuyer ? data.buyerEmail : data.sellerEmail;
    const otherPartyName = isBuyer ? data.sellerName : data.buyerName;

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5;">
        <div style="background-color: #1e293b; color: #fff; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">High-class Shop</h1>
        </div>
        <div style="padding: 40px 30px; background-color: #ffffff;">
          <h2 style="color: #1e293b; margin-top: 0;">🎊 Contrato Assinado!</h2>
          <p style="font-size: 16px; color: #334155;">Olá <strong>${recipientName}</strong>,</p>
          <p style="font-size: 16px; color: #334155;">
            Parabéns! O contrato foi assinado por todas as partes e a transação está concluída.
          </p>
          <div style="background-color: #f0fdf4; padding: 20px; border-left: 4px solid #22c55e; margin: 25px 0;">
            <p style="margin: 8px 0; color: #166534;"><strong>🚗 Veículo:</strong> ${data.vehicleModel}</p>
            <p style="margin: 8px 0; color: #166534;"><strong>💰 Valor Final:</strong> R$ ${data.finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p style="margin: 8px 0; color: #166534;"><strong>🤝 ${isBuyer ? 'Vendedor' : 'Comprador'}:</strong> ${otherPartyName}</p>
            <p style="margin: 8px 0; color: #166534;"><strong>📄 Contrato ID:</strong> ${data.contractId}</p>
          </div>
          ${data.signedPdfUrl ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.signedPdfUrl}" 
               style="display: inline-block; background-color: #3b82f6; color: #fff; 
                      padding: 14px 32px; text-decoration: none; border-radius: 6px; 
                      font-weight: 600; font-size: 16px;">
              📥 Baixar Contrato Assinado
            </a>
          </div>
          ` : ''}
          <p style="font-size: 16px; color: #334155;">
            ${isBuyer 
              ? 'Os próximos passos para recebimento do veículo serão coordenados pelo especialista.'
              : 'A comissão será processada conforme acordado no contrato.'
            }
          </p>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #64748b;">
          <p style="margin: 5px 0;">© 2026 High-class Shop. Todos os direitos reservados.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
High-class Shop - Contrato Assinado

Parabéns ${recipientName}!

O contrato foi assinado por todas as partes e a transação está concluída.

Veículo: ${data.vehicleModel}
Valor Final: R$ ${data.finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
${isBuyer ? 'Vendedor' : 'Comprador'}: ${otherPartyName}
Contrato ID: ${data.contractId}

${data.signedPdfUrl ? `Baixar contrato: ${data.signedPdfUrl}` : ''}

${isBuyer 
  ? 'Os próximos passos para recebimento do veículo serão coordenados pelo especialista.'
  : 'A comissão será processada conforme acordado no contrato.'
}

© 2026 High-class Shop
    `.trim();

    await this.sendEmailSafely(
      `CONTRACT_SIGNED_${role.toUpperCase()}`,
      recipientEmail,
      subject,
      html,
      text,
    );
  }

  // ==========================================================================
  // NOTIFICATION METHODS - APPOINTMENTS
  // ==========================================================================

  /**
   * Event 1: Appointment Created
   * Notifica especialista sobre novo agendamento criado pelo cliente
   */
  async sendAppointmentCreatedEmail(data: AppointmentCreatedEmailDto): Promise<void> {
    if (!this.notificationsEnabled) {
      this.logger.debug('Notifications disabled - skipping sendAppointmentCreatedEmail');
      return;
    }

    const subject = `🔔 Novo agendamento criado - High-class Shop`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5;">
        <div style="background-color: #1e293b; color: #fff; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">High-class Shop</h1>
        </div>
        <div style="padding: 40px 30px; background-color: #ffffff;">
          <h2 style="color: #1e293b; margin-top: 0;">Novo Agendamento! 🔔</h2>
          <p style="font-size: 16px; color: #334155;">Olá <strong>${data.specialistName}</strong>,</p>
          <p style="font-size: 16px; color: #334155;">
            O cliente <strong>${data.clientName}</strong> criou um novo agendamento com você.
          </p>
          <div style="background-color: #fef3c7; padding: 20px; border-left: 4px solid #f59e0b; margin: 25px 0;">
            <p style="margin: 8px 0; color: #92400e;"><strong>📅 Data:</strong> ${new Date(data.appointmentDate).toLocaleDateString('pt-BR', { 
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            })}</p>
            <p style="margin: 8px 0; color: #92400e;"><strong>🕐 Horário:</strong> ${new Date(data.appointmentDate).toLocaleTimeString('pt-BR', { 
              hour: '2-digit', minute: '2-digit' 
            })}</p>
            <p style="margin: 8px 0; color: #92400e;"><strong>👤 Cliente:</strong> ${data.clientName}</p>
            <p style="margin: 8px 0; color: #92400e;"><strong>🚗 Produto:</strong> ${data.productDetails}</p>
          </div>
          <p style="font-size: 16px; color: #334155;">
            Acesse o processo para confirmar ou ajustar o horário do agendamento.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.frontendUrl}/processes/${data.processId}" 
               style="display: inline-block; background-color: #f59e0b; color: #fff; 
                      padding: 14px 32px; text-decoration: none; border-radius: 6px; 
                      font-weight: 600; font-size: 16px;">
              Confirmar Agendamento
            </a>
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #64748b;">
          <p style="margin: 5px 0;">© 2026 High-class Shop. Todos os direitos reservados.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
High-class Shop - Novo Agendamento

Olá ${data.specialistName},

O cliente ${data.clientName} criou um novo agendamento com você.

Data: ${new Date(data.appointmentDate).toLocaleDateString('pt-BR')}
Horário: ${new Date(data.appointmentDate).toLocaleTimeString('pt-BR')}
Cliente: ${data.clientName}
Produto: ${data.productDetails}

Acesse ${this.frontendUrl}/processes/${data.processId} para confirmar.

© 2026 High-class Shop
    `.trim();

    await this.sendEmailSafely('APPOINTMENT_CREATED', data.specialistEmail, subject, html, text);
  }

  /**
   * Event 3: Appointment Cancelled
   * Notifica a outra parte sobre cancelamento de agendamento
   */
  async sendAppointmentCancelledEmail(data: AppointmentCancelledEmailDto): Promise<void> {
    if (!this.notificationsEnabled) {
      this.logger.debug('Notifications disabled - skipping sendAppointmentCancelledEmail');
      return;
    }

    const subject = `❌ Agendamento cancelado - High-class Shop`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5;">
        <div style="background-color: #1e293b; color: #fff; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">High-class Shop</h1>
        </div>
        <div style="padding: 40px 30px; background-color: #ffffff;">
          <h2 style="color: #1e293b; margin-top: 0;">Agendamento Cancelado ❌</h2>
          <p style="font-size: 16px; color: #334155;">Olá <strong>${data.recipientName}</strong>,</p>
          <p style="font-size: 16px; color: #334155;">
            Informamos que <strong>${data.cancellerName}</strong> cancelou o agendamento.
          </p>
          <div style="background-color: #fef2f2; padding: 20px; border-left: 4px solid #ef4444; margin: 25px 0;">
            <p style="margin: 8px 0; color: #991b1b;"><strong>📅 Data Original:</strong> ${new Date(data.appointmentDate).toLocaleDateString('pt-BR', { 
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            })}</p>
            <p style="margin: 8px 0; color: #991b1b;"><strong>🕐 Horário:</strong> ${new Date(data.appointmentDate).toLocaleTimeString('pt-BR', { 
              hour: '2-digit', minute: '2-digit' 
            })}</p>
            <p style="margin: 8px 0; color: #991b1b;"><strong>🚗 Produto:</strong> ${data.productDetails}</p>
            <p style="margin: 8px 0; color: #991b1b;"><strong>Cancelado por:</strong> ${data.wasClient ? 'Cliente' : 'Especialista'}</p>
          </div>
          ${data.wasClient ? `
          <p style="font-size: 16px; color: #334155;">
            O processo continua disponível. Você pode reagendar quando quiser.
          </p>
          ` : `
          <p style="font-size: 16px; color: #334155;">
            Entre em contato conosco se tiver dúvidas ou quiser marcar uma nova reunião.
          </p>
          `}
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #64748b;">
          <p style="margin: 5px 0;">© 2026 High-class Shop. Todos os direitos reservados.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
High-class Shop - Agendamento Cancelado

Olá ${data.recipientName},

${data.cancellerName} cancelou o agendamento.

Data Original: ${new Date(data.appointmentDate).toLocaleDateString('pt-BR')}
Horário: ${new Date(data.appointmentDate).toLocaleTimeString('pt-BR')}
Produto: ${data.productDetails}
Cancelado por: ${data.wasClient ? 'Cliente' : 'Especialista'}

${data.wasClient 
  ? 'O processo continua disponível. Você pode reagendar quando quiser.'
  : 'Entre em contato conosco se tiver dúvidas ou quiser marcar uma nova reunião.'
}

© 2026 High-class Shop
    `.trim();

    await this.sendEmailSafely('APPOINTMENT_CANCELLED', data.recipientEmail, subject, html, text);
  }

  // ==========================================================================
  // NOTIFICATION METHODS - PROPOSALS
  // ==========================================================================

  /**
   * Event 5: Proposal Accepted
   * Notifica proponente que sua proposta foi aceita
   */
  async sendProposalAcceptedEmail(data: ProposalAcceptedEmailDto): Promise<void> {
    if (!this.notificationsEnabled) {
      this.logger.debug('Notifications disabled - skipping sendProposalAcceptedEmail');
      return;
    }

    const subject = `🎉 Sua proposta foi aceita - High-class Shop`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5;">
        <div style="background-color: #1e293b; color: #fff; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">High-class Shop</h1>
        </div>
        <div style="padding: 40px 30px; background-color: #ffffff;">
          <h2 style="color: #1e293b; margin-top: 0;">Proposta Aceita! 🎉</h2>
          <p style="font-size: 16px; color: #334155;">Olá <strong>${data.proposerName}</strong>,</p>
          <p style="font-size: 16px; color: #334155;">
            Excelente notícia! <strong>${data.recipientName}</strong> aceitou sua proposta!
          </p>
          <div style="background-color: #f0fdf4; padding: 20px; border-left: 4px solid #22c55e; margin: 25px 0;">
            <p style="margin: 8px 0; color: #166534;"><strong>💰 Valor Aceito:</strong> R$ ${data.acceptedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <p style="font-size: 16px; color: #334155;">
            O próximo passo é a geração e assinatura do contrato. Em breve você receberá os documentos via DocuSign.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.frontendUrl}/processes/${data.processId}" 
               style="display: inline-block; background-color: #22c55e; color: #fff; 
                      padding: 14px 32px; text-decoration: none; border-radius: 6px; 
                      font-weight: 600; font-size: 16px;">
              Ver Processo
            </a>
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #64748b;">
          <p style="margin: 5px 0;">© 2026 High-class Shop. Todos os direitos reservados.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
High-class Shop - Proposta Aceita!

Olá ${data.proposerName},

Excelente notícia! ${data.recipientName} aceitou sua proposta!

Valor Aceito: R$ ${data.acceptedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

O próximo passo é a geração e assinatura do contrato. Em breve você receberá os documentos via DocuSign.

Acesse ${this.frontendUrl}/processes/${data.processId} para acompanhar.

© 2026 High-class Shop
    `.trim();

    await this.sendEmailSafely('PROPOSAL_ACCEPTED', data.proposerEmail, subject, html, text);
  }

  /**
   * Event 6: Proposal Rejected
   * Notifica proponente que sua proposta foi rejeitada
   */
  async sendProposalRejectedEmail(data: ProposalRejectedEmailDto): Promise<void> {
    if (!this.notificationsEnabled) {
      this.logger.debug('Notifications disabled - skipping sendProposalRejectedEmail');
      return;
    }

    const subject = `↩️ Proposta não aceita - High-class Shop`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5;">
        <div style="background-color: #1e293b; color: #fff; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">High-class Shop</h1>
        </div>
        <div style="padding: 40px 30px; background-color: #ffffff;">
          <h2 style="color: #1e293b; margin-top: 0;">Proposta Não Aceita ↩️</h2>
          <p style="font-size: 16px; color: #334155;">Olá <strong>${data.proposerName}</strong>,</p>
          <p style="font-size: 16px; color: #334155;">
            Informamos que <strong>${data.recipientName}</strong> não aceitou a proposta de 
            R$ ${data.rejectedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
          </p>
          <div style="background-color: #fef3c7; padding: 20px; border-left: 4px solid #f59e0b; margin: 25px 0;">
            <p style="margin: 8px 0; color: #92400e;">
              💡 <strong>Dica:</strong> A negociação continua aberta! Você pode enviar uma nova proposta 
              ajustando o valor ou aguardar uma contraproposta.
            </p>
          </div>
          <p style="font-size: 16px; color: #334155;">
            Não desista! Muitas negociações bem-sucedidas passam por várias rodadas de propostas.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.frontendUrl}/processes/${data.processId}/negotiation" 
               style="display: inline-block; background-color: #f59e0b; color: #fff; 
                      padding: 14px 32px; text-decoration: none; border-radius: 6px; 
                      font-weight: 600; font-size: 16px;">
              Enviar Nova Proposta
            </a>
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #64748b;">
          <p style="margin: 5px 0;">© 2026 High-class Shop. Todos os direitos reservados.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
High-class Shop - Proposta Não Aceita

Olá ${data.proposerName},

${data.recipientName} não aceitou a proposta de R$ ${data.rejectedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.

A negociação continua aberta! Você pode enviar uma nova proposta ajustando o valor ou aguardar uma contraproposta.

Não desista! Muitas negociações bem-sucedidas passam por várias rodadas de propostas.

Acesse ${this.frontendUrl}/processes/${data.processId}/negotiation para continuar negociando.

© 2026 High-class Shop
    `.trim();

    await this.sendEmailSafely('PROPOSAL_REJECTED', data.proposerEmail, subject, html, text);
  }

  /**
   * Event 7: Counter Proposal (uses same data as ProposalReceived)
   * Notifica sobre contraproposta - reutiliza lógica de ProposalReceived com subject diferente
   */
  async sendCounterProposalEmail(data: ProposalReceivedEmailDto): Promise<void> {
    // Counter proposals são tratados como proposals normais, apenas com subject diferente
    await this.sendProposalReceivedEmail(data);
  }

  // ==========================================================================
  // NOTIFICATION METHODS - CONTRACTS
  // ==========================================================================

  /**
   * Event 8: Contract Generated
   * Notifica ambas as partes que contrato foi gerado e será enviado em breve
   */
  async sendContractGeneratedEmail(data: ContractGeneratedEmailDto): Promise<void> {
    if (!this.notificationsEnabled) {
      this.logger.debug('Notifications disabled - skipping sendContractGeneratedEmail');
      return;
    }

    const subject = `📄 Contrato gerado - High-class Shop`;

    // Send to both parties
    await Promise.allSettled([
      this.sendContractGeneratedToParty(data, 'buyer', subject),
      this.sendContractGeneratedToParty(data, 'seller', subject),
    ]);
  }

  private async sendContractGeneratedToParty(
    data: ContractGeneratedEmailDto,
    role: 'buyer' | 'seller',
    subject: string,
  ): Promise<void> {
    const isBuyer = role === 'buyer';
    const recipientName = isBuyer ? data.buyerName : data.sellerName;
    const recipientEmail = isBuyer ? data.buyerEmail : data.sellerEmail;
    const otherPartyName = isBuyer ? data.sellerName : data.buyerName;

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5;">
        <div style="background-color: #1e293b; color: #fff; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">High-class Shop</h1>
        </div>
        <div style="padding: 40px 30px; background-color: #ffffff;">
          <h2 style="color: #1e293b; margin-top: 0;">Contrato Gerado! 📄</h2>
          <p style="font-size: 16px; color: #334155;">Olá <strong>${recipientName}</strong>,</p>
          <p style="font-size: 16px; color: #334155;">
            O contrato de compra e venda foi gerado com sucesso!
          </p>
          <div style="background-color: #eff6ff; padding: 20px; border-left: 4px solid #3b82f6; margin: 25px 0;">
            <p style="margin: 8px 0; color: #1e40af;"><strong>🚗 Veículo:</strong> ${data.vehicleDetails}</p>
            <p style="margin: 8px 0; color: #1e40af;"><strong>🤝 ${isBuyer ? 'Vendedor' : 'Comprador'}:</strong> ${otherPartyName}</p>
            <p style="margin: 8px 0; color: #1e40af;"><strong>📄 Contrato ID:</strong> ${data.contractId}</p>
          </div>
          <p style="font-size: 16px; color: #334155;">
            Em breve você receberá um email do DocuSign com o link para assinatura eletrônica do contrato.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.frontendUrl}/processes/${data.processId}" 
               style="display: inline-block; background-color: #3b82f6; color: #fff; 
                      padding: 14px 32px; text-decoration: none; border-radius: 6px; 
                      font-weight: 600; font-size: 16px;">
              Ver Processo
            </a>
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #64748b;">
          <p style="margin: 5px 0;">© 2026 High-class Shop. Todos os direitos reservados.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
High-class Shop - Contrato Gerado

Olá ${recipientName},

O contrato de compra e venda foi gerado com sucesso!

Veículo: ${data.vehicleDetails}
${isBuyer ? 'Vendedor' : 'Comprador'}: ${otherPartyName}
Contrato ID: ${data.contractId}

Em breve você receberá um email do DocuSign com o link para assinatura eletrônica.

Acesse ${this.frontendUrl}/processes/${data.processId} para acompanhar.

© 2026 High-class Shop
    `.trim();

    await this.sendEmailSafely(
      `CONTRACT_GENERATED_${role.toUpperCase()}`,
      recipientEmail,
      subject,
      html,
      text,
    );
  }

  /**
   * Event 9: Contract Sent (DocuSign envelope created)
   * Notifica ambas as partes que contrato está pronto para assinatura no DocuSign
   */
  async sendContractSentEmail(data: ContractSentEmailDto): Promise<void> {
    if (!this.notificationsEnabled) {
      this.logger.debug('Notifications disabled - skipping sendContractSentEmail');
      return;
    }

    const subject = `✍️ Contrato pronto para assinatura - High-class Shop`;

    // Send to both parties
    await Promise.allSettled([
      this.sendContractSentToParty(data, 'buyer', subject),
      this.sendContractSentToParty(data, 'seller', subject),
    ]);
  }

  private async sendContractSentToParty(
    data: ContractSentEmailDto,
    role: 'buyer' | 'seller',
    subject: string,
  ): Promise<void> {
    const isBuyer = role === 'buyer';
    const recipientName = isBuyer ? data.buyerName : data.sellerName;
    const recipientEmail = isBuyer ? data.buyerEmail : data.sellerEmail;
    const otherPartyName = isBuyer ? data.sellerName : data.buyerName;

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5;">
        <div style="background-color: #1e293b; color: #fff; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">High-class Shop</h1>
        </div>
        <div style="padding: 40px 30px; background-color: #ffffff;">
          <h2 style="color: #1e293b; margin-top: 0;">Contrato Pronto para Assinatura! ✍️</h2>
          <p style="font-size: 16px; color: #334155;">Olá <strong>${recipientName}</strong>,</p>
          <p style="font-size: 16px; color: #334155;">
            O contrato está pronto e aguardando sua assinatura eletrônica via DocuSign.
          </p>
          <div style="background-color: #f0f9ff; padding: 20px; border-left: 4px solid #3b82f6; margin: 25px 0;">
            <p style="margin: 8px 0; color: #1e40af;"><strong>🤝 ${isBuyer ? 'Vendedor' : 'Comprador'}:</strong> ${otherPartyName}</p>
            <p style="margin: 8px 0; color: #1e40af;"><strong>📄 Contrato ID:</strong> ${data.contractId}</p>
          </div>
          <p style="font-size: 16px; color: #334155;">
            Clique no botão abaixo para acessar o DocuSign e assinar o contrato:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.docusignLink}" 
               style="display: inline-block; background-color: #3b82f6; color: #fff; 
                      padding: 14px 32px; text-decoration: none; border-radius: 6px; 
                      font-weight: 600; font-size: 16px;">
              ✍️ Assinar no DocuSign
            </a>
          </div>
          <p style="font-size: 14px; color: #64748b; text-align: center;">
            Você também receberá um email diretamente do DocuSign com o mesmo link.
          </p>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #64748b;">
          <p style="margin: 5px 0;">© 2026 High-class Shop. Todos os direitos reservados.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
High-class Shop - Contrato Pronto para Assinatura

Olá ${recipientName},

O contrato está pronto e aguardando sua assinatura eletrônica via DocuSign.

${isBuyer ? 'Vendedor' : 'Comprador'}: ${otherPartyName}
Contrato ID: ${data.contractId}

Acesse o link abaixo para assinar:
${data.docusignLink}

Você também receberá um email diretamente do DocuSign com o mesmo link.

© 2026 High-class Shop
    `.trim();

    await this.sendEmailSafely(
      `CONTRACT_SENT_${role.toUpperCase()}`,
      recipientEmail,
      subject,
      html,
      text,
    );
  }

  /**
   * Event 11: Contract Declined
   * Notifica ambas as partes que contrato foi recusado
   */
  async sendContractDeclinedEmail(data: ContractStatusChangedEmailDto): Promise<void> {
    if (!this.notificationsEnabled) {
      this.logger.debug('Notifications disabled - skipping sendContractDeclinedEmail');
      return;
    }

    const subject = `⚠️ Contrato recusado - High-class Shop`;

    // Send to both parties
    await Promise.allSettled([
      this.sendContractStatusToParty(data, 'specialist', subject, 'declined'),
      this.sendContractStatusToParty(data, 'client', subject, 'declined'),
    ]);
  }

  /**
   * Event 12: Contract Voided
   * Notifica ambas as partes que contrato foi anulado
   */
  async sendContractVoidedEmail(data: ContractStatusChangedEmailDto): Promise<void> {
    if (!this.notificationsEnabled) {
      this.logger.debug('Notifications disabled - skipping sendContractVoidedEmail');
      return;
    }

    const subject = `🚫 Contrato anulado - High-class Shop`;

    // Send to both parties
    await Promise.allSettled([
      this.sendContractStatusToParty(data, 'specialist', subject, 'voided'),
      this.sendContractStatusToParty(data, 'client', subject, 'voided'),
    ]);
  }

  /**
   * Event 13: Contract Timeout
   * Notifica ambas as partes que contrato expirou por timeout
   */
  async sendContractTimeoutEmail(data: ContractStatusChangedEmailDto): Promise<void> {
    if (!this.notificationsEnabled) {
      this.logger.debug('Notifications disabled - skipping sendContractTimeoutEmail');
      return;
    }

    const subject = `⏰ Contrato expirado - High-class Shop`;

    // Send to both parties
    await Promise.allSettled([
      this.sendContractStatusToParty(data, 'specialist', subject, 'timeout'),
      this.sendContractStatusToParty(data, 'client', subject, 'timeout'),
    ]);
  }

  private async sendContractStatusToParty(
    data: ContractStatusChangedEmailDto,
    role: 'specialist' | 'client',
    subject: string,
    status: 'declined' | 'voided' | 'timeout',
  ): Promise<void> {
    const isSpecialist = role === 'specialist';
    const recipientName = isSpecialist ? data.specialistName : data.clientName;
    const recipientEmail = isSpecialist ? data.specialistEmail : data.clientEmail;
    const otherPartyName = isSpecialist ? data.clientName : data.specialistName;

    const statusConfig = {
      declined: {
        icon: '⚠️',
        title: 'Contrato Recusado',
        color: '#ef4444',
        bgColor: '#fef2f2',
        textColor: '#991b1b',
        message: `O contrato foi recusado ${data.declinedBy ? `por ${data.declinedBy}` : ''}.`,
        action: 'Entre em contato para discutir os próximos passos ou iniciar uma nova negociação.',
      },
      voided: {
        icon: '🚫',
        title: 'Contrato Anulado',
        color: '#f97316',
        bgColor: '#fff7ed',
        textColor: '#9a3412',
        message: 'O contrato foi anulado pelo sistema.',
        action: 'Entre em contato com o suporte para mais informações ou iniciar uma nova negociação.',
      },
      timeout: {
        icon: '⏰',
        title: 'Contrato Expirado',
        color: '#f59e0b',
        bgColor: '#fef3c7',
        textColor: '#92400e',
        message: 'O prazo para assinatura do contrato expirou.',
        action: 'Se ainda houver interesse, você pode solicitar a geração de um novo contrato.',
      },
    };

    const config = statusConfig[status];

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5;">
        <div style="background-color: #1e293b; color: #fff; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">High-class Shop</h1>
        </div>
        <div style="padding: 40px 30px; background-color: #ffffff;">
          <h2 style="color: #1e293b; margin-top: 0;">${config.title} ${config.icon}</h2>
          <p style="font-size: 16px; color: #334155;">Olá <strong>${recipientName}</strong>,</p>
          <p style="font-size: 16px; color: #334155;">${config.message}</p>
          <div style="background-color: ${config.bgColor}; padding: 20px; border-left: 4px solid ${config.color}; margin: 25px 0;">
            <p style="margin: 8px 0; color: ${config.textColor};"><strong>🚗 Veículo:</strong> ${data.vehicleDetails}</p>
            <p style="margin: 8px 0; color: ${config.textColor};"><strong>🤝 ${isSpecialist ? 'Cliente' : 'Especialista'}:</strong> ${otherPartyName}</p>
            <p style="margin: 8px 0; color: ${config.textColor};"><strong>📄 Contrato ID:</strong> ${data.contractId}</p>
          </div>
          <p style="font-size: 16px; color: #334155;">${config.action}</p>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #64748b;">
          <p style="margin: 5px 0;">© 2026 High-class Shop. Todos os direitos reservados.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
High-class Shop - ${config.title}

Olá ${recipientName},

${config.message}

Veículo: ${data.vehicleDetails}
${isSpecialist ? 'Cliente' : 'Especialista'}: ${otherPartyName}
Contrato ID: ${data.contractId}

${config.action}

© 2026 High-class Shop
    `.trim();

    await this.sendEmailSafely(
      `CONTRACT_${status.toUpperCase()}_${role.toUpperCase()}`,
      recipientEmail,
      subject,
      html,
      text,
    );
  }
}
