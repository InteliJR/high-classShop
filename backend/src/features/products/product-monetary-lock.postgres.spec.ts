import { randomUUID } from 'node:crypto';
import {
  PrismaClient,
  ProcessStatus,
  ProductCurrency,
  ProductType,
  UserRole,
} from '@prisma/client';
import { CarsService } from '../cars/cars.service';
import { ProcessesService } from '../processes/processes.service';

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function withApplicationName(url: string, applicationName: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}application_name=${encodeURIComponent(applicationName)}`;
}

function bindMember(target: any, property: PropertyKey): any {
  const value = Reflect.get(target, property);
  return typeof value === 'function' ? value.bind(target) : value;
}

function productUpdateBarrier(
  client: PrismaClient,
  beforeUpdate: Deferred,
  release: Deferred,
) {
  const wrapCar = (delegate: any) =>
    new Proxy(delegate, {
      get(target, property) {
        if (property === 'update') {
          return async (args: any) => {
            beforeUpdate.resolve();
            await release.promise;
            return target.update(args);
          };
        }
        return bindMember(target, property);
      },
    });

  const wrapTransaction = (transaction: any) =>
    new Proxy(transaction, {
      get(target, property) {
        if (property === 'car') return wrapCar(target.car);
        return bindMember(target, property);
      },
    });

  return new Proxy(client, {
    get(target, property) {
      if (property === 'car') return wrapCar(target.car);
      if (property === '$transaction') {
        return (
          callback: (transaction: any) => Promise<unknown>,
          options?: any,
        ) =>
          target.$transaction(
            (transaction) => callback(wrapTransaction(transaction)),
            options,
          );
      }
      return bindMember(target, property);
    },
  });
}

async function waitForAdvisoryLockWait(
  observer: PrismaClient,
  applicationName: string,
  timeoutMs = 2000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = await observer.$queryRaw<Array<{ waiting: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE application_name = ${applicationName}
          AND wait_event_type = 'Lock'
          AND wait_event = 'advisory'
      ) AS waiting
    `;
    if (rows[0]?.waiting) return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return false;
}

const databaseUrl = process.env.POSTGRES_CONCURRENCY_TEST_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres('product monetary lock — PostgreSQL concurrency', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const updaterApplication = `money_update_${suffix}`;
  const transitionApplication = `snapshot_transition_${suffix}`;
  const updater = new PrismaClient({
    datasources: {
      db: { url: withApplicationName(databaseUrl!, updaterApplication) },
    },
  });
  const transition = new PrismaClient({
    datasources: {
      db: { url: withApplicationName(databaseUrl!, transitionApplication) },
    },
  });
  const observer = new PrismaClient({
    datasources: {
      db: { url: withApplicationName(databaseUrl!, `observer_${suffix}`) },
    },
  });

  const clientId = randomUUID();
  const specialistId = randomUUID();
  const carId = randomUUID();
  const processId = randomUUID();

  beforeAll(async () => {
    await observer.user.createMany({
      data: [
        {
          id: clientId,
          name: 'Concurrency',
          surname: 'Client',
          email: `client-${suffix}@example.test`,
          rg: suffix.slice(0, 11),
          role: UserRole.CUSTOMER,
          password_hash: 'not-used',
        },
        {
          id: specialistId,
          name: 'Concurrency',
          surname: 'Specialist',
          email: `specialist-${suffix}@example.test`,
          rg: suffix.slice(11, 22),
          role: UserRole.SPECIALIST,
          speciality: ProductType.CAR,
          password_hash: 'not-used',
        },
      ],
    });
    await observer.car.create({
      data: {
        id: carId,
        specialist_id: specialistId,
        marca: 'Barrier',
        modelo: 'Car',
        identificador: `barrier-${suffix}`,
        valor: 100000,
        currency: ProductCurrency.BRL,
        estado: 'SP',
        ano: 2026,
      },
    });
    await observer.process.create({
      data: {
        id: processId,
        client_id: clientId,
        specialist_id: specialistId,
        product_type: ProductType.CAR,
        car_id: carId,
        status: ProcessStatus.SCHEDULING,
      },
    });
  });

  afterAll(async () => {
    await observer.processStatusHistory.deleteMany({ where: { processId } });
    await observer.process.deleteMany({ where: { id: processId } });
    await observer.car.deleteMany({ where: { id: carId } });
    await observer.user.deleteMany({
      where: { id: { in: [clientId, specialistId] } },
    });
    await Promise.all([
      updater.$disconnect(),
      transition.$disconnect(),
      observer.$disconnect(),
    ]);
  });

  it('serializes update and snapshot so the frozen value matches the committed product', async () => {
    const updateReached = deferred();
    const releaseUpdate = deferred();
    const guardedUpdater = productUpdateBarrier(
      updater,
      updateReached,
      releaseUpdate,
    );
    const cars = new CarsService(
      guardedUpdater as any,
      {
        getSignedUrl: jest.fn(),
      } as any,
    );
    const processes = new ProcessesService(
      transition as any,
      {
        sendProcessStatusChangedEmail: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    const updatePromise = cars.update(carId, { valor: 110000 });
    await updateReached.promise;

    const transitionPromise = processes.update(
      processId,
      { status: ProcessStatus.NEGOTIATION },
      specialistId,
      UserRole.SPECIALIST,
    );

    const observedWait = await waitForAdvisoryLockWait(
      observer,
      transitionApplication,
    );
    releaseUpdate.resolve();

    const [updateResult, transitionResult] = await Promise.allSettled([
      updatePromise,
      transitionPromise,
    ]);

    expect(observedWait).toBe(true);
    expect(updateResult.status).toBe('fulfilled');
    expect(transitionResult.status).toBe('fulfilled');

    const [car, process] = await Promise.all([
      observer.car.findUniqueOrThrow({ where: { id: carId } }),
      observer.process.findUniqueOrThrow({ where: { id: processId } }),
    ]);
    expect(car.valor.toFixed(2)).toBe('110000.00');
    expect(process.status).toBe(ProcessStatus.NEGOTIATION);
    expect(process.negotiation_currency).toBe(ProductCurrency.BRL);
    expect(process.negotiation_product_value?.toFixed(2)).toBe('110000.00');
  }, 15000);
});
