import { Injectable, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { validateEmail } from '../shared/email-validator';

interface ReferralPayload {
    consultantId: string;
    email: string;
}

@Injectable()
export class SesService {
    private readonly sesClient: SESClient;
    private readonly logger = new Logger(SesService.name);
    private readonly fromEmail: string;
    private readonly frontendUrl: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly jwtService: JwtService,
    ) {
        this.sesClient = new SESClient({
            region: this.configService.getOrThrow('AWS_REGION'),
            credentials: {
                accessKeyId: this.configService.getOrThrow('AWS_ACCESS_KEY_ID'),
                secretAccessKey: this.configService.getOrThrow('AWS_SECRET_ACCESS_KEY'),
            },
        });

        this.fromEmail = this.configService.get('EMAIL_FROM', 'noreply@highclass.com');
        this.frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:5173');
    }

    /**
     * Generate a JWT token for referral link
     * @param consultantId - ID of the consultant sending the invitation
     * @param email - Email of the potential client
     * @returns JWT token
     */
    private generateReferralToken(consultantId: string, email: string): string {
        const payload: ReferralPayload = {
            consultantId,
            email,
        };

        // Token expires in 7 days
        return this.jwtService.sign(payload, {
            secret: this.configService.getOrThrow('JWT_SECRET_REFERRAL'),
            expiresIn: '7d',
        });
    }

    /**
     * Send a registration/referral link to a potential client
     * @param recipientEmail - Email address of the potential client
     * @param consultantId - ID of the consultant sending the invitation
     * @param consultantName - Name of the consultant for personalization
     * @returns Object with success status and messageId
     * @throws BadRequestException if email is invalid
     */
    async sendRegistrationEmail(
        recipientEmail: string,
        consultantId: string,
        consultantName: string,
    ): Promise<{ success: boolean; messageId?: string; error?: string }> {
        try {
            // Validate email format before attempting to send (bounce prevention)
            const validationResult = validateEmail(recipientEmail);

            if (!validationResult.isValid) {
                const errorMessage = validationResult.suggestion
                    ? `${validationResult.error}. Você quis dizer: ${validationResult.suggestion}?`
                    : validationResult.error;

                this.logger.warn(`Email validation failed for ${recipientEmail}: ${errorMessage}`);
                throw new BadRequestException(errorMessage);
            }

            // Generate JWT token with consultant ID and email
            const referralToken = this.generateReferralToken(consultantId, recipientEmail);
            const registrationUrl = `${this.frontendUrl}/register?ref=${referralToken}`;
            const emailParams = {
                Source: this.fromEmail,
                Destination: {
                    ToAddresses: [recipientEmail],
                },
                Message: {
                    Subject: {
                        Data: `Convite para High-class Shop - ${consultantName}`,
                        Charset: 'UTF-8',
                    },
                    Body: {
                        Html: {
                            Data: this.generateRegistrationEmailHtml(
                                consultantName,
                                registrationUrl,
                            ),
                            Charset: 'UTF-8',
                        },
                        Text: {
                            Data: this.generateRegistrationEmailText(
                                consultantName,
                                registrationUrl,
                            ),
                            Charset: 'UTF-8',
                        },
                    },
                },
            };

            const command = new SendEmailCommand(emailParams);
            const response = await this.sesClient.send(command);

            this.logger.log(
                `Registration email sent to ${recipientEmail} from consultant ${consultantId}`,
            );

            return {
                success: true,
                messageId: response.MessageId,
            };
        } catch (error) {
            this.logger.error(
                `Failed to send registration email to ${recipientEmail}`,
                error,
            );
            throw new InternalServerErrorException(
                `Failed to send registration email: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        }
    }

    /**
     * Generate HTML version of the registration email
     */
    private generateRegistrationEmailHtml(
        consultantName: string,
        registrationUrl: string,
    ): string {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #1a1a1a;
            color: #fff;
            padding: 20px;
            text-align: center;
          }
          .content {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 5px;
            margin-top: 20px;
          }
          .button {
            display: inline-block;
            background-color: #007bff;
            color: #fff !important;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 12px;
            color: #666;
          }
          .security-note {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 10px;
            margin: 15px 0;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>High-class Shop</h1>
        </div>
        <div class="content">
          <h2>Você foi convidado!</h2>
          <p>Olá,</p>
          <p>
            <strong>${consultantName}</strong> enviou um convite para você se cadastrar na 
            <strong>High-class Shop</strong>, a plataforma premium para aquisição de 
            veículos, embarcações e aeronaves de luxo.
          </p>
          <p>
            Clique no botão abaixo para criar sua conta e começar a explorar nosso 
            catálogo exclusivo:
          </p>
          <center>
            <a href="${registrationUrl}" class="button">Criar Minha Conta</a>
          </center>
          <div class="security-note">
            <strong>🔒 Link Seguro:</strong> Este convite é válido por 7 dias e foi gerado 
            especificamente para você. Ao se cadastrar, você será automaticamente vinculado 
            ao assessor ${consultantName}.
          </div>
          <p style="font-size: 12px; color: #666; margin-top: 20px;">
            Ou copie e cole este link no seu navegador:<br>
            <a href="${registrationUrl}" style="word-break: break-all;">${registrationUrl}</a>
          </p>
        </div>
        <div class="footer">
          <p>© 2025 High-class Shop. Todos os direitos reservados.</p>
          <p>Se você não solicitou este convite, por favor ignore este e-mail.</p>
        </div>
      </body>
      </html>
    `;
    }

    /**
     * Generate plain text version of the registration email
     */
    private generateRegistrationEmailText(
        consultantName: string,
        registrationUrl: string,
    ): string {
        return `
High-class Shop - Convite para Cadastro

Olá,

${consultantName} enviou um convite para você se cadastrar na High-class Shop, 
a plataforma premium para aquisição de veículos, embarcações e aeronaves de luxo.

Acesse o link abaixo para criar sua conta:
${registrationUrl}

🔒 LINK SEGURO: Este convite é válido por 7 dias e foi gerado especificamente 
para você. Ao se cadastrar, você será automaticamente vinculado ao assessor 
${consultantName}.

---
© 2025 High-class Shop. Todos os direitos reservados.
Se você não solicitou este convite, por favor ignore este e-mail.
    `.trim();
    }
}
