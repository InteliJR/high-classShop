import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  PrismaClient,
  ProcessStatus,
  ProductCurrency,
  ProductType,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
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
  });

  afterAll(async () => {
    await completionClient.processRejection.deleteMany({
      where: { process_id: processId },
    });
    await completionClient.processStatusHistory.deleteMany({
      where: { processId },
    });
    await completionClient.process.deleteMany({ where: { id: processId } });
    await completionClient.car.deleteMany({ where: { id: carId } });
    await completionClient.user.deleteMany({
      where: { id: { in: [clientId, specialistId] } },
    });
    await Promise.all([
      rejectClient.$disconnect(),
      completionClient.$disconnect(),
    ]);
  });

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
});
