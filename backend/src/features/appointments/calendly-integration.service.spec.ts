import { ConflictException } from '@nestjs/common';
import { AppointmentSchedulingMethod } from '@prisma/client';
import { CalendlyIntegrationService } from './calendly-integration.service';
import axios from 'axios';

jest.mock('axios');

describe('CalendlyIntegrationService connection lifecycle', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CALENDLY_OAUTH_CLIENT_ID = 'client-id';
    process.env.CALENDLY_OAUTH_CLIENT_SECRET = 'client-secret';
    process.env.CALENDLY_OAUTH_REDIRECT_URI = 'https://app.test/callback';
    process.env.CALENDLY_TOKEN_ENCRYPTION_KEY =
      '12345678901234567890123456789012';
    delete process.env.CALENDLY_WEBHOOK_CALLBACK_URL;
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  function makeCallbackService(scheduling_url: string | undefined) {
    const prisma = {
      calendlyOauthState: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: 'state-1',
            user_id: 'specialist-1',
            used_at: null,
            expires_at: new Date(Date.now() + 60000),
            user: { id: 'specialist-1', role: 'SPECIALIST' },
          }),
        update: jest.fn().mockResolvedValue({}),
      },
      calendlyConnection: {
        upsert: jest.fn().mockResolvedValue({ user_id: 'specialist-1' }),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
    };
    jest
      .mocked(axios.post)
      .mockResolvedValue({
        data: {
          access_token: 'access',
          refresh_token: 'refresh',
          expires_in: 3600,
        },
      });
    jest
      .mocked(axios.get)
      .mockResolvedValue({
        data: {
          resource: {
            uri: 'https://api.calendly.com/users/1',
            current_organization: 'https://api.calendly.com/organizations/1',
            scheduling_url,
          },
        },
      });
    return { prisma, service: new CalendlyIntegrationService(prisma as any) };
  }

  it('persiste scheduling_url validada no callback OAuth', async () => {
    const { prisma, service } = makeCallbackService(
      'https://calendly.com/ana/reuniao',
    );
    expect(await service.handleOAuthCallback('code', 'state')).toBe(
      'specialist-1',
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'specialist-1' },
      data: {
        calendly_url: 'https://calendly.com/ana/reuniao',
        calendly_user_uri: 'https://api.calendly.com/users/1',
        calendly_organization_uri: 'https://api.calendly.com/organizations/1',
      },
    });
    expect(prisma.calendlyConnection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ is_active: true }),
        update: expect.objectContaining({ is_active: true }),
      }),
    );
  });

  it.each([
    undefined,
    'http://calendly.com/ana',
    'https://evilcalendly.com/ana',
    'https://calendly.com.evil.test/ana',
    'https://calendly.com@evil.test/ana',
    'not-a-url',
  ])('rejeita scheduling_url inválida antes de persistir: %s', async (url) => {
    const { prisma, service } = makeCallbackService(url);
    await expect(service.handleOAuthCallback('code', 'state')).rejects.toThrow(
      'Calendly não retornou URL de agendamento válida',
    );
    expect(prisma.calendlyConnection.upsert).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.calendlyOauthState.update).not.toHaveBeenCalled();
  });

  it('desativa e limpa URL e URIs em uma transação', async () => {
    const tx = {
      calendlyConnection: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: any) =>
        typeof callback === 'function' ? callback(tx) : Promise.all(callback),
      ),
      calendlyConnection: {
        findUnique: jest.fn().mockResolvedValue({ id: 'connection-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
    };
    await new CalendlyIntegrationService(prisma as any).disconnect(
      'specialist-1',
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.calendlyConnection.updateMany).toHaveBeenCalledWith({
      where: { user_id: 'specialist-1' },
      data: { is_active: false, last_sync_at: expect.any(Date) },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'specialist-1' },
      data: {
        calendly_url: null,
        calendly_user_uri: null,
        calendly_organization_uri: null,
      },
    });
  });

  function makeRefreshService() {
    const prisma = {
      calendlyConnection: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new CalendlyIntegrationService(prisma as any);
    const connection = {
      id: 'connection-1',
      user_id: 'specialist-1',
      is_active: true,
      expires_at: new Date(0),
      access_token_encrypted: (service as any).encryptToken('expired-access'),
      refresh_token_encrypted: (service as any).encryptToken('valid-refresh'),
    };
    prisma.calendlyConnection.findUnique.mockResolvedValue(connection);
    prisma.calendlyConnection.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...connection, ...data }),
    );
    return { service, prisma, connection };
  }

  it.each([
    'https://evil/scheduled_events/event-1',
    'https://evil.test/scheduled_events/event-1',
    'https://calendly.com.evil/scheduled_events/event-1',
    'https://api.calendly.com.evil.test/scheduled_events/event-1',
    'http://api.calendly.com/scheduled_events/event-1',
    'https://user@api.calendly.com/scheduled_events/event-1',
    'https://api.calendly.com:444/scheduled_events/event-1',
    'https://127.0.0.1/scheduled_events/event-1',
  ])(
    'não envia o Bearer token para event_uri não confiável: %s',
    async (uri) => {
      const { service } = makeRefreshService();

      await expect(
        service.resolveScheduledStartTime('specialist-1', uri),
      ).rejects.toThrow('event_uri do Calendly inválida');
      expect(axios.get).not.toHaveBeenCalled();
    },
  );

  it('não segue redirect ao buscar recurso autenticado do Calendly', async () => {
    const { service } = makeRefreshService();
    jest.mocked(axios.get).mockRejectedValueOnce({
      response: {
        status: 302,
        headers: { location: 'http://127.0.0.1/internal' },
      },
    });

    await expect(
      service.resolveScheduledStartTime(
        'specialist-1',
        'https://api.calendly.com/scheduled_events/event-1',
      ),
    ).rejects.toBeDefined();
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.calendly.com/scheduled_events/event-1',
      expect.objectContaining({ maxRedirects: 0 }),
    );
  });

  it.each([
    'https://calendly.com/api/v2/scheduled_events/event-1',
    'https://api.calendly.com/api/v2/scheduled_events/event-1',
  ])('normaliza URI oficial antes da requisição autenticada: %s', async (uri) => {
    const { service } = makeRefreshService();
    jest.mocked(axios.get).mockResolvedValueOnce({
      data: { resource: { start_time: '2099-01-01T10:00:00.000Z' } },
    });

    await expect(
      service.resolveScheduledStartTime('specialist-1', uri),
    ).resolves.toEqual(new Date('2099-01-01T10:00:00.000Z'));
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.calendly.com/scheduled_events/event-1',
      expect.objectContaining({ maxRedirects: 0 }),
    );
  });

  it('rejeita evento divergente retornado pelo convidado mesmo quando há horário', async () => {
    const { service } = makeRefreshService();
    jest.mocked(axios.get).mockResolvedValueOnce({
      data: {
        resource: {
          event: 'https://api.calendly.com/scheduled_events/event-2',
          start_time: '2099-01-01T10:00:00.000Z',
        },
      },
    });

    await expect(
      service.resolveScheduledStartTime(
        'specialist-1',
        'https://calendly.com/api/v2/scheduled_events/event-1',
        'https://calendly.com/api/v2/scheduled_events/event-1/invitees/invitee-1',
      ),
    ).rejects.toThrow('URIs do Calendly pertencem a eventos diferentes');
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('aceita evento equivalente retornado pelo convidado e mantém fetch canônico', async () => {
    const { service } = makeRefreshService();
    jest.mocked(axios.get).mockResolvedValueOnce({
      data: {
        resource: {
          event:
            'https://api.calendly.com/api/v2/scheduled_events/event-1',
          start_time: '2099-01-01T10:00:00.000Z',
        },
      },
    });

    await expect(
      service.resolveScheduledStartTime(
        'specialist-1',
        'https://calendly.com/api/v2/scheduled_events/event-1',
        'https://calendly.com/api/v2/scheduled_events/event-1/invitees/invitee-1',
      ),
    ).resolves.toEqual(new Date('2099-01-01T10:00:00.000Z'));
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1',
      expect.objectContaining({ maxRedirects: 0 }),
    );
  });

  it('rejeita URI de evento não confiável retornada pelo recurso de convidado', async () => {
    const { service } = makeRefreshService();
    jest.mocked(axios.get).mockResolvedValueOnce({
      data: { resource: { event: 'http://127.0.0.1/internal' } },
    });

    await expect(
      service.resolveScheduledStartTime(
        'specialist-1',
        null,
        'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1',
      ),
    ).rejects.toThrow('event_uri do Calendly inválida');
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('mantém conexão ativa quando token expirado é renovado com sucesso', async () => {
    const { service, prisma } = makeRefreshService();
    jest
      .mocked(axios.get)
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockResolvedValueOnce({
        data: { resource: { start_time: '2099-01-01T10:00:00.000Z' } },
      });
    jest
      .mocked(axios.post)
      .mockResolvedValue({
        data: {
          access_token: 'renewed-access',
          refresh_token: 'renewed-refresh',
          expires_in: 3600,
        },
      });
    expect(
      await service.resolveScheduledStartTime(
        'specialist-1',
        'https://api.calendly.com/scheduled_events/1',
      ),
    ).toEqual(new Date('2099-01-01T10:00:00.000Z'));
    expect(
      prisma.calendlyConnection.update.mock.calls.every(
        ([input]) => input.data.is_active !== false,
      ),
    ).toBe(true);
    expect(axios.get).toHaveBeenLastCalledWith(
      'https://api.calendly.com/scheduled_events/1',
      expect.objectContaining({
        headers: { Authorization: 'Bearer renewed-access' },
      }),
    );
  });

  it('persiste desativação e erro após invalid_grant definitivo', async () => {
    const { service, prisma, connection } = makeRefreshService();
    const error = {
      response: { status: 400, data: { error: 'invalid_grant' } },
    };
    jest.mocked(axios.get).mockRejectedValue({ response: { status: 401 } });
    jest.mocked(axios.post).mockRejectedValue(error);
    await expect(
      service.resolveScheduledStartTime(
        'specialist-1',
        'https://api.calendly.com/scheduled_events/1',
      ),
    ).rejects.toBe(error);
    expect(prisma.calendlyConnection.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'connection-1',
        refresh_token_encrypted: connection.refresh_token_encrypted,
        is_active: true,
      },
      data: { is_active: false, last_error: 'invalid_grant' },
    });
  });

  it('preserva reconexão enquanto refresh antigo está pendente com invalid_grant', async () => {
    const { service, prisma } = makeCallbackService(
      'https://calendly.com/ana/reuniao',
    );
    const storedConnection = {
      id: 'connection-1',
      user_id: 'specialist-1',
      is_active: true,
      last_error: null as string | null,
      access_token_encrypted: (service as any).encryptToken('old-access'),
      refresh_token_encrypted: (service as any).encryptToken('old-refresh'),
    };
    const connectionClient = {
      ...prisma.calendlyConnection,
      findUnique: jest.fn(async () => ({ ...storedConnection })),
      update: jest.fn(async ({ data }) => {
        Object.assign(storedConnection, data);
        return { ...storedConnection };
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        const matches = Object.entries(where).every(
          ([key, value]) =>
            storedConnection[key as keyof typeof storedConnection] === value,
        );
        if (matches) Object.assign(storedConnection, data);
        return { count: matches ? 1 : 0 };
      }),
    };
    prisma.calendlyConnection = connectionClient;
    connectionClient.upsert.mockImplementation(async ({ update }) => {
      Object.assign(storedConnection, update);
      return { ...storedConnection };
    });

    let rejectRefresh!: (error: unknown) => void;
    let markRefreshStarted!: () => void;
    const refreshStarted = new Promise<void>((resolve) => {
      markRefreshStarted = resolve;
    });
    jest.mocked(axios.get).mockRejectedValueOnce({ response: { status: 401 } });
    jest.mocked(axios.post).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRefresh = reject;
          markRefreshStarted();
        }),
    );
    const error = {
      response: { status: 400, data: { error: 'invalid_grant' } },
    };
    const refreshResult = expect(
      service.resolveScheduledStartTime(
        'specialist-1',
        'https://api.calendly.com/scheduled_events/1',
      ),
    ).rejects.toBe(error);
    await refreshStarted;
    await service.handleOAuthCallback('new-code', 'new-state');
    const reconnectedTokens = {
      access_token_encrypted: storedConnection.access_token_encrypted,
      refresh_token_encrypted: storedConnection.refresh_token_encrypted,
    };
    expect(
      (service as any).decryptToken(reconnectedTokens.access_token_encrypted),
    ).toBe('access');
    expect(
      (service as any).decryptToken(reconnectedTokens.refresh_token_encrypted),
    ).toBe('refresh');

    rejectRefresh(error);
    await refreshResult;
    expect(storedConnection).toEqual(
      expect.objectContaining({
        ...reconnectedTokens,
        is_active: true,
        last_error: null,
      }),
    );
  });

  it('preserva conexão ativa após falha transitória de refresh', async () => {
    const { service, prisma } = makeRefreshService();
    jest.mocked(axios.get).mockRejectedValue({ response: { status: 401 } });
    jest.mocked(axios.post).mockRejectedValue({ response: { status: 503 } });
    await expect(
      service.resolveScheduledStartTime(
        'specialist-1',
        'https://api.calendly.com/scheduled_events/1',
      ),
    ).rejects.toBeDefined();
    expect(prisma.calendlyConnection.update).not.toHaveBeenCalled();
    expect(prisma.calendlyConnection.updateMany).not.toHaveBeenCalled();
  });
});

describe('CalendlyIntegrationService webhook schedule integrity', () => {
  it.each([
    AppointmentSchedulingMethod.EMAIL,
    AppointmentSchedulingMethod.PLATFORM,
  ])('ignora eventos do Calendly para origem %s', async (method) => {
    const appointment = {
      id: 'appointment-1',
      specialist_id: 'specialist-1',
      calendly_event_uri:
        'https://api.calendly.com/scheduled_events/event-1',
      scheduling_method: method,
      specialist_rescheduled_at: null,
    };
    const prisma = {
      appointment: {
        findMany: jest.fn().mockResolvedValue([appointment]),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const service = new CalendlyIntegrationService(prisma as any);
    jest
      .spyOn(service as any, 'validateWebhookSignature')
      .mockReturnValue(undefined);

    const result = await service.processWebhook(
      {
        event: 'invitee.created',
        payload: {
          event: appointment.calendly_event_uri,
          scheduled_event: { start_time: '2099-01-01T10:00:00.000Z' },
        },
      },
      undefined,
      undefined,
    );

    expect(result.processed).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it('ignora eventos posteriores à alteração definitiva do especialista', async () => {
    const appointment = {
      id: 'appointment-1',
      specialist_id: 'specialist-1',
      calendly_event_uri:
        'https://api.calendly.com/scheduled_events/event-1',
      scheduling_method: AppointmentSchedulingMethod.CALENDLY,
      specialist_rescheduled_at: new Date('2026-01-01T00:00:00.000Z'),
    };
    const prisma = {
      appointment: { findMany: jest.fn().mockResolvedValue([appointment]) },
      $transaction: jest.fn(),
    };
    const service = new CalendlyIntegrationService(prisma as any);
    jest
      .spyOn(service as any, 'validateWebhookSignature')
      .mockReturnValue(undefined);

    const result = await service.processWebhook(
      {
        event: 'invitee.created',
        payload: {
          event: appointment.calendly_event_uri,
          scheduled_event: { start_time: '2099-01-01T10:00:00.000Z' },
        },
      },
      undefined,
      undefined,
    );

    expect(result.processed).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('serializes and rechecks an invitee.created time before writing it', async () => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      calendly_event_uri:
        'https://calendly.com/api/v2/scheduled_events/event-1',
      calendly_invitee_uri:
        'https://calendly.com/api/v2/scheduled_events/event-1/invitees/invitee-1',
      calendly_sync_status: 'PENDING',
      appointment_datetime: null,
      scheduling_method: AppointmentSchedulingMethod.CALENDLY,
      specialist_rescheduled_at: null,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(appointment),
      },
    };
    const prisma = {
      appointment: {
        findMany: jest.fn().mockResolvedValue([appointment]),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue(appointment),
      },
      $transaction: jest.fn(async (callback: (client: any) => unknown) =>
        callback(tx),
      ),
    };
    const service = new CalendlyIntegrationService(prisma as any);
    jest
      .spyOn(service as any, 'validateWebhookSignature')
      .mockReturnValue(undefined);

    await service.processWebhook(
      {
        event: 'invitee.created',
        payload: {
          event:
            'https://calendly.com/api/v2/scheduled_events/event-1',
          uri:
            'https://api.calendly.com/api/v2/scheduled_events/event-1/invitees/invitee-1',
          scheduled_event: {
            start_time: '2099-01-01T10:00:00.000Z',
          },
        },
      } as any,
      undefined,
      undefined,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.appointment.findMany).toHaveBeenCalledWith({
      where: {
        calendly_invitee_uri: {
          in: expect.arrayContaining([
            'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1',
            'https://api.calendly.com/api/v2/scheduled_events/event-1/invitees/invitee-1',
            'https://calendly.com/api/v2/scheduled_events/event-1/invitees/invitee-1',
          ]),
        },
      },
      take: 2,
    });
    expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.appointment.findUnique).toHaveBeenCalledWith({
      where: { id: appointment.id },
    });
    expect(tx.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          specialist_id: appointment.specialist_id,
          id: { not: appointment.id },
        }),
      }),
    );
    expect(tx.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          calendly_event_uri:
            'https://api.calendly.com/scheduled_events/event-1',
          calendly_invitee_uri:
            'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1',
        }),
      }),
    );
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it('encontra e canonicaliza registro legado ao cancelar pelo webhook', async () => {
    const appointment = {
      id: 'appointment-1',
      specialist_id: 'specialist-1',
      scheduling_method: AppointmentSchedulingMethod.CALENDLY,
      specialist_rescheduled_at: null,
      calendly_event_uri:
        'https://calendly.com/api/v2/scheduled_events/event-1',
      calendly_invitee_uri:
        'https://api.calendly.com/api/v2/scheduled_events/event-1/invitees/invitee-1',
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      appointment: {
        findMany: jest.fn().mockResolvedValue([appointment]),
      },
      $transaction: jest.fn(async (callback: (client: any) => unknown) =>
        callback(tx),
      ),
    };
    const service = new CalendlyIntegrationService(prisma as any);
    jest
      .spyOn(service as any, 'validateWebhookSignature')
      .mockReturnValue(undefined);

    await expect(
      service.processWebhook(
        {
          event: 'invitee.canceled',
          payload: {
            event:
              'https://api.calendly.com/scheduled_events/event-1',
            uri:
              'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1',
          },
        } as any,
        undefined,
        undefined,
      ),
    ).resolves.toEqual({
      processed: true,
      message: 'Webhook de cancelamento processado',
    });
    expect(prisma.appointment.findMany).toHaveBeenCalledWith({
      where: {
        calendly_invitee_uri: {
          in: expect.arrayContaining([
            appointment.calendly_invitee_uri,
            'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1',
          ]),
        },
      },
      take: 2,
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.appointment.updateMany).toHaveBeenCalledWith({
      where: {
        id: appointment.id,
        calendly_event_uri: appointment.calendly_event_uri,
        calendly_invitee_uri: appointment.calendly_invitee_uri,
      },
      data: {
        calendly_event_uri:
          'https://api.calendly.com/scheduled_events/event-1',
        calendly_invitee_uri:
          'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1',
        calendly_last_sync_at: expect.any(Date),
        calendly_sync_status: 'FAILED',
      },
    });
  });

  it('falha fechado quando fallback por evento encontra dois convidados do mesmo grupo', async () => {
    const appointments = [
      {
        id: 'appointment-1',
        specialist_id: 'specialist-1',
        calendly_event_uri:
          'https://api.calendly.com/scheduled_events/group-event',
      },
      {
        id: 'appointment-2',
        specialist_id: 'specialist-1',
        calendly_event_uri:
          'https://calendly.com/api/v2/scheduled_events/group-event',
      },
    ];
    const prisma = {
      appointment: { findMany: jest.fn().mockResolvedValue(appointments) },
      $transaction: jest.fn(),
    };
    const service = new CalendlyIntegrationService(prisma as any);
    jest
      .spyOn(service as any, 'validateWebhookSignature')
      .mockReturnValue(undefined);

    await expect(
      service.processWebhook(
        {
          event: 'invitee.created',
          payload: {
            event:
              'https://api.calendly.com/scheduled_events/group-event',
          },
        },
        undefined,
        undefined,
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.appointment.findMany).toHaveBeenCalledWith({
      where: {
        calendly_event_uri: {
          in: expect.arrayContaining([
            'https://api.calendly.com/scheduled_events/group-event',
            'https://calendly.com/api/v2/scheduled_events/group-event',
          ]),
        },
      },
      take: 2,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('não deixa webhook created antigo sobrescrever uma nova associação', async () => {
    const snapshot = {
      id: 'appointment-1',
      specialist_id: 'specialist-1',
      scheduling_method: AppointmentSchedulingMethod.CALENDLY,
      specialist_rescheduled_at: null,
      calendly_event_uri:
        'https://api.calendly.com/scheduled_events/event-1',
      calendly_invitee_uri:
        'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-old',
    };
    const locked = {
      ...snapshot,
      calendly_invitee_uri:
        'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-new',
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      appointment: {
        findUnique: jest.fn().mockResolvedValue(locked),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    const prisma = {
      appointment: { findMany: jest.fn().mockResolvedValue([snapshot]) },
      $transaction: jest.fn(async (callback: (client: any) => unknown) =>
        callback(tx),
      ),
    };
    const service = new CalendlyIntegrationService(prisma as any);
    jest
      .spyOn(service as any, 'validateWebhookSignature')
      .mockReturnValue(undefined);

    await expect(
      service.processWebhook(
        {
          event: 'invitee.created',
          payload: {
            event:
              'https://api.calendly.com/scheduled_events/event-1',
            uri: snapshot.calendly_invitee_uri,
            scheduled_event: { start_time: '2099-01-01T10:00:00.000Z' },
          },
        } as any,
        undefined,
        undefined,
      ),
    ).resolves.toEqual({
      processed: false,
      message: 'Webhook ignorado para preservar a associação atual',
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.appointment.findFirst).not.toHaveBeenCalled();
    expect(tx.appointment.update).not.toHaveBeenCalled();
  });

  it('serializa cancelamento e não confirma processamento quando perde o CAS', async () => {
    const appointment = {
      id: 'appointment-1',
      specialist_id: 'specialist-1',
      scheduling_method: AppointmentSchedulingMethod.CALENDLY,
      specialist_rescheduled_at: null,
      calendly_event_uri:
        'https://api.calendly.com/scheduled_events/event-1',
      calendly_invitee_uri:
        'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1',
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      appointment: { findMany: jest.fn().mockResolvedValue([appointment]) },
      $transaction: jest.fn(async (callback: (client: any) => unknown) =>
        callback(tx),
      ),
    };
    const service = new CalendlyIntegrationService(prisma as any);
    jest
      .spyOn(service as any, 'validateWebhookSignature')
      .mockReturnValue(undefined);

    await expect(
      service.processWebhook(
        {
          event: 'invitee.canceled',
          payload: {
            event: appointment.calendly_event_uri,
            uri: appointment.calendly_invitee_uri,
          },
        } as any,
        undefined,
        undefined,
      ),
    ).resolves.toEqual({
      processed: false,
      message: 'Webhook ignorado para preservar a associação atual',
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.appointment.updateMany).toHaveBeenCalledTimes(1);
  });

  it('não deixa webhook canceled antigo cancelar uma nova associação', async () => {
    const snapshot = {
      id: 'appointment-1',
      specialist_id: 'specialist-1',
      scheduling_method: AppointmentSchedulingMethod.CALENDLY,
      specialist_rescheduled_at: null,
      calendly_event_uri:
        'https://api.calendly.com/scheduled_events/event-1',
      calendly_invitee_uri:
        'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-old',
    };
    const locked = {
      ...snapshot,
      calendly_invitee_uri:
        'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-new',
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      appointment: {
        findUnique: jest.fn().mockResolvedValue(locked),
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      appointment: { findMany: jest.fn().mockResolvedValue([snapshot]) },
      $transaction: jest.fn(async (callback: (client: any) => unknown) =>
        callback(tx),
      ),
    };
    const service = new CalendlyIntegrationService(prisma as any);
    jest
      .spyOn(service as any, 'validateWebhookSignature')
      .mockReturnValue(undefined);

    await expect(
      service.processWebhook(
        {
          event: 'invitee.canceled',
          payload: {
            event: snapshot.calendly_event_uri,
            uri: snapshot.calendly_invitee_uri,
          },
        } as any,
        undefined,
        undefined,
      ),
    ).resolves.toEqual({
      processed: false,
      message: 'Webhook ignorado para preservar a associação atual',
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.appointment.updateMany).not.toHaveBeenCalled();
  });
});
