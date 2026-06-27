import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { google } from 'googleapis';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * GoogleMeetOAuthService
 *
 * Gerencia a conexão OAuth2 (a nível de plataforma) com uma conta Google Workspace
 * usada como host único das reuniões. O admin conecta a conta pelo painel; o refresh
 * token fica criptografado no banco (AES-256-GCM) e é usado para criar salas Meet via
 * Meet REST API (spaces.create) com accessType=OPEN.
 *
 * Não toca o fluxo de login/cadastro da plataforma — é credencial de integração.
 */
@Injectable()
export class GoogleMeetOAuthService {
  private readonly logger = new Logger(GoogleMeetOAuthService.name);

  private static readonly SCOPES = [
    'openid',
    'email',
    'https://www.googleapis.com/auth/meetings.space.created',
    'https://www.googleapis.com/auth/meetings.space.settings',
  ];

  constructor(private readonly prisma: PrismaService) {}

  // ── OAuth: gerar URL de autorização ────────────────────────────────────────
  async createAuthorizeUrl(
    adminId: string,
  ): Promise<{ authorize_url: string }> {
    const state = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.prisma.googleMeetOauthState.create({
      data: { admin_id: adminId, state, expires_at: expiresAt },
    });

    const oauth2 = this.buildBareOAuthClient();
    const authorizeUrl = oauth2.generateAuthUrl({
      access_type: 'offline', // obrigatório p/ receber refresh token
      prompt: 'consent', // força refresh token mesmo em reconsentimento
      include_granted_scopes: true,
      scope: GoogleMeetOAuthService.SCOPES,
      state,
    });

    return { authorize_url: authorizeUrl };
  }

  // ── OAuth: callback (troca code por tokens) ─────────────────────────────────
  async handleCallback(
    code?: string,
    state?: string,
  ): Promise<{ google_email: string }> {
    if (!code || !state) {
      throw new BadRequestException(
        'Parâmetros de callback ausentes (code/state)',
      );
    }

    const stateRow = await this.prisma.googleMeetOauthState.findUnique({
      where: { state },
    });
    if (!stateRow || stateRow.used_at || stateRow.expires_at < new Date()) {
      throw new BadRequestException('State inválido, expirado ou já utilizado');
    }

    const oauth2 = this.buildBareOAuthClient();
    const { tokens } = await oauth2.getToken(code);

    if (!tokens.refresh_token) {
      throw new BadRequestException(
        'Google não retornou refresh token. Revogue o acesso do app na conta Google e conecte novamente.',
      );
    }
    if (!tokens.access_token) {
      throw new ServiceUnavailableException(
        'Falha ao obter access token do Google',
      );
    }

    const googleEmail = this.extractEmailFromIdToken(tokens.id_token);

    // 1 conexão ativa por vez (host único): desativa as antigas e cria a nova.
    await this.prisma.$transaction([
      this.prisma.googleMeetConnection.updateMany({
        where: { is_active: true },
        data: { is_active: false },
      }),
      this.prisma.googleMeetConnection.create({
        data: {
          connected_by_id: stateRow.admin_id,
          google_email: googleEmail ?? 'desconhecido',
          access_token_encrypted: this.encryptToken(tokens.access_token),
          refresh_token_encrypted: this.encryptToken(tokens.refresh_token),
          token_type: tokens.token_type ?? 'Bearer',
          scope: tokens.scope ?? null,
          expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          is_active: true,
        },
      }),
      this.prisma.googleMeetOauthState.update({
        where: { id: stateRow.id },
        data: { used_at: new Date() },
      }),
    ]);

    this.logger.log(
      `[meetings] Conta Google conectada para reuniões: ${googleEmail ?? 'desconhecido'}`,
    );

    return { google_email: googleEmail ?? 'desconhecido' };
  }

  // ── Status / desconexão ─────────────────────────────────────────────────────
  async getStatus(): Promise<{
    connected: boolean;
    google_email: string | null;
    expires_at: Date | null;
    is_active: boolean;
    last_error: string | null;
  }> {
    const connection = await this.prisma.googleMeetConnection.findFirst({
      where: { is_active: true },
      orderBy: { created_at: 'desc' },
    });

    return {
      connected: Boolean(connection),
      google_email: connection?.google_email ?? null,
      expires_at: connection?.expires_at ?? null,
      is_active: connection?.is_active ?? false,
      last_error: connection?.last_error ?? null,
    };
  }

  async disconnect(): Promise<void> {
    await this.prisma.googleMeetConnection.updateMany({
      where: { is_active: true },
      data: { is_active: false },
    });
  }

  // ── Uso interno: access token válido para a Meet REST API ───────────────────
  async getAccessToken(): Promise<string> {
    const connection = await this.prisma.googleMeetConnection.findFirst({
      where: { is_active: true },
      orderBy: { created_at: 'desc' },
    });

    if (!connection) {
      throw new ServiceUnavailableException(
        'Conta Google para reuniões não conectada. Conecte uma conta Workspace nas configurações.',
      );
    }

    const refreshToken = this.decryptToken(connection.refresh_token_encrypted);
    const oauth2 = this.buildBareOAuthClient();
    oauth2.setCredentials({ refresh_token: refreshToken });

    // Persiste o token renovado quando a lib renova automaticamente.
    oauth2.on('tokens', (tokens) => {
      const data: Record<string, unknown> = {};
      if (tokens.access_token) {
        data.access_token_encrypted = this.encryptToken(tokens.access_token);
      }
      if (tokens.refresh_token) {
        data.refresh_token_encrypted = this.encryptToken(tokens.refresh_token);
      }
      if (tokens.expiry_date) {
        data.expires_at = new Date(tokens.expiry_date);
      }
      if (Object.keys(data).length > 0) {
        this.prisma.googleMeetConnection
          .update({ where: { id: connection.id }, data })
          .catch((err) =>
            this.logger.warn(
              `[meetings] Falha ao persistir token renovado: ${err.message}`,
            ),
          );
      }
    });

    try {
      const { token } = await oauth2.getAccessToken();
      if (!token) {
        throw new ServiceUnavailableException(
          'Falha ao renovar access token do Google',
        );
      }
      return token;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'erro desconhecido';
      if (message.includes('invalid_grant')) {
        await this.prisma.googleMeetConnection.update({
          where: { id: connection.id },
          data: { is_active: false, last_error: 'invalid_grant' },
        });
        throw new ServiceUnavailableException(
          'A conexão com o Google expirou. Reconecte a conta nas configurações.',
        );
      }
      throw error;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  private buildBareOAuthClient() {
    const clientId = this.getRequiredEnv('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = this.getRequiredEnv('GOOGLE_OAUTH_CLIENT_SECRET');
    const redirectUri = this.getRequiredEnv('GOOGLE_OAUTH_REDIRECT_URI');
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private extractEmailFromIdToken(idToken?: string | null): string | null {
    if (!idToken) return null;
    try {
      const payload = idToken.split('.')[1];
      if (!payload) return null;
      const decoded = JSON.parse(
        Buffer.from(payload, 'base64').toString('utf8'),
      );
      return typeof decoded.email === 'string' ? decoded.email : null;
    } catch {
      return null;
    }
  }

  private getRequiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new InternalServerErrorException(
        `Variável de ambiente obrigatória ausente: ${name}`,
      );
    }
    return value;
  }

  private getEncryptionKeyBuffer(): Buffer {
    const raw = process.env.GOOGLE_MEET_TOKEN_ENCRYPTION_KEY;
    if (!raw) {
      throw new InternalServerErrorException(
        'Variável GOOGLE_MEET_TOKEN_ENCRYPTION_KEY não configurada',
      );
    }

    const normalizedRaw = raw.trim();
    const possibleBase64 = Buffer.from(normalizedRaw, 'base64');
    const normalizedDecoded = possibleBase64
      .toString('base64')
      .replace(/=+$/, '');
    const normalizedInput = normalizedRaw.replace(/=+$/, '');

    if (possibleBase64.length === 32 && normalizedDecoded === normalizedInput) {
      return possibleBase64;
    }

    const utf8 = Buffer.from(normalizedRaw, 'utf8');
    if (utf8.length === 32) {
      return utf8;
    }

    throw new InternalServerErrorException(
      'GOOGLE_MEET_TOKEN_ENCRYPTION_KEY deve ter 32 bytes (UTF-8) ou base64 de 32 bytes',
    );
  }

  private encryptToken(value: string): string {
    const key = this.getEncryptionKeyBuffer();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  private decryptToken(value: string): string {
    const [version, ivBase64, authTagBase64, encryptedBase64] =
      value.split(':');
    if (version !== 'v1' || !ivBase64 || !authTagBase64 || !encryptedBase64) {
      throw new InternalServerErrorException(
        'Formato de token criptografado inválido',
      );
    }
    const key = this.getEncryptionKeyBuffer();
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
