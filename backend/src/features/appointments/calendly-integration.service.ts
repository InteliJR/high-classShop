import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CalendlySyncStatus, Prisma, UserRole } from '@prisma/client';
import axios from 'axios';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { parseDate } from 'src/shared/utils/date.utils';

interface CalendlyTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

interface CalendlyUserMeResponse {
  resource: {
    uri: string;
    current_organization?: string;
  };
}

interface CalendlyWebhookPayload {
  event?: string;
  payload?: {
    event?: string;
    invitee?: string | { uri?: string };
    scheduled_event?: {
      uri?: string;
      start_time?: string;
    };
    event_start_time?: string;
    start_time?: string;
  };
}

@Injectable()
export class CalendlyIntegrationService {
  private readonly logger = new Logger(CalendlyIntegrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createAuthorizeUrl(userId: string): Promise<{ authorize_url: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (user.role !== UserRole.SPECIALIST && user.role !== UserRole.CONSULTANT) {
      throw new ForbiddenException('Somente especialistas e consultores podem conectar Calendly');
    }

    const clientId = this.getRequiredEnv('CALENDLY_OAUTH_CLIENT_ID');
    const redirectUri = this.getRequiredEnv('CALENDLY_OAUTH_REDIRECT_URI');
    const authBaseUrl = process.env.CALENDLY_OAUTH_AUTHORIZE_URL || 'https://auth.calendly.com/oauth/authorize';
    const scopes = process.env.CALENDLY_OAUTH_SCOPES || 'default';

    const state = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.prisma.calendlyOauthState.create({
      data: {
        user_id: user.id,
        state,
        expires_at: expiresAt,
      },
    });

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
      scope: scopes,
    });

    return {
      authorize_url: `${authBaseUrl}?${params.toString()}`,
    };
  }

  async getOAuthStatus(userId: string): Promise<{
    connected: boolean;
    calendly_user_uri: string | null;
    expires_at: Date | null;
    is_active: boolean;
  }> {
    const connection = await this.prisma.calendlyConnection.findUnique({
      where: { user_id: userId },
      select: {
        is_active: true,
        calendly_user_uri: true,
        expires_at: true,
      },
    });

    if (!connection) {
      return {
        connected: false,
        calendly_user_uri: null,
        expires_at: null,
        is_active: false,
      };
    }

    return {
      connected: connection.is_active,
      calendly_user_uri: connection.calendly_user_uri,
      expires_at: connection.expires_at,
      is_active: connection.is_active,
    };
  }

  async handleOAuthCallback(code: string, state: string): Promise<string> {
    const stateRecord = await this.prisma.calendlyOauthState.findUnique({
      where: { state },
      include: {
        user: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    if (!stateRecord || stateRecord.used_at || stateRecord.expires_at < new Date()) {
      throw new BadRequestException('State OAuth inválido ou expirado');
    }

    if (
      stateRecord.user.role !== UserRole.SPECIALIST &&
      stateRecord.user.role !== UserRole.CONSULTANT
    ) {
      throw new ForbiddenException('Usuário não permitido para integração Calendly');
    }

    const token = await this.exchangeAuthorizationCode(code);
    const me = await this.fetchCalendlyMe(token.access_token);

    if (!me.resource?.uri) {
      throw new InternalServerErrorException('Calendly não retornou URI de usuário');
    }

    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000)
      : null;

    const encryptedAccess = this.encryptToken(token.access_token);
    const encryptedRefresh = this.encryptToken(token.refresh_token);

    const upsertedConnection = await this.prisma.calendlyConnection.upsert({
      where: { user_id: stateRecord.user_id },
      create: {
        user_id: stateRecord.user_id,
        access_token_encrypted: encryptedAccess,
        refresh_token_encrypted: encryptedRefresh,
        token_type: token.token_type || 'Bearer',
        scope: token.scope,
        expires_at: expiresAt,
        calendly_user_uri: me.resource.uri,
        calendly_organization_uri: me.resource.current_organization,
        is_active: true,
        last_sync_at: new Date(),
        last_error: null,
      },
      update: {
        access_token_encrypted: encryptedAccess,
        refresh_token_encrypted: encryptedRefresh,
        token_type: token.token_type || 'Bearer',
        scope: token.scope,
        expires_at: expiresAt,
        calendly_user_uri: me.resource.uri,
        calendly_organization_uri: me.resource.current_organization,
        is_active: true,
        last_sync_at: new Date(),
        last_error: null,
      },
    });

    await this.prisma.user.update({
      where: { id: stateRecord.user_id },
      data: {
        calendly_user_uri: me.resource.uri,
        calendly_organization_uri: me.resource.current_organization || null,
      },
    });

    await this.prisma.calendlyOauthState.update({
      where: { id: stateRecord.id },
      data: { used_at: new Date() },
    });

    try {
      await this.ensureWebhookSubscription(upsertedConnection.user_id);
    } catch (error: any) {
      this.logger.warn(`Falha ao criar webhook Calendly (não crítico): ${error?.message}`);
    }

    return stateRecord.user_id;
  }

  async disconnect(userId: string): Promise<void> {
    const connection = await this.prisma.calendlyConnection.findUnique({
      where: { user_id: userId },
    });

    if (!connection) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.calendlyConnection.update({
        where: { id: connection.id },
        data: {
          is_active: false,
          last_sync_at: new Date(),
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          calendly_user_uri: null,
          calendly_organization_uri: null,
        },
      }),
    ]);
  }

  async resolveScheduledStartTime(
    specialistId: string,
    eventUri?: string | null,
    inviteeUri?: string | null,
  ): Promise<Date | null> {
    if (!specialistId || (!eventUri && !inviteeUri)) {
      return null;
    }

    const connection = await this.prisma.calendlyConnection.findUnique({
      where: { user_id: specialistId },
    });

    if (!connection || !connection.is_active) {
      return null;
    }

    const inviteeData = inviteeUri
      ? await this.getCalendlyResourceWithRefresh(connection.user_id, inviteeUri)
      : null;

    const inviteeResource = inviteeData?.resource || inviteeData;
    const inviteeStartTime =
      inviteeResource?.start_time ||
      inviteeResource?.event_start_time ||
      inviteeData?.payload?.scheduled_event?.start_time;

    if (inviteeStartTime) {
      const parsed = parseDate(inviteeStartTime);
      if (parsed) {
        await this.prisma.calendlyConnection.update({
          where: { id: connection.id },
          data: { last_sync_at: new Date(), last_error: null },
        });
        return parsed;
      }
    }

    const resolvedEventUri = eventUri || inviteeResource?.event || inviteeResource?.scheduled_event?.uri;
    if (!resolvedEventUri) {
      return null;
    }

    const eventData = await this.getCalendlyResourceWithRefresh(connection.user_id, resolvedEventUri);
    const eventResource = eventData?.resource || eventData;
    const eventStartTime = eventResource?.start_time || eventData?.payload?.scheduled_event?.start_time;

    if (!eventStartTime) {
      return null;
    }

    const parsed = parseDate(eventStartTime);
    if (!parsed) {
      return null;
    }

    await this.prisma.calendlyConnection.update({
      where: { id: connection.id },
      data: { last_sync_at: new Date(), last_error: null },
    });

    return parsed;
  }

  async processWebhook(
    body: CalendlyWebhookPayload,
    rawBody: string | undefined,
    signatureHeader: string | undefined,
  ): Promise<{ processed: boolean; message: string }> {
    this.validateWebhookSignature(rawBody, signatureHeader);

    const eventType = body?.event;
    const payload = body?.payload;

    if (!eventType || !payload) {
      return {
        processed: false,
        message: 'Webhook sem payload utilizável',
      };
    }

    const eventUri = payload.event || payload.scheduled_event?.uri;
    const inviteeUri =
      typeof payload.invitee === 'string' ? payload.invitee : payload.invitee?.uri;

    if (!eventUri && !inviteeUri) {
      return {
        processed: false,
        message: 'Webhook sem event/invitee uri',
      };
    }

    const appointment = await this.prisma.appointment.findFirst({
      where: {
        OR: [
          eventUri ? { calendly_event_uri: eventUri } : undefined,
          inviteeUri ? { calendly_invitee_uri: inviteeUri } : undefined,
        ].filter(Boolean) as Prisma.AppointmentWhereInput[],
      },
    });

    if (!appointment) {
      return {
        processed: false,
        message: 'Nenhum agendamento correspondente encontrado',
      };
    }

    if (eventType === 'invitee.created') {
      const startTimeRaw =
        payload.scheduled_event?.start_time || payload.event_start_time || payload.start_time;
      const parsedStartTime = startTimeRaw ? parseDate(startTimeRaw) : null;

      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          calendly_event_uri: eventUri || appointment.calendly_event_uri,
          calendly_invitee_uri: inviteeUri || appointment.calendly_invitee_uri,
          calendly_last_sync_at: new Date(),
          calendly_scheduled_at: new Date(),
          calendly_sync_status: parsedStartTime
            ? CalendlySyncStatus.SYNCED
            : appointment.calendly_sync_status,
          appointment_datetime: parsedStartTime || appointment.appointment_datetime,
        },
      });

      return {
        processed: true,
        message: 'Webhook de criação processado com sucesso',
      };
    }

    if (eventType === 'invitee.canceled') {
      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          calendly_last_sync_at: new Date(),
          calendly_sync_status: CalendlySyncStatus.FAILED,
        },
      });

      return {
        processed: true,
        message: 'Webhook de cancelamento processado',
      };
    }

    return {
      processed: false,
      message: `Evento ${eventType} ignorado`,
    };
  }

  private async getCalendlyResourceWithRefresh(userId: string, uri: string): Promise<any> {
    const connection = await this.prisma.calendlyConnection.findUnique({
      where: { user_id: userId },
    });

    if (!connection || !connection.is_active) {
      throw new NotFoundException('Conexão Calendly não encontrada para o especialista');
    }

    let accessToken = this.decryptToken(connection.access_token_encrypted);

    try {
      return await this.fetchCalendlyResource(accessToken, uri);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status !== 401) {
        throw error;
      }

      const refreshed = await this.refreshConnectionToken(connection);
      accessToken = this.decryptToken(refreshed.access_token_encrypted);

      return this.fetchCalendlyResource(accessToken, uri);
    }
  }

  private async refreshConnectionToken(connection: {
    id: string;
    user_id: string;
    refresh_token_encrypted: string;
  }): Promise<{
    id: string;
    user_id: string;
    access_token_encrypted: string;
    refresh_token_encrypted: string;
  }> {
    const refreshToken = this.decryptToken(connection.refresh_token_encrypted);

    const tokenUrl = process.env.CALENDLY_OAUTH_TOKEN_URL || 'https://auth.calendly.com/oauth/token';
    const clientId = this.getRequiredEnv('CALENDLY_OAUTH_CLIENT_ID');
    const clientSecret = this.getRequiredEnv('CALENDLY_OAUTH_CLIENT_SECRET');

    const payload = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const { data } = await axios.post<CalendlyTokenResponse>(tokenUrl, payload.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 20000,
    });

    const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;

    return this.prisma.calendlyConnection.update({
      where: { id: connection.id },
      data: {
        access_token_encrypted: this.encryptToken(data.access_token),
        refresh_token_encrypted: this.encryptToken(data.refresh_token || refreshToken),
        token_type: data.token_type || 'Bearer',
        scope: data.scope,
        expires_at: expiresAt,
        last_sync_at: new Date(),
        last_error: null,
      },
      select: {
        id: true,
        user_id: true,
        access_token_encrypted: true,
        refresh_token_encrypted: true,
      },
    });
  }

  private async fetchCalendlyResource(accessToken: string, uri: string): Promise<any> {
    const normalizedUri = this.normalizeCalendlyUri(uri);
    const { data } = await axios.get(normalizedUri, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 20000,
    });

    return data;
  }

  private async exchangeAuthorizationCode(code: string): Promise<CalendlyTokenResponse> {
    const tokenUrl = process.env.CALENDLY_OAUTH_TOKEN_URL || 'https://auth.calendly.com/oauth/token';
    const clientId = this.getRequiredEnv('CALENDLY_OAUTH_CLIENT_ID');
    const clientSecret = this.getRequiredEnv('CALENDLY_OAUTH_CLIENT_SECRET');
    const redirectUri = this.getRequiredEnv('CALENDLY_OAUTH_REDIRECT_URI');

    const payload = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const { data } = await axios.post<CalendlyTokenResponse>(tokenUrl, payload.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 20000,
    });

    if (!data.access_token || !data.refresh_token) {
      throw new InternalServerErrorException('Calendly não retornou tokens válidos');
    }

    return data;
  }

  private async fetchCalendlyMe(accessToken: string): Promise<CalendlyUserMeResponse> {
    const { data } = await axios.get<CalendlyUserMeResponse>('https://api.calendly.com/users/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 20000,
    });

    return data;
  }

  private async ensureWebhookSubscription(userId: string): Promise<void> {
    const callbackUrl = process.env.CALENDLY_WEBHOOK_CALLBACK_URL;
    if (!callbackUrl) {
      return;
    }

    const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

    const connection = await this.prisma.calendlyConnection.findUnique({
      where: { user_id: userId },
      select: {
        id: true,
        access_token_encrypted: true,
        calendly_user_uri: true,
        calendly_organization_uri: true,
      },
    });

    if (!connection) {
      return;
    }

    const accessToken = this.decryptToken(connection.access_token_encrypted);

    const payload: Record<string, any> = {
      url: callbackUrl,
      events: ['invitee.created', 'invitee.canceled'],
      organization: connection.calendly_organization_uri,
      user: connection.calendly_user_uri,
      scope: 'user',
    };

    if (signingKey) {
      payload.signing_key = signingKey;
    }

    let data: any;

    try {
      const response = await axios.post(
        'https://api.calendly.com/webhook_subscriptions',
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        },
      );
      data = response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      const shouldRetryWithoutSigningKey = Boolean(signingKey) && (status === 400 || status === 422);

      if (!shouldRetryWithoutSigningKey) {
        throw error;
      }

      this.logger.warn(
        'Calendly rejeitou webhook com signing_key; tentando novamente sem signing_key',
      );

      const fallbackPayload = { ...payload };
      delete fallbackPayload.signing_key;

      const fallbackResponse = await axios.post(
        'https://api.calendly.com/webhook_subscriptions',
        fallbackPayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        },
      );

      data = fallbackResponse.data;
    }

    const webhookResource = data?.resource;

    await this.prisma.calendlyConnection.update({
      where: { id: connection.id },
      data: {
        webhook_uri: webhookResource?.uri || callbackUrl,
        webhook_subscription_uri: webhookResource?.uri || null,
        last_sync_at: new Date(),
        last_error: null,
      },
    });
  }

  private validateWebhookSignature(rawBody: string | undefined, signatureHeader: string | undefined): void {
    const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

    if (!signingKey) {
      return;
    }

    if (!rawBody || !signatureHeader) {
      throw new ForbiddenException('Assinatura do webhook ausente');
    }

    const parsedSignature = this.parseSignatureHeader(signatureHeader);
    if (!parsedSignature.t || !parsedSignature.v1) {
      throw new ForbiddenException('Formato de assinatura inválido');
    }

    const signedPayload = `${parsedSignature.t}.${rawBody}`;
    const expected = createHmac('sha256', signingKey).update(signedPayload).digest('hex');

    const providedBuffer = Buffer.from(parsedSignature.v1, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new ForbiddenException('Assinatura do webhook inválida');
    }
  }

  private parseSignatureHeader(signatureHeader: string): { t?: string; v1?: string } {
    return signatureHeader.split(',').reduce(
      (acc, item) => {
        const [rawKey, rawValue] = item.split('=');
        const key = rawKey?.trim();
        const value = rawValue?.trim();

        if (key && value) {
          acc[key as 't' | 'v1'] = value;
        }

        return acc;
      },
      {} as { t?: string; v1?: string },
    );
  }

  private normalizeCalendlyUri(uri: string): string {
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return uri;
    }

    if (uri.startsWith('/')) {
      return `https://api.calendly.com${uri}`;
    }

    return `https://api.calendly.com/${uri}`;
  }

  private getRequiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new InternalServerErrorException(`Variável de ambiente obrigatória ausente: ${name}`);
    }
    return value;
  }

  private getEncryptionKeyBuffer(): Buffer {
    const raw = process.env.CALENDLY_TOKEN_ENCRYPTION_KEY;

    if (!raw) {
      throw new InternalServerErrorException(
        'Variável CALENDLY_TOKEN_ENCRYPTION_KEY não configurada',
      );
    }

    const normalizedRaw = raw.trim();
    const possibleBase64 = Buffer.from(normalizedRaw, 'base64');
    const normalizedDecoded = possibleBase64.toString('base64').replace(/=+$/, '');
    const normalizedInput = normalizedRaw.replace(/=+$/, '');

    if (possibleBase64.length === 32 && normalizedDecoded === normalizedInput) {
      return possibleBase64;
    }

    const utf8 = Buffer.from(normalizedRaw, 'utf8');
    if (utf8.length === 32) {
      return utf8;
    }

    throw new InternalServerErrorException(
      'CALENDLY_TOKEN_ENCRYPTION_KEY deve ter 32 bytes (UTF-8) ou base64 de 32 bytes',
    );
  }

  private encryptToken(value: string): string {
    const key = this.getEncryptionKeyBuffer();
    const iv = randomBytes(12);

    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  private decryptToken(value: string): string {
    const [version, ivBase64, authTagBase64, encryptedBase64] = value.split(':');

    if (version !== 'v1' || !ivBase64 || !authTagBase64 || !encryptedBase64) {
      throw new InternalServerErrorException('Formato de token criptografado inválido');
    }

    const key = this.getEncryptionKeyBuffer();
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
