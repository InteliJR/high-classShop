import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import {
  PrismaClient,
  ProductCurrency,
  ProductType,
  UserRole,
} from '@prisma/client';
import { AppointmentsService } from './appointments.service';

type Deferred = { promise: Promise<void>; resolve: () => void };

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function withApplicationName(url: string, name: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}application_name=${encodeURIComponent(name)}&connection_limit=1&pool_timeout=3`;
}

function bindMember(target: any, property: PropertyKey): any {
  const value = Reflect.get(target, property);
  return typeof value === 'function' ? value.bind(target) : value;
}

function signalScheduleLockAttempt(client: PrismaClient, attempted: Deferred) {
  const wrapTransaction = (tx: any) =>
    new Proxy(tx, {
      get(target, property) {
        if (property === '$queryRaw') {
          return (strings: TemplateStringsArray, ...values: unknown[]) => {
            if (String(values[0]).startsWith('appointment-schedule:')) {
              attempted.resolve();
            }
            return target.$queryRaw(strings, ...values);
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

describeWithPostgres('appointment schedule lock — PostgreSQL concurrency', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const firstClientId = randomUUID();
  const secondClientId = randomUUID();
  const specialistId = randomUUID();
  const firstCarId = randomUUID();
  const secondCarId = randomUUID();
  const first = new PrismaClient({
    datasources: { db: { url: withApplicationName(databaseUrl!, `schedule_a_${suffix}`) } },
  });
  const second = new PrismaClient({
    datasources: { db: { url: withApplicationName(databaseUrl!, `schedule_b_${suffix}`) } },
  });
  const holder = new PrismaClient({
    datasources: { db: { url: withApplicationName(databaseUrl!, `schedule_holder_${suffix}`) } },
  });

  beforeAll(async () => {
    await holder.user.createMany({
      data: [
        {
          id: firstClientId,
          name: 'First',
          surname: 'Client',
          email: `schedule-client-a-${suffix}@example.test`,
          rg: suffix.slice(0, 10) + '1',
          role: UserRole.CUSTOMER,
          password_hash: 'not-used',
        },
        {
          id: secondClientId,
          name: 'Second',
          surname: 'Client',
          email: `schedule-client-b-${suffix}@example.test`,
          rg: suffix.slice(0, 10) + '2',
          role: UserRole.CUSTOMER,
          password_hash: 'not-used',
        },
        {
          id: specialistId,
          name: 'Schedule',
          surname: 'Specialist',
          email: `schedule-specialist-${suffix}@example.test`,
          rg: suffix.slice(11, 22),
          role: UserRole.SPECIALIST,
          speciality: ProductType.CAR,
          password_hash: 'not-used',
        },
      ],
    });
    await holder.car.createMany({
      data: [firstCarId, secondCarId].map((id, index) => ({
        id,
        specialist_id: specialistId,
        marca: 'Schedule',
        modelo: `Car ${index + 1}`,
        identificador: `schedule-${index}-${suffix}`,
        valor: 100000 + index,
        currency: ProductCurrency.BRL,
        estado: 'SP',
        ano: 2026,
      })),
    });
  });

  afterAll(async () => {
    const appointments = await holder.appointment.findMany({
      where: { specialist_id: specialistId },
      select: { id: true },
    });
    await holder.process.deleteMany({
      where: { appointment_id: { in: appointments.map(({ id }) => id) } },
    });
    await holder.appointment.deleteMany({ where: { specialist_id: specialistId } });
    await holder.car.deleteMany({ where: { id: { in: [firstCarId, secondCarId] } } });
    await holder.user.deleteMany({
      where: { id: { in: [firstClientId, secondClientId, specialistId] } },
    });
    await Promise.all([first.$disconnect(), second.$disconnect(), holder.$disconnect()]);
  });

  it('allows only one overlapping appointment across different products', async () => {
    const lockKey = `appointment-schedule:${specialistId}`;
    const holderReady = deferred();
    const releaseHolder = deferred();
    const firstAttempted = deferred();
    const secondAttempted = deferred();
    const held = holder.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS locked
      `;
      holderReady.resolve();
      await releaseHolder.promise;
    });
    await holderReady.promise;

    const notification = {
      sendAppointmentCreatedEmail: jest.fn().mockResolvedValue(undefined),
    } as any;
    const serviceA = new AppointmentsService(
      signalScheduleLockAttempt(first, firstAttempted) as any,
      notification,
      {} as any,
    );
    const serviceB = new AppointmentsService(
      signalScheduleLockAttempt(second, secondAttempted) as any,
      notification,
      {} as any,
    );
    const appointment_datetime = '2099-01-01T10:00:00.000Z';

    const outcomesPromise = Promise.allSettled([
      serviceA.create(
        {
          client_id: firstClientId,
          specialist_id: specialistId,
          product_type: ProductType.CAR,
          product_id: firstCarId,
          appointment_datetime,
        } as any,
        firstClientId,
      ),
      serviceB.create(
        {
          client_id: secondClientId,
          specialist_id: specialistId,
          product_type: ProductType.CAR,
          product_id: secondCarId,
          appointment_datetime,
        } as any,
        secondClientId,
      ),
    ]);
    await Promise.all([firstAttempted.promise, secondAttempted.promise]);
    releaseHolder.resolve();
    await held;
    const outcomes = await outcomesPromise;

    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.find(({ status }) => status === 'rejected')).toMatchObject({
      reason: expect.any(ConflictException),
    });
    await expect(
      holder.appointment.count({ where: { specialist_id: specialistId } }),
    ).resolves.toBe(1);
  }, 15_000);
});
