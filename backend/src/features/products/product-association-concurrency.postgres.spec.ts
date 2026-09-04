import { randomUUID } from 'node:crypto';
import {
  PrismaClient,
  ProductCurrency,
  ProductType,
  UserRole,
} from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { CarsService } from '../cars/cars.service';
import { AppointmentsService } from '../appointments/appointments.service';

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
    datasources: { db: { url: withApplicationName(databaseUrl!, `product_mutation_${suffix}`) } },
  });
  const creator = new PrismaClient({
    datasources: { db: { url: withApplicationName(databaseUrl!, `product_consumer_${suffix}`) } },
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
    await updater.process.deleteMany({ where: { car_id: carId } });
    await updater.appointment.deleteMany({ where: { product_id: carId } });
    await updater.car.deleteMany({ where: { id: carId } });
    await updater.user.deleteMany({ where: { id: { in: [clientId, specialistId] } } });
    await Promise.all([updater.$disconnect(), creator.$disconnect()]);
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
    await expect(
      updater.appointment.count({ where: { product_id: carId } }),
    ).resolves.toBe(0);
  }, 15_000);
});
