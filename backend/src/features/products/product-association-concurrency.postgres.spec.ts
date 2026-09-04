import { randomUUID } from 'node:crypto';
import { PrismaClient, ProductCurrency, ProductType, UserRole } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
import { CarsService } from '../cars/cars.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { ProcessesService } from '../processes/processes.service';

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

function holdCarUpdate(client: PrismaClient, reached: Deferred, release: Deferred) {
  const wrapTransaction = (tx: any) =>
    new Proxy(tx, {
      get(target, property) {
        if (property === 'car') {
          return new Proxy(target.car, {
            get(car, carProperty) {
              if (carProperty === 'update') {
                return async (args: any) => {
                  reached.resolve();
                  await release.promise;
                  return car.update(args);
                };
              }
              return bindMember(car, carProperty);
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

function signalProductLockAttempt(client: PrismaClient, attempted: Deferred) {
  const wrapTransaction = (tx: any) =>
    new Proxy(tx, {
      get(target, property) {
        if (property === '$queryRaw') {
          return (strings: TemplateStringsArray, ...values: unknown[]) => {
            if (String(values[0]).startsWith('product-money:')) {
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

describeWithPostgres('product association lock — PostgreSQL concurrency', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const clientId = randomUUID();
  const specialistId = randomUUID();
  const carId = randomUUID();
  const updater = new PrismaClient({
    datasources: {
      db: {
        url: withApplicationName(databaseUrl!, `product_mutation_${suffix}`),
      },
    },
  });
  const creator = new PrismaClient({
    datasources: {
      db: {
        url: withApplicationName(databaseUrl!, `product_consumer_${suffix}`),
      },
    },
  });
  const competitor = new PrismaClient({
    datasources: {
      db: {
        url: withApplicationName(databaseUrl!, `product_competitor_${suffix}`),
      },
    },
  });

  beforeEach(async () => {
    const processes = await updater.process.findMany({
      where: { client_id: clientId, specialist_id: specialistId },
      select: { id: true, appointment_id: true },
    });
    await updater.processStatusHistory.deleteMany({
      where: { processId: { in: processes.map(({ id }) => id) } },
    });
    await updater.process.deleteMany({
      where: { id: { in: processes.map(({ id }) => id) } },
    });
    await updater.appointment.deleteMany({
      where: {
        id: {
          in: processes.flatMap(({ appointment_id }) => (appointment_id ? [appointment_id] : [])),
        },
      },
    });
    await updater.car.update({
      where: { id: carId },
      data: { is_active: true },
    });
  });

  beforeAll(async () => {
    await updater.user.createMany({
      data: [
        {
          id: clientId,
          name: 'Product',
          surname: 'Client',
          email: `product-client-${suffix}@example.test`,
          rg: suffix.slice(0, 11),
          role: UserRole.CUSTOMER,
          password_hash: 'not-used',
        },
        {
          id: specialistId,
          name: 'Product',
          surname: 'Specialist',
          email: `product-specialist-${suffix}@example.test`,
          rg: suffix.slice(11, 22),
          role: UserRole.SPECIALIST,
          speciality: ProductType.CAR,
          password_hash: 'not-used',
        },
      ],
    });
    await updater.car.create({
      data: {
        id: carId,
        specialist_id: specialistId,
        marca: 'Race',
        modelo: 'Guard',
        identificador: `product-race-${suffix}`,
        valor: 100000,
        currency: ProductCurrency.BRL,
        estado: 'SP',
        ano: 2026,
      },
    });
  });

  afterAll(async () => {
    await updater.process.deleteMany({
      where: { client_id: clientId, specialist_id: specialistId },
    });
    await updater.appointment.deleteMany({
      where: { client_id: clientId, specialist_id: specialistId },
    });
    await updater.car.deleteMany({ where: { id: carId } });
    await updater.user.deleteMany({
      where: { id: { in: [clientId, specialistId] } },
    });
    await Promise.all([updater.$disconnect(), creator.$disconnect(), competitor.$disconnect()]);
  });

  it('serializes deactivation against creation and rejects the now-inactive product', async () => {
    const mutationReached = deferred();
    const releaseMutation = deferred();
    const consumerAttemptedLock = deferred();
    const cars = new CarsService(
      holdCarUpdate(updater, mutationReached, releaseMutation) as any,
      { getSignedUrl: jest.fn() } as any,
    );
    const appointments = new AppointmentsService(
      signalProductLockAttempt(creator, consumerAttemptedLock) as any,
      { sendAppointmentCreatedEmail: jest.fn() } as any,
      {} as any,
    );

    const deactivate = cars.remove(carId);
    await mutationReached.promise;
    const create = appointments.create(
      {
        client_id: clientId,
        specialist_id: specialistId,
        product_type: ProductType.CAR,
        product_id: carId,
        appointment_datetime: '2099-01-01T10:00:00.000Z',
      } as any,
      clientId,
    );
    await consumerAttemptedLock.promise;
    releaseMutation.resolve();

    await expect(deactivate).resolves.toEqual({ ok: true });
    await expect(create).rejects.toBeInstanceOf(BadRequestException);
    await expect(updater.appointment.count({ where: { product_id: carId } })).resolves.toBe(0);
  }, 15_000);

  it('serializes late assignment against creation on the target product identity', async () => {
    const consultancyAppointment = await updater.appointment.create({
      data: {
        client_id: clientId,
        specialist_id: specialistId,
        status: 'SCHEDULED',
        appointment_datetime: new Date('2090-01-01T10:00:00.000Z'),
      },
    });
    const consultancy = await updater.process.create({
      data: {
        client_id: clientId,
        specialist_id: specialistId,
        appointment_id: consultancyAppointment.id,
        status: 'NEGOTIATION',
      },
    });
    const lockKey = `product-money:${ProductType.CAR}:${carId}`;
    const holderReady = deferred();
    const releaseHolder = deferred();
    const assignAttempted = deferred();
    const createAttempted = deferred();
    const held = updater.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS locked
      `;
      holderReady.resolve();
      await releaseHolder.promise;
    });
    await holderReady.promise;

    const assigning = new ProcessesService(
      signalProductLockAttempt(creator, assignAttempted) as any,
      {} as any,
    ).assignProduct(
      consultancy.id,
      { product_type: ProductType.CAR, product_id: carId },
      specialistId,
      UserRole.SPECIALIST,
    );
    const creating = new AppointmentsService(
      signalProductLockAttempt(competitor, createAttempted) as any,
      {
        sendAppointmentCreatedEmail: jest.fn().mockResolvedValue(undefined),
      } as any,
      {} as any,
    ).create(
      {
        client_id: clientId,
        specialist_id: specialistId,
        product_type: ProductType.CAR,
        product_id: carId,
        appointment_datetime: '2099-01-01T10:00:00.000Z',
      } as any,
      clientId,
    );
    await Promise.all([assignAttempted.promise, createAttempted.promise]);
    releaseHolder.resolve();
    await held;
    const outcomes = await Promise.allSettled([assigning, creating]);

    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.find(({ status }) => status === 'rejected')).toMatchObject({
      reason: expect.any(ConflictException),
    });
    await expect(
      updater.process.count({
        where: {
          client_id: clientId,
          specialist_id: specialistId,
          car_id: carId,
          status: {
            in: ['SCHEDULING', 'NEGOTIATION', 'PROCESSING_CONTRACT', 'DOCUMENTATION'],
          },
        },
      }),
    ).resolves.toBe(1);
  }, 15_000);
});
