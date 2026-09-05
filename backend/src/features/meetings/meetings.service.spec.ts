import { ServiceUnavailableException } from '@nestjs/common';
import {
  Prisma,
  ProcessStatus,
  ProductCurrency,
  ProductType,
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
  return {
    process: { findUnique: jest.fn().mockResolvedValue(process) },
    meetingSession: {
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'meet-1',
          process_id: data.process_id,
          meet_link: data.meet_link,
          started_at: data.started_at,
          ended_at: null,
        }),
      ),
    },
  } as any;
}

function mkConfig(accessType = 'OPEN') {
  return {
    get: jest.fn((key: string, def?: string) => {
      if (key === 'GOOGLE_MEET_ACCESS_TYPE') return accessType;
      if (key === 'MEETING_PROVIDER') return 'GOOGLE';
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
    const oauth = {
      getAccessToken: jest.fn().mockResolvedValue('access-token'),
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
    expect(prisma.meetingSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          calendar_event_id: 'spaces/abc123',
          meet_link: 'https://meet.google.com/abc-defg-hij',
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
