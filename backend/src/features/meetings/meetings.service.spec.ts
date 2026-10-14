import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Prisma,
  ProcessStatus,
  ProductCurrency,
  ProductType,
  StatusAgendamento,
} from '@prisma/client';
import { MeetingsService } from './meetings.service';

function mkProcess(overrides: any = {}) {
  return {
    id: 'proc-1',
    client_id: 'client-1',
    specialist_id: 'spec-1',
    status: 'SCHEDULING',
    meeting_session: null,
    client: {
      id: 'client-1',
      email: 'cliente@externo.com',
      name: 'Cliente',
      surname: 'Teste',
      consultant_id: null,
      consultant: null,
    },
    specialist: {
      id: 'spec-1',
      email: 'spec@empresa.com',
      name: 'Espec',
      surname: 'Ialista',
    },
    ...overrides,
  };
}

function mkPrisma(process: any) {
  let storedMeeting = process.meeting_session;
  const meetingSessionCreate = jest.fn().mockImplementation(({ data }: any) => {
    storedMeeting = {
      id: 'meet-1',
      process_id: data.process_id,
      calendar_event_id: data.calendar_event_id,
      meet_link: data.meet_link,
      started_at: data.started_at,
      ended_at: null,
    };
    return Promise.resolve(storedMeeting);
  });
  const meetingSessionUpdateMany = jest
    .fn()
    .mockImplementation(({ where, data }: any) => {
      if (
        storedMeeting &&
        (!where.id || where.id === storedMeeting.id) &&
        (!where.process_id || where.process_id === storedMeeting.process_id) &&
        (!where.calendar_event_id ||
          where.calendar_event_id === storedMeeting.calendar_event_id) &&
        (where.meet_link === undefined ||
          where.meet_link === storedMeeting.meet_link)
      ) {
        storedMeeting = { ...storedMeeting, ...data };
        return Promise.resolve({ count: 1 });
      }
      return Promise.resolve({ count: 0 });
    });
  const meetingSessionDeleteMany = jest.fn().mockImplementation(({ where }) => {
    if (
      storedMeeting &&
      (!where.id || where.id === storedMeeting.id) &&
      (!where.process_id || where.process_id === storedMeeting.process_id) &&
      (!where.calendar_event_id ||
        where.calendar_event_id === storedMeeting.calendar_event_id)
    ) {
      storedMeeting = null;
      return Promise.resolve({ count: 1 });
    }
    return Promise.resolve({ count: 0 });
  });
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
    process: {
      findUnique: jest
        .fn()
        .mockImplementation(({ select }: any) =>
          Promise.resolve(
            select
              ? { id: process.id, specialist_id: process.specialist_id }
              : { ...process, meeting_session: storedMeeting },
          ),
        ),
    },
    meetingSession: {
      create: meetingSessionCreate,
      updateMany: meetingSessionUpdateMany,
      deleteMany: meetingSessionDeleteMany,
      findUnique: jest.fn().mockImplementation(() => storedMeeting),
    },
  };
  return {
    process: {
      findUnique: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ ...process, meeting_session: storedMeeting }),
        ),
    },
    meetingSession: {
      create: meetingSessionCreate,
      updateMany: meetingSessionUpdateMany,
      deleteMany: meetingSessionDeleteMany,
    },
    $transaction: jest.fn(async (callback) => callback(tx)),
  } as any;
}

function mkConfig(accessType = 'OPEN', provider = 'GOOGLE') {
  return {
    get: jest.fn((key: string, def?: string) => {
      if (key === 'GOOGLE_MEET_ACCESS_TYPE') return accessType;
      if (key === 'MEETING_PROVIDER') return provider;
      if (key === 'MEETING_DEMO_FALLBACK_ENABLED') return 'false';
      return def;
    }),
  } as any;
}

const notification = {
  sendMeetingStartedEmail: jest.fn().mockResolvedValue({}),
  sendMeetingAdvancedEmail: jest.fn().mockResolvedValue({}),
  sendProcessStatusChangedEmail: jest.fn().mockResolvedValue({}),
} as any;

describe('MeetingsService — criação via Meet REST API', () => {
  afterEach(() => jest.restoreAllMocks());

  it('cria sala Meet com accessType OPEN e grava meet_link + spaceName', async () => {
    const process = mkProcess();
    const prisma = mkPrisma(process);
    let transactionActive = false;
    const runTransaction = prisma.$transaction.getMockImplementation();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: any) => Promise<unknown>, options?: any) => {
        transactionActive = true;
        try {
          return await runTransaction(callback, options);
        } finally {
          transactionActive = false;
        }
      },
    );
    const oauth = {
      getAccessToken: jest.fn().mockImplementation(async () => {
        expect(transactionActive).toBe(false);
        return 'access-token';
      }),
    } as any;

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'spaces/abc123',
        meetingUri: 'https://meet.google.com/abc-defg-hij',
      }),
    });
    global.fetch = fetchMock as any;

    const svc = new MeetingsService(
      prisma,
      mkConfig('OPEN'),
      notification,
      oauth,
    );
    const result = await svc.startMeetingForProcess('proc-1', 'spec-1');

    // accessType OPEN enviado no body
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.config.accessType).toBe('OPEN');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://meet.googleapis.com/v2/spaces',
    );

    expect(result.meet_link).toBe('https://meet.google.com/abc-defg-hij');
    expect(prisma.meetingSession.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          calendar_event_id: 'spaces/abc123',
        }),
      }),
    );
  });

  it('sem conexão ativa → ServiceUnavailableException (sem fallback)', async () => {
    const process = mkProcess();
    const prisma = mkPrisma(process);
    const oauth = {
      getAccessToken: jest
        .fn()
        .mockRejectedValue(new ServiceUnavailableException('não conectado')),
    } as any;

    const svc = new MeetingsService(
      prisma,
      mkConfig('OPEN'),
      notification,
      oauth,
    );
    await expect(
      svc.startMeetingForProcess('proc-1', 'spec-1'),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(prisma.meetingSession.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        process_id: 'proc-1',
        calendar_event_id: expect.stringMatching(/^meeting-init:/),
      }),
    });
  });

  it('aborta provider travado por timeout e libera o claim', async () => {
    jest.useFakeTimers();
    try {
      const process = mkProcess();
      const prisma = mkPrisma(process);
      const oauth = {
        getAccessToken: jest.fn().mockResolvedValue('access-token'),
      } as any;
      const fetchMock = jest.fn().mockImplementation((_url, options) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new Error('provider abortado'));
          });
        });
      });
      global.fetch = fetchMock as any;
      const svc = new MeetingsService(
        prisma,
        mkConfig('OPEN'),
        notification,
        oauth,
      );

      const start = svc.startMeetingForProcess('proc-1', 'spec-1');
      const rejection = expect(start).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      for (
        let attempt = 0;
        attempt < 50 && !fetchMock.mock.calls.length;
        attempt += 1
      ) {
        await Promise.resolve();
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(10_000);

      await rejection;
      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
      expect(prisma.meetingSession.deleteMany).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('aplica a deadline enquanto o OAuth está pendente e não chama o provider', async () => {
    jest.useFakeTimers();
    const originalFetch = global.fetch;
    try {
      const process = mkProcess();
      const prisma = mkPrisma(process);
      let resolveOAuth!: (token: string) => void;
      const oauth = {
        getAccessToken: jest.fn().mockImplementation(
          () =>
            new Promise<string>((resolve) => {
              resolveOAuth = resolve;
            }),
        ),
      } as any;
      const fetchMock = jest.fn();
      global.fetch = fetchMock as any;
      const svc = new MeetingsService(
        prisma,
        mkConfig('OPEN'),
        notification,
        oauth,
      );
      let caught: unknown;
      void svc
        .startMeetingForProcess('proc-1', 'spec-1')
        .catch((error) => (caught = error));

      for (
        let attempt = 0;
        attempt < 10 && !oauth.getAccessToken.mock.calls.length;
        attempt += 1
      ) {
        await Promise.resolve();
      }
      expect(oauth.getAccessToken).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(10_000);
      for (let attempt = 0; attempt < 10 && !caught; attempt += 1) {
        await Promise.resolve();
      }

      expect(caught).toBeInstanceOf(ServiceUnavailableException);
      resolveOAuth('access-token-atrasado');
      await Promise.resolve();
      await Promise.resolve();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(prisma.meetingSession.updateMany).not.toHaveBeenCalled();
      expect(prisma.meetingSession.deleteMany).toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
      jest.useRealTimers();
    }
  });

  it('mantém a deadline até terminar o parse do body e não persiste sala atrasada', async () => {
    jest.useFakeTimers();
    const originalFetch = global.fetch;
    try {
      const process = mkProcess();
      const prisma = mkPrisma(process);
      const oauth = {
        getAccessToken: jest.fn().mockResolvedValue('access-token'),
      } as any;
      let resolveJson!: (body: unknown) => void;
      const json = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveJson = resolve;
          }),
      );
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, json });
      global.fetch = fetchMock as any;
      const svc = new MeetingsService(
        prisma,
        mkConfig('OPEN'),
        notification,
        oauth,
      );
      let caught: unknown;
      void svc
        .startMeetingForProcess('proc-1', 'spec-1')
        .catch((error) => (caught = error));

      for (
        let attempt = 0;
        attempt < 50 && !json.mock.calls.length;
        attempt += 1
      ) {
        await Promise.resolve();
      }
      expect(json).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(10_000);
      for (let attempt = 0; attempt < 10 && !caught; attempt += 1) {
        await Promise.resolve();
      }

      expect(caught).toBeInstanceOf(ServiceUnavailableException);
      resolveJson({
        name: 'spaces/atrasada',
        meetingUri: 'https://meet.google.com/atrasada',
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(prisma.meetingSession.updateMany).not.toHaveBeenCalled();
      expect(prisma.meetingSession.deleteMany).toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
      jest.useRealTimers();
    }
  });

  it('recupera claim pronto sem chamar o provedor nem duplicar notificação', async () => {
    const process = mkProcess({
      meeting_session: {
        id: 'meet-1',
        process_id: 'proc-1',
        calendar_event_id: 'meeting-ready:claim-1:GOOGLE:spaces%2Frecovered',
        meet_link: 'https://meet.google.com/recovered',
        started_at: new Date(),
        ended_at: null,
      },
    });
    const prisma = mkPrisma(process);
    const oauth = { getAccessToken: jest.fn() } as any;
    const localNotification = {
      sendMeetingStartedEmail: jest.fn().mockResolvedValue({}),
      sendMeetingAdvancedEmail: jest.fn().mockResolvedValue({}),
    } as any;
    const svc = new MeetingsService(
      prisma,
      mkConfig('OPEN'),
      localNotification,
      oauth,
    );

    await expect(
      svc.startMeetingForProcess('proc-1', 'spec-1'),
    ).resolves.toMatchObject({
      meet_link: 'https://meet.google.com/recovered',
      is_active: true,
    });
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(oauth.getAccessToken).not.toHaveBeenCalled();
    expect(prisma.meetingSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { calendar_event_id: 'spaces/recovered' },
      }),
    );
    expect(localNotification.sendMeetingStartedEmail).toHaveBeenCalledTimes(1);
  });

  it('recusa start duplicado enquanto um claim recente está inicializando', async () => {
    const process = mkProcess({
      meeting_session: {
        id: 'meet-1',
        process_id: 'proc-1',
        calendar_event_id: 'meeting-init:claim-1',
        meet_link: '',
        started_at: new Date(),
        ended_at: null,
      },
    });
    const prisma = mkPrisma(process);
    const oauth = { getAccessToken: jest.fn() } as any;
    const svc = new MeetingsService(
      prisma,
      mkConfig('OPEN'),
      notification,
      oauth,
    );

    await expect(
      svc.startMeetingForProcess('proc-1', 'spec-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(oauth.getAccessToken).not.toHaveBeenCalled();
    expect(prisma.meetingSession.create).not.toHaveBeenCalled();
  });

  it('não conclui conversa usando claim de inicialização vencido', async () => {
    const process = mkProcess({
      meeting_session: {
        id: 'meet-1',
        process_id: 'proc-1',
        calendar_event_id: 'meeting-init:claim-vencido',
        meet_link: '',
        started_at: new Date(Date.now() - 3 * 60 * 1000),
        ended_at: null,
      },
    });
    const prisma = mkPrisma(process);
    const svc = new MeetingsService(
      prisma,
      mkConfig('OPEN'),
      notification,
      {} as any,
    );

    await expect(
      svc.markConversationDone('proc-1', 'spec-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.meetingSession.deleteMany).not.toHaveBeenCalled();
  });

  it('só o especialista pode iniciar a reunião', async () => {
    const process = mkProcess();
    const prisma = mkPrisma(process);
    const oauth = { getAccessToken: jest.fn() } as any;

    const svc = new MeetingsService(
      prisma,
      mkConfig('OPEN'),
      notification,
      oauth,
    );
    // cliente tentando iniciar
    await expect(
      svc.startMeetingForProcess('proc-1', 'client-1'),
    ).rejects.toThrow(/especialista/i);
  });
});

describe('MeetingsService.startMeetingForProcess — serialização canônica', () => {
  it('remove o claim se a revalidação final encontrar processo terminal', async () => {
    const process = mkProcess();
    const prisma = mkPrisma(process);
    const runTransaction = prisma.$transaction.getMockImplementation();
    let transactionCount = 0;
    prisma.$transaction.mockImplementation(async (callback, options) => {
      transactionCount += 1;
      if (transactionCount === 2) {
        process.status = ProcessStatus.REJECTED;
      }
      return runTransaction(callback, options);
    });
    const localNotification = {
      sendMeetingStartedEmail: jest.fn().mockResolvedValue({}),
      sendMeetingAdvancedEmail: jest.fn().mockResolvedValue({}),
    } as any;
    const service = new MeetingsService(
      prisma,
      mkConfig('OPEN', 'JITSI'),
      localNotification,
      {} as any,
    );

    await expect(
      service.startMeetingForProcess(process.id, 'spec-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.meetingSession.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'meet-1',
        calendar_event_id: expect.stringMatching(/^meeting-ready:/),
      }),
    });
    expect(localNotification.sendMeetingStartedEmail).not.toHaveBeenCalled();
  });

  it('adquire o lock, relê e não cria reunião para processo rejeitado', async () => {
    const initialProcess = mkProcess();
    const rejectedProcess = mkProcess({ status: ProcessStatus.REJECTED });
    const rootMeetingCreate = jest.fn().mockResolvedValue({});
    const txMeetingCreate = jest.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: initialProcess.id,
            specialist_id: initialProcess.specialist_id,
          })
          .mockResolvedValueOnce(rejectedProcess),
      },
      meetingSession: { create: txMeetingCreate },
    };
    const prisma = {
      process: { findUnique: jest.fn().mockResolvedValue(initialProcess) },
      meetingSession: { create: rootMeetingCreate },
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as any;
    const localNotification = {
      sendMeetingStartedEmail: jest.fn().mockResolvedValue({}),
      sendMeetingAdvancedEmail: jest.fn().mockResolvedValue({}),
    } as any;
    const service = new MeetingsService(
      prisma,
      mkConfig('OPEN', 'JITSI'),
      localNotification,
      {} as any,
    );

    await expect(
      service.startMeetingForProcess(initialProcess.id, 'spec-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      'appointment-schedule:spec-1',
    );
    expect(rootMeetingCreate).not.toHaveBeenCalled();
    expect(txMeetingCreate).not.toHaveBeenCalled();
    expect(localNotification.sendMeetingStartedEmail).not.toHaveBeenCalled();
  });

  it('falha fechado quando o appointment relido diverge do processo', async () => {
    const process = mkProcess({
      appointment_id: 'appointment-1',
      appointment: {
        id: 'appointment-1',
        client_id: 'other-client',
        specialist_id: 'spec-1',
        status: StatusAgendamento.COMPLETED,
      },
    });
    const txMeetingCreate = jest.fn();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: process.id,
            specialist_id: process.specialist_id,
          })
          .mockResolvedValueOnce(process),
      },
      meetingSession: { create: txMeetingCreate },
    };
    const prisma = {
      process: { findUnique: jest.fn().mockResolvedValue(process) },
      meetingSession: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as any;
    const service = new MeetingsService(
      prisma,
      mkConfig('OPEN', 'JITSI'),
      notification,
      {} as any,
    );

    await expect(
      service.startMeetingForProcess(process.id, 'spec-1'),
    ).rejects.toThrow('Agendamento não corresponde aos participantes');

    expect(txMeetingCreate).not.toHaveBeenCalled();
  });
});

describe('MeetingsService.markConversationDone — snapshot da negociação', () => {
  it('grava snapshot USD, status e histórico na mesma transação', async () => {
    const product = {
      id: 'product-1',
      marca: 'Porsche',
      modelo: '911',
      valor: new Prisma.Decimal('120000.00'),
      currency: ProductCurrency.USD,
    };
    const process = mkProcess({
      status: ProcessStatus.SCHEDULING,
      product_type: ProductType.CAR,
      car_id: product.id,
      boat_id: null,
      aircraft_id: null,
      negotiation_currency: null,
      negotiation_product_value: null,
      notes: null,
      car: product,
      boat: null,
      aircraft: null,
      meeting_session: {
        id: 'meeting-1',
        process_id: 'proc-1',
        meet_link: 'https://meet.google.com/abc-defg-hij',
        started_at: new Date('2026-01-01T10:00:00.000Z'),
        ended_at: null,
      },
    });
    const txProcessUpdate = jest.fn().mockResolvedValue({
      status: ProcessStatus.NEGOTIATION,
    });
    const txProcessUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const rootProcessUpdate = jest.fn();
    const historyCreate = jest.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      process: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(process),
        update: txProcessUpdate,
        updateMany: txProcessUpdateMany,
      },
      processStatusHistory: { create: historyCreate },
    };
    const prisma = {
      process: {
        findUnique: jest.fn().mockResolvedValue(process),
        update: rootProcessUpdate,
      },
      meetingSession: {
        update: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...process.meeting_session, ...data }),
          ),
      },
      processStatusHistory: { create: historyCreate },
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as any;
    const service = new MeetingsService(
      prisma,
      mkConfig(),
      notification,
      {} as any,
    );

    await service.markConversationDone('proc-1', 'spec-1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0][1]).toBe('product-money:CAR:product-1');
    expect(tx.process.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'proc-1' },
      include: {
        car: { select: { valor: true, currency: true } },
        boat: { select: { valor: true, currency: true } },
        aircraft: { select: { valor: true, currency: true } },
      },
    });
    expect(rootProcessUpdate).not.toHaveBeenCalled();
    expect(txProcessUpdate).not.toHaveBeenCalled();
    expect(txProcessUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proc-1', status: ProcessStatus.SCHEDULING },
        data: expect.objectContaining({
          status: ProcessStatus.NEGOTIATION,
          negotiation_currency: ProductCurrency.USD,
          negotiation_product_value: new Prisma.Decimal('120000.00'),
        }),
      }),
    );
    expect(historyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          processId: 'proc-1',
          status: ProcessStatus.NEGOTIATION,
        }),
      }),
    );
    expect(txProcessUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
      historyCreate.mock.invocationCallOrder[0],
    );
  });

  it.each([
    [ProcessStatus.PROCESSING_CONTRACT, false],
    [ProcessStatus.SCHEDULING, true],
  ])(
    'não regride etapa concorrente com estado transacional %s',
    async (transactionalStatus, expectsClaim) => {
      const product = {
        id: 'product-1',
        marca: 'Porsche',
        modelo: '911',
        valor: new Prisma.Decimal('120000.00'),
        currency: ProductCurrency.USD,
      };
      const process = mkProcess({
        status: ProcessStatus.SCHEDULING,
        product_type: ProductType.CAR,
        car_id: product.id,
        boat_id: null,
        aircraft_id: null,
        negotiation_currency: null,
        negotiation_product_value: null,
        notes: null,
        car: product,
        boat: null,
        aircraft: null,
        meeting_session: {
          id: 'meeting-1',
          process_id: 'proc-1',
          meet_link: 'https://meet.google.com/abc-defg-hij',
          started_at: new Date('2026-01-01T10:00:00.000Z'),
          ended_at: null,
        },
      });
      const concurrentProcess = {
        ...process,
        status: transactionalStatus,
      };
      const txProcessUpdate = jest.fn();
      const rootProcessUpdate = jest.fn();
      const processUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const historyCreate = jest.fn();
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
        process: {
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValueOnce(concurrentProcess)
            .mockResolvedValueOnce({
              ...concurrentProcess,
              status: ProcessStatus.PROCESSING_CONTRACT,
            }),
          update: txProcessUpdate,
          updateMany: processUpdateMany,
        },
        processStatusHistory: { create: historyCreate },
      };
      const prisma = {
        process: {
          findUnique: jest.fn().mockResolvedValue(process),
          update: rootProcessUpdate,
        },
        meetingSession: {
          update: jest
            .fn()
            .mockImplementation(({ data }) =>
              Promise.resolve({ ...process.meeting_session, ...data }),
            ),
        },
        $transaction: jest.fn(async (callback) => callback(tx)),
      } as any;
      const service = new MeetingsService(
        prisma,
        mkConfig(),
        notification,
        {} as any,
      );

      const result = await service.markConversationDone('proc-1', 'spec-1');

      expect(rootProcessUpdate).not.toHaveBeenCalled();
      expect(txProcessUpdate).not.toHaveBeenCalled();
      if (expectsClaim) {
        expect(processUpdateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'proc-1', status: ProcessStatus.SCHEDULING },
          }),
        );
      } else {
        expect(processUpdateMany).not.toHaveBeenCalled();
      }
      expect(historyCreate).not.toHaveBeenCalled();
      expect(result.processTransition).toEqual(
        expect.objectContaining({
          advanced: false,
          status: ProcessStatus.PROCESSING_CONTRACT,
        }),
      );
    },
  );
});
