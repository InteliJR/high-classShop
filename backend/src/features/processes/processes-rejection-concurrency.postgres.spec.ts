import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  PrismaClient,
  ProcessStatus,
  ProductCurrency,
  ProductType,
  StatusAgendamento,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { MeetingsService } from '../meetings/meetings.service';
import { ProcessesService } from './processes.service';

type Deferred = { promise: Promise<void>; resolve: () => void };

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function bindMember(target: any, property: PropertyKey): any {
  const value = Reflect.get(target, property);
  return typeof value === 'function' ? value.bind(target) : value;
}

function withApplicationName(url: string, name: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}application_name=${encodeURIComponent(name)}&connection_limit=1&pool_timeout=3`;
}

function pauseRejectionClaim(
  client: PrismaClient,
  attempted: Deferred,
  release: Deferred,
) {
  const wrapTransaction = (tx: any) =>
    new Proxy(tx, {
      get(target, property) {
        if (property === 'process') {
          return new Proxy(target.process, {
            get(processTarget, processProperty) {
              if (processProperty === 'updateMany') {
                return async (args: any) => {
                  if (args.data?.status === ProcessStatus.REJECTED) {
                    attempted.resolve();
                    await release.promise;
                  }
                  return processTarget.updateMany(args);
                };
              }
              return bindMember(processTarget, processProperty);
            },
          });
        }
        return bindMember(target, property);
      },
    });

  return new Proxy(client, {
    get(target, property) {
      if (property === '$transaction') {
        return (callback: (tx: any) => Promise<unknown>, options?: any) =>
          target.$transaction((tx) => callback(wrapTransaction(tx)), options);
      }
      return bindMember(target, property);
    },
  });
}

function observeScheduleLockAttempt(client: PrismaClient, attempted: Deferred) {
  const wrapTransaction = (tx: any) =>
    new Proxy(tx, {
      get(target, property) {
        if (property === '$queryRaw') {
          return (...args: any[]) => {
            attempted.resolve();
            return target.$queryRaw(...args);
          };
        }
        return bindMember(target, property);
      },
    });

  return new Proxy(client, {
    get(target, property) {
      if (property === '$transaction') {
        return (callback: (tx: any) => Promise<unknown>, options?: any) =>
          target.$transaction((tx) => callback(wrapTransaction(tx)), options);
      }
      return bindMember(target, property);
    },
  });
}

function pauseMeetingCreate(
  client: PrismaClient,
  attempted: Deferred,
  release: Deferred,
) {
  const wrapTransaction = (tx: any) =>
    new Proxy(tx, {
      get(target, property) {
        if (property === 'meetingSession') {
          return new Proxy(target.meetingSession, {
            get(meetingTarget, meetingProperty) {
              if (meetingProperty === 'create') {
                return async (args: any) => {
                  attempted.resolve();
                  await release.promise;
                  return meetingTarget.create(args);
                };
              }
              return bindMember(meetingTarget, meetingProperty);
            },
          });
        }
        return bindMember(target, property);
      },
    });

  return new Proxy(client, {
    get(target, property) {
      if (property === '$transaction') {
        return (callback: (tx: any) => Promise<unknown>, options?: any) =>
          target.$transaction((tx) => callback(wrapTransaction(tx)), options);
      }
      return bindMember(target, property);
    },
  });
}

function meetingConfig() {
  return {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'MEETING_PROVIDER') return 'JITSI';
      if (key === 'MEETING_DEMO_FALLBACK_ENABLED') return 'false';
      return fallback;
    }),
  } as any;
}

function meetingNotifications() {
  return {
    sendMeetingStartedEmail: jest.fn().mockResolvedValue({}),
    sendMeetingAdvancedEmail: jest.fn().mockResolvedValue({}),
    sendProcessStatusChangedEmail: jest.fn().mockResolvedValue({}),
  } as any;
}

const databaseUrl = process.env.POSTGRES_CONCURRENCY_TEST_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;
const prismaDatabaseUrl =
  databaseUrl ?? 'postgresql://unused:unused@127.0.0.1:1/unused';

describeWithPostgres('process rejection CAS — PostgreSQL concurrency', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const clientId = randomUUID();
  const specialistId = randomUUID();
  const carId = randomUUID();
  const processId = randomUUID();
  const appointmentId = randomUUID();
  const rejectClient = new PrismaClient({
    datasources: {
      db: { url: withApplicationName(prismaDatabaseUrl, `reject_a_${suffix}`) },
    },
  });
  const completionClient = new PrismaClient({
    datasources: {
      db: { url: withApplicationName(prismaDatabaseUrl, `reject_b_${suffix}`) },
    },
  });

  beforeAll(async () => {
    await completionClient.user.createMany({
      data: [
        {
          id: clientId,
          name: 'Reject',
          surname: 'Client',
          email: `reject-client-${suffix}@example.test`,
          rg: suffix.slice(0, 11),
          role: UserRole.CUSTOMER,
          password_hash: 'not-used',
        },
        {
          id: specialistId,
          name: 'Reject',
          surname: 'Specialist',
          email: `reject-specialist-${suffix}@example.test`,
          rg: suffix.slice(11, 22),
          role: UserRole.SPECIALIST,
          speciality: ProductType.CAR,
          password_hash: 'not-used',
        },
      ],
    });
    await completionClient.car.create({
      data: {
        id: carId,
        specialist_id: specialistId,
        marca: 'Concurrent',
        modelo: 'Rejection',
        identificador: `rejection-${suffix}`,
        valor: 120000,
        currency: ProductCurrency.USD,
        estado: 'SP',
        ano: 2026,
      },
    });
  });

  beforeEach(async () => {
    await completionClient.processRejection.deleteMany({
      where: { process_id: processId },
    });
    await completionClient.processStatusHistory.deleteMany({
      where: { processId },
    });
    await completionClient.process.deleteMany({ where: { id: processId } });
    await completionClient.appointment.deleteMany({
      where: { id: appointmentId },
    });
  });

  afterAll(async () => {
    await completionClient.processRejection.deleteMany({
      where: { process_id: processId },
    });
    await completionClient.processStatusHistory.deleteMany({
      where: { processId },
    });
    await completionClient.process.deleteMany({ where: { id: processId } });
    await completionClient.appointment.deleteMany({
      where: { id: appointmentId },
    });
    await completionClient.car.deleteMany({ where: { id: carId } });
    await completionClient.user.deleteMany({
      where: { id: { in: [clientId, specialistId] } },
    });
    await Promise.all([
      rejectClient.$disconnect(),
      completionClient.$disconnect(),
    ]);
  });

  async function createConfirmedAppointment() {
    await completionClient.appointment.create({
      data: {
        id: appointmentId,
        client_id: clientId,
        specialist_id: specialistId,
        appointment_datetime: new Date('2099-01-01T10:00:00.000Z'),
        // Rejeição de processo bloqueia appointments ativos
        // (PENDING/SCHEDULED); COMPLETED mantém esta fixture focada apenas
        // na serialização entre rejeição e criação da reunião.
        status: StatusAgendamento.COMPLETED,
      },
    });
  }

  it('preserva conclusão concorrente e não grava rejeição parcial', async () => {
    const initialUpdatedAt = new Date('2026-01-01T00:00:00.000Z');
    await completionClient.process.create({
      data: {
        id: processId,
        client_id: clientId,
        specialist_id: specialistId,
        status: ProcessStatus.DOCUMENTATION,
        updated_at: initialUpdatedAt,
      },
    });

    const attempted = deferred();
    const release = deferred();
    const service = new ProcessesService(
      pauseRejectionClaim(rejectClient, attempted, release) as any,
      { sendProcessStatusChangedEmail: jest.fn() } as any,
    );

    const rejection = service.rejectProcess(
      processId,
      specialistId,
      'concorrente',
      UserRole.SPECIALIST,
    );
    await attempted.promise;

    const completion = await completionClient.process.updateMany({
      where: {
        id: processId,
        status: ProcessStatus.DOCUMENTATION,
        updated_at: initialUpdatedAt,
      },
      data: {
        status: ProcessStatus.COMPLETED,
        updated_at: new Date('2026-01-02T00:00:00.000Z'),
      },
    });
    expect(completion.count).toBe(1);

    release.resolve();
    await expect(rejection).rejects.toBeInstanceOf(ConflictException);

    await expect(
      completionClient.process.findUniqueOrThrow({ where: { id: processId } }),
    ).resolves.toMatchObject({ status: ProcessStatus.COMPLETED });
    await expect(
      completionClient.processRejection.count({
        where: { process_id: processId },
      }),
    ).resolves.toBe(0);
    await expect(
      completionClient.processStatusHistory.count({
        where: { processId, status: ProcessStatus.REJECTED },
      }),
    ).resolves.toBe(0);
  }, 15_000);

  it('remove meeting-init vencido sob lock e permite a rejeição', async () => {
    await completionClient.process.create({
      data: {
        id: processId,
        client_id: clientId,
        specialist_id: specialistId,
        status: ProcessStatus.SCHEDULING,
        meeting_session: {
          create: {
            started_by_id: specialistId,
            calendar_event_id: `meeting-init:${suffix}`,
            meet_link: '',
            started_at: new Date(Date.now() - 3 * 60 * 1000),
          },
        },
      },
    });
    const service = new ProcessesService(
      completionClient as any,
      meetingNotifications(),
    );

    await expect(
      service.rejectProcess(
        processId,
        clientId,
        'claim abandonado',
        UserRole.CUSTOMER,
      ),
    ).resolves.toMatchObject({ status: ProcessStatus.REJECTED });

    await expect(
      completionClient.meetingSession.count({
        where: { process_id: processId },
      }),
    ).resolves.toBe(0);
    await expect(
      completionClient.process.findUniqueOrThrow({ where: { id: processId } }),
    ).resolves.toMatchObject({ status: ProcessStatus.REJECTED });
  }, 15_000);

  it('não ressuscita processo quando update perde a corrida para rejeição', async () => {
    await completionClient.process.create({
      data: {
        id: processId,
        client_id: clientId,
        specialist_id: specialistId,
        product_type: ProductType.CAR,
        car_id: carId,
        status: ProcessStatus.NEGOTIATION,
        negotiation_currency: ProductCurrency.USD,
        negotiation_product_value: 120000,
      },
    });

    const rejectionClaimAttempted = deferred();
    const releaseRejection = deferred();
    const updateLockAttempted = deferred();
    const notifications = {
      sendProcessStatusChangedEmail: jest.fn().mockResolvedValue(undefined),
    } as any;
    const rejectionService = new ProcessesService(
      pauseRejectionClaim(
        rejectClient,
        rejectionClaimAttempted,
        releaseRejection,
      ) as any,
      notifications,
    );
    const updateService = new ProcessesService(
      observeScheduleLockAttempt(completionClient, updateLockAttempted) as any,
      notifications,
    );

    const rejection = rejectionService.rejectProcess(
      processId,
      specialistId,
      'concorrente',
      UserRole.SPECIALIST,
    );
    await rejectionClaimAttempted.promise;

    const update = updateService.update(
      processId,
      { status: ProcessStatus.DOCUMENTATION },
      specialistId,
      UserRole.SPECIALIST,
    );
    await updateLockAttempted.promise;

    releaseRejection.resolve();
    await expect(rejection).resolves.toMatchObject({
      status: ProcessStatus.REJECTED,
    });
    await expect(update).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      completionClient.process.findUniqueOrThrow({ where: { id: processId } }),
    ).resolves.toMatchObject({ status: ProcessStatus.REJECTED });
    await expect(
      completionClient.processStatusHistory.count({
        where: { processId, status: ProcessStatus.DOCUMENTATION },
      }),
    ).resolves.toBe(0);
  }, 15_000);

  it('não cria reunião nem envia e-mail quando a rejeição ganha o lock', async () => {
    await createConfirmedAppointment();
    await completionClient.process.create({
      data: {
        id: processId,
        client_id: clientId,
        specialist_id: specialistId,
        appointment_id: appointmentId,
        status: ProcessStatus.SCHEDULING,
      },
    });

    const rejectionClaimAttempted = deferred();
    const releaseRejection = deferred();
    const meetingLockAttempted = deferred();
    const notifications = meetingNotifications();
    const rejectionService = new ProcessesService(
      pauseRejectionClaim(
        rejectClient,
        rejectionClaimAttempted,
        releaseRejection,
      ) as any,
      notifications,
    );
    const meetingsService = new MeetingsService(
      observeScheduleLockAttempt(completionClient, meetingLockAttempted) as any,
      meetingConfig(),
      notifications,
      {} as any,
    );

    const rejection = rejectionService.rejectProcess(
      processId,
      specialistId,
      'concorrente',
      UserRole.SPECIALIST,
    );
    await rejectionClaimAttempted.promise;

    const meeting = meetingsService.startMeetingForProcess(
      processId,
      specialistId,
    );
    await meetingLockAttempted.promise;

    releaseRejection.resolve();
    await expect(rejection).resolves.toMatchObject({
      status: ProcessStatus.REJECTED,
    });
    await expect(meeting).rejects.toBeInstanceOf(BadRequestException);
    await new Promise<void>((resolve) => setImmediate(resolve));

    await expect(
      completionClient.meetingSession.count({
        where: { process_id: processId },
      }),
    ).resolves.toBe(0);
    expect(notifications.sendMeetingStartedEmail).not.toHaveBeenCalled();
    expect(notifications.sendMeetingAdvancedEmail).not.toHaveBeenCalled();
  }, 15_000);

  it('mantém reunião e recusa rejeição quando o início ganha o lock', async () => {
    await createConfirmedAppointment();
    await completionClient.process.create({
      data: {
        id: processId,
        client_id: clientId,
        specialist_id: specialistId,
        appointment_id: appointmentId,
        status: ProcessStatus.SCHEDULING,
      },
    });

    const meetingCreateAttempted = deferred();
    const releaseMeeting = deferred();
    const rejectionLockAttempted = deferred();
    const notifications = meetingNotifications();
    const meetingsService = new MeetingsService(
      pauseMeetingCreate(
        completionClient,
        meetingCreateAttempted,
        releaseMeeting,
      ) as any,
      meetingConfig(),
      notifications,
      {} as any,
    );
    const rejectionService = new ProcessesService(
      observeScheduleLockAttempt(rejectClient, rejectionLockAttempted) as any,
      notifications,
    );

    const meeting = meetingsService.startMeetingForProcess(
      processId,
      specialistId,
    );
    await meetingCreateAttempted.promise;

    const rejection = rejectionService.rejectProcess(
      processId,
      specialistId,
      'concorrente',
      UserRole.SPECIALIST,
    );
    await rejectionLockAttempted.promise;

    releaseMeeting.resolve();
    await expect(meeting).resolves.toMatchObject({ is_active: true });
    await expect(rejection).rejects.toBeInstanceOf(BadRequestException);
    await new Promise<void>((resolve) => setImmediate(resolve));

    await expect(
      completionClient.process.findUniqueOrThrow({ where: { id: processId } }),
    ).resolves.toMatchObject({ status: ProcessStatus.SCHEDULING });
    await expect(
      completionClient.meetingSession.count({
        where: { process_id: processId },
      }),
    ).resolves.toBe(1);
    await expect(
      completionClient.processRejection.count({
        where: { process_id: processId },
      }),
    ).resolves.toBe(0);
    expect(notifications.sendMeetingStartedEmail).toHaveBeenCalledTimes(1);
    expect(notifications.sendMeetingAdvancedEmail).not.toHaveBeenCalled();
  }, 15_000);

  it('libera pool connection_limit=1 durante provider e impede start/e-mail duplicado', async () => {
    await createConfirmedAppointment();
    await completionClient.process.create({
      data: {
        id: processId,
        client_id: clientId,
        specialist_id: specialistId,
        appointment_id: appointmentId,
        status: ProcessStatus.SCHEDULING,
      },
    });

    const providerEntered = deferred();
    const releaseProvider = deferred();
    const notifications = meetingNotifications();
    const oauth = {
      getAccessToken: jest.fn().mockImplementation(async () => {
        // Este client tem connection_limit=1. Se a transação do claim ainda
        // estiver aberta, a própria leitura do OAuth esgota o pool.
        await completionClient.user.count({ where: { id: specialistId } });
        providerEntered.resolve();
        await releaseProvider.promise;
        return 'access-token';
      }),
    } as any;
    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'MEETING_PROVIDER') return 'GOOGLE';
        if (key === 'MEETING_DEMO_FALLBACK_ENABLED') return 'false';
        if (key === 'GOOGLE_MEET_ACCESS_TYPE') return 'OPEN';
        return fallback;
      }),
    } as any;
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: `spaces/${suffix}`,
        meetingUri: `https://meet.google.com/${suffix.slice(0, 10)}`,
      }),
    });
    global.fetch = fetchMock as any;

    try {
      const meetingsService = new MeetingsService(
        completionClient as any,
        config,
        notifications,
        oauth,
      );
      const firstStart = meetingsService.startMeetingForProcess(
        processId,
        specialistId,
      );
      await providerEntered.promise;

      await expect(
        meetingsService.startMeetingForProcess(processId, specialistId),
      ).rejects.toBeInstanceOf(ConflictException);

      releaseProvider.resolve();
      await expect(firstStart).resolves.toMatchObject({ is_active: true });
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(oauth.getAccessToken).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await expect(
        completionClient.meetingSession.findUniqueOrThrow({
          where: { process_id: processId },
        }),
      ).resolves.toMatchObject({
        calendar_event_id: `spaces/${suffix}`,
        meet_link: `https://meet.google.com/${suffix.slice(0, 10)}`,
      });
      expect(notifications.sendMeetingStartedEmail).toHaveBeenCalledTimes(1);
      expect(notifications.sendMeetingAdvancedEmail).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
      releaseProvider.resolve();
    }
  }, 15_000);
});
