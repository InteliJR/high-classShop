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

  beforeEach(async () => {
    const appointments = await holder.appointment.findMany({
      where: { specialist_id: specialistId },
      select: { id: true },
    });
    const processes = await holder.process.findMany({
      where: { appointment_id: { in: appointments.map(({ id }) => id) } },
      select: { id: true },
    });
    await holder.processStatusHistory.deleteMany({
      where: { processId: { in: processes.map(({ id }) => id) } },
    });
    await holder.process.deleteMany({
      where: { id: { in: processes.map(({ id }) => id) } },
    });
    await holder.appointment.deleteMany({
      where: { id: { in: appointments.map(({ id }) => id) } },
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

  async function createPendingWithProcess(
    clientId: string,
    carId: string,
  ) {
    const appointment = await holder.appointment.create({
      data: {
        client_id: clientId,
        specialist_id: specialistId,
        product_type: ProductType.CAR,
        product_id: carId,
        status: 'PENDING',
      },
    });
    await holder.process.create({
      data: {
        client_id: clientId,
        specialist_id: specialistId,
        product_type: ProductType.CAR,
        car_id: carId,
        appointment_id: appointment.id,
        status: 'SCHEDULING',
      },
    });
    return appointment;
  }

  async function holdScheduleLock(release: Deferred, ready: Deferred) {
    const lockKey = `appointment-schedule:${specialistId}`;
    return holder.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS locked
      `;
      ready.resolve();
      await release.promise;
    });
  }

  function service(client: PrismaClient, attempted: Deferred) {
    return new AppointmentsService(
      signalScheduleLockAttempt(client, attempted) as any,
      {
        sendAppointmentCreatedEmail: jest.fn().mockResolvedValue(undefined),
        sendAppointmentConfirmedEmail: jest.fn().mockResolvedValue(undefined),
      } as any,
      {} as any,
    );
  }

  it('serializes direct create against confirming an overlapping pending appointment', async () => {
    const pending = await createPendingWithProcess(secondClientId, secondCarId);
    const release = deferred();
    const ready = deferred();
    const createAttempted = deferred();
    const confirmAttempted = deferred();
    const held = holdScheduleLock(release, ready);
    await ready.promise;
    const serviceA = service(first, createAttempted);
    const serviceB = service(second, confirmAttempted);
    const scheduledAt = new Date('2099-01-01T10:00:00.000Z');

    const creating = serviceA.create(
      {
        client_id: firstClientId,
        specialist_id: specialistId,
        product_type: ProductType.CAR,
        product_id: firstCarId,
        appointment_datetime: scheduledAt.toISOString(),
      } as any,
      firstClientId,
    );
    const confirming = serviceB.confirmPending(
      pending.id,
      specialistId,
      scheduledAt,
    );
    const bothAttemptedBeforeCompletion = await Promise.race([
      Promise.all([createAttempted.promise, confirmAttempted.promise]).then(
        () => true,
      ),
      confirming.then(
        () => false,
        () => false,
      ),
    ]);
    release.resolve();
    await held;
    const outcomes = await Promise.allSettled([creating, confirming]);

    expect(bothAttemptedBeforeCompletion).toBe(true);
    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.find(({ status }) => status === 'rejected')).toMatchObject({
      reason: expect.any(ConflictException),
    });
  }, 15_000);

  it('serializes two confirmations that select the same specialist time', async () => {
    const firstPending = await createPendingWithProcess(firstClientId, firstCarId);
    const secondPending = await createPendingWithProcess(secondClientId, secondCarId);
    const release = deferred();
    const ready = deferred();
    const firstAttempted = deferred();
    const secondAttempted = deferred();
    const held = holdScheduleLock(release, ready);
    await ready.promise;
    const serviceA = service(first, firstAttempted);
    const serviceB = service(second, secondAttempted);
    const scheduledAt = new Date('2099-01-01T11:00:00.000Z');
    const firstConfirm = serviceA.confirmPending(
      firstPending.id,
      specialistId,
      scheduledAt,
    );
    const secondConfirm = serviceB.confirmPending(
      secondPending.id,
      specialistId,
      scheduledAt,
    );
    const bothAttemptedBeforeCompletion = await Promise.race([
      Promise.all([firstAttempted.promise, secondAttempted.promise]).then(
        () => true,
      ),
      Promise.allSettled([firstConfirm, secondConfirm]).then(() => false),
    ]);
    release.resolve();
    await held;
    const outcomes = await Promise.allSettled([firstConfirm, secondConfirm]);

    expect(bothAttemptedBeforeCompletion).toBe(true);
    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.find(({ status }) => status === 'rejected')).toMatchObject({
      reason: expect.any(ConflictException),
    });
  }, 15_000);

  it('serializes two Calendly callbacks that resolve to an overlapping time', async () => {
    const firstPending = await holder.appointment.create({
      data: {
        client_id: firstClientId,
        specialist_id: specialistId,
        product_type: ProductType.CAR,
        product_id: firstCarId,
        status: 'PENDING',
      },
    });
    const secondPending = await holder.appointment.create({
      data: {
        client_id: secondClientId,
        specialist_id: specialistId,
        product_type: ProductType.CAR,
        product_id: secondCarId,
        status: 'PENDING',
      },
    });
    const release = deferred();
    const ready = deferred();
    const firstAttempted = deferred();
    const secondAttempted = deferred();
    const held = holdScheduleLock(release, ready);
    await ready.promise;
    const serviceA = service(first, firstAttempted);
    const serviceB = service(second, secondAttempted);
    const scheduledStart = '2099-01-01T12:00:00.000Z';
    const firstRegister = serviceA.registerCalendlyScheduled(
      firstPending.id,
      firstClientId,
      {
        event_uri: `https://calendly.test/events/${firstPending.id}`,
        invitee_uri: `https://calendly.test/invitees/${firstPending.id}`,
        scheduled_start_time: scheduledStart,
      },
    );
    const secondRegister = serviceB.registerCalendlyScheduled(
      secondPending.id,
      secondClientId,
      {
        event_uri: `https://calendly.test/events/${secondPending.id}`,
        invitee_uri: `https://calendly.test/invitees/${secondPending.id}`,
        scheduled_start_time: scheduledStart,
      },
    );
    const bothAttemptedBeforeCompletion = await Promise.race([
      Promise.all([firstAttempted.promise, secondAttempted.promise]).then(
        () => true,
      ),
      Promise.allSettled([firstRegister, secondRegister]).then(() => false),
    ]);
    release.resolve();
    await held;
    const outcomes = await Promise.allSettled([firstRegister, secondRegister]);

    expect(bothAttemptedBeforeCompletion).toBe(true);
    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.find(({ status }) => status === 'rejected')).toMatchObject({
      reason: expect.any(ConflictException),
    });
  }, 15_000);
});
