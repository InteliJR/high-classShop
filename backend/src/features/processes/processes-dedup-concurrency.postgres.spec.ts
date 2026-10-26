import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { PrismaClient, ProcessStatus, UserRole } from '@prisma/client';
import { ProcessesService } from './processes.service';

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

function signalDedupLockAttempt(client: PrismaClient, attempted: Deferred) {
  const wrapTransaction = (tx: any) =>
    new Proxy(tx, {
      get(target, property) {
        if (property === '$queryRaw') {
          return (strings: TemplateStringsArray, ...values: unknown[]) => {
            if (String(values[0]).startsWith('process-dedup:')) {
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

describeWithPostgres(
  'process active dedup lock — PostgreSQL concurrency',
  () => {
    const suffix = randomUUID().replaceAll('-', '');
    const clientId = randomUUID();
    const specialistId = randomUUID();
    const otherSpecialistId = randomUUID();
    const first = new PrismaClient({
      datasources: {
        db: { url: withApplicationName(databaseUrl!, `dedup_a_${suffix}`) },
      },
    });
    const second = new PrismaClient({
      datasources: {
        db: { url: withApplicationName(databaseUrl!, `dedup_b_${suffix}`) },
      },
    });
    const holder = new PrismaClient({
      datasources: {
        db: {
          url: withApplicationName(databaseUrl!, `dedup_holder_${suffix}`),
        },
      },
    });

    beforeAll(async () => {
      await holder.user.createMany({
        data: [
          {
            id: clientId,
            name: 'Dedup',
            surname: 'Client',
            email: `dedup-client-${suffix}@example.test`,
            rg: suffix.slice(0, 11),
            role: UserRole.CUSTOMER,
            password_hash: 'not-used',
          },
          {
            id: specialistId,
            name: 'Dedup',
            surname: 'Specialist',
            email: `dedup-specialist-${suffix}@example.test`,
            rg: suffix.slice(11, 22),
            role: UserRole.SPECIALIST,
            password_hash: 'not-used',
          },
          {
            id: otherSpecialistId,
            name: 'Other',
            surname: 'Specialist',
            email: `dedup-other-specialist-${suffix}@example.test`,
            rg: suffix.slice(22, 32),
            role: UserRole.SPECIALIST,
            password_hash: 'not-used',
          },
        ],
      });
    });

    beforeEach(async () => {
      const processes = await holder.process.findMany({
        where: { client_id: clientId },
        select: { id: true, appointment_id: true },
      });
      await holder.processStatusHistory.deleteMany({
        where: { processId: { in: processes.map(({ id }) => id) } },
      });
      await holder.process.deleteMany({
        where: { id: { in: processes.map(({ id }) => id) } },
      });
      await holder.appointment.deleteMany({
        where: {
          id: {
            in: processes.flatMap(({ appointment_id }) =>
              appointment_id ? [appointment_id] : [],
            ),
          },
        },
      });
    });

    afterAll(async () => {
      const processes = await holder.process.findMany({
        where: { client_id: clientId },
        select: { id: true, appointment_id: true },
      });
      await holder.processStatusHistory.deleteMany({
        where: { processId: { in: processes.map(({ id }) => id) } },
      });
      await holder.process.deleteMany({
        where: { id: { in: processes.map(({ id }) => id) } },
      });
      await holder.appointment.deleteMany({
        where: {
          id: {
            in: processes.flatMap(({ appointment_id }) =>
              appointment_id ? [appointment_id] : [],
            ),
          },
        },
      });
      await holder.user.deleteMany({
        where: { id: { in: [clientId, specialistId, otherSpecialistId] } },
      });
      await Promise.all([
        first.$disconnect(),
        second.$disconnect(),
        holder.$disconnect(),
      ]);
    });

    it.each(['completed appointment', 'legacy without appointment'] as const)(
      'rejects create-on-behalf when an active consultancy already exists with %s',
      async (fixture) => {
        const appointment =
          fixture === 'completed appointment'
            ? await holder.appointment.create({
                data: {
                  client_id: clientId,
                  specialist_id: specialistId,
                  status: 'COMPLETED',
                  scheduling_method: 'EMAIL',
                  appointment_datetime: new Date('2026-01-01T10:00:00.000Z'),
                },
              })
            : null;
        await holder.process.create({
          data: {
            client_id: clientId,
            specialist_id: specialistId,
            appointment_id: appointment?.id,
            status: ProcessStatus.SCHEDULING,
          },
        });

        await expect(
          new ProcessesService(holder as any, {} as any).createOnBehalfOfClient(
            {
              client_id: clientId,
              specialist_id: specialistId,
              product_type: 'CAR',
              product_id: undefined,
              createdBy: specialistId,
              actorLabel: 'consultor',
            },
          ),
        ).rejects.toThrow(ConflictException);

        await expect(
          holder.process.count({
            where: {
              client_id: clientId,
              specialist_id: specialistId,
              status: ProcessStatus.SCHEDULING,
            },
          }),
        ).resolves.toBe(1);
      },
      15_000,
    );

    it('returns only the assigned specialist processes in both rows and count', async () => {
      const own = await holder.process.create({
        data: {
          client_id: clientId,
          specialist_id: specialistId,
          status: ProcessStatus.SCHEDULING,
        },
      });
      await holder.process.create({
        data: {
          client_id: clientId,
          specialist_id: otherSpecialistId,
          status: ProcessStatus.SCHEDULING,
        },
      });

      const result = await new ProcessesService(
        holder as any,
        {} as any,
      ).getByClientId(
        clientId,
        { page: 1, perPage: 20 },
        specialistId,
        UserRole.SPECIALIST,
      );

      expect(result.count).toBe(1);
      expect(result.processes.map(({ id }) => id)).toEqual([own.id]);
    });

    it('allows only one concurrent active consultancy for the same client and specialist', async () => {
      const lockKey = `process-dedup:${clientId}:${specialistId}:CONSULTANCY:none`;
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

      const serviceA = new ProcessesService(
        signalDedupLockAttempt(first, firstAttempted) as any,
        {} as any,
      );
      const serviceB = new ProcessesService(
        signalDedupLockAttempt(second, secondAttempted) as any,
        {} as any,
      );
      const input = {
        client_id: clientId,
        specialist_id: specialistId,
        product_type: 'CAR' as const,
        product_id: undefined,
        createdBy: specialistId,
        actorLabel: 'especialista',
      };

      const outcomesPromise = Promise.allSettled([
        serviceA.createOnBehalfOfClient(input),
        serviceB.createOnBehalfOfClient(input),
      ]);
      await Promise.all([firstAttempted.promise, secondAttempted.promise]);
      releaseHolder.resolve();
      await held;
      const outcomes = await outcomesPromise;

      expect(
        outcomes.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        outcomes.find(({ status }) => status === 'rejected'),
      ).toMatchObject({
        reason: expect.any(ConflictException),
      });
      await expect(
        holder.process.count({
          where: { client_id: clientId, specialist_id: specialistId },
        }),
      ).resolves.toBe(1);
    }, 15_000);

    it('serializes two public create requests on the same active-process key', async () => {
      const lockKey = `process-dedup:${clientId}:${specialistId}:CONSULTANCY:none`;
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

      const serviceA = new ProcessesService(
        signalDedupLockAttempt(first, firstAttempted) as any,
        {} as any,
      );
      const serviceB = new ProcessesService(
        signalDedupLockAttempt(second, secondAttempted) as any,
        {} as any,
      );
      const dto = {
        client_id: clientId,
        specialist_id: specialistId,
      } as any;
      const requester = { id: randomUUID(), role: UserRole.ADMIN };
      const firstCreate = serviceA.create(dto, requester);
      const secondCreate = serviceB.create(dto, requester);
      const bothAttemptedBeforeCompletion = await Promise.race([
        Promise.all([firstAttempted.promise, secondAttempted.promise]).then(
          () => true,
        ),
        Promise.allSettled([firstCreate, secondCreate]).then(() => false),
      ]);
      releaseHolder.resolve();
      await held;
      const outcomes = await Promise.allSettled([firstCreate, secondCreate]);

      expect(bothAttemptedBeforeCompletion).toBe(true);
      expect(
        outcomes.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        outcomes.find(({ status }) => status === 'rejected'),
      ).toMatchObject({
        reason: expect.any(ConflictException),
      });
    }, 15_000);

    it('serializes public create with create-on-behalf and permits only one active consultancy', async () => {
      const lockKey = `process-dedup:${clientId}:${specialistId}:CONSULTANCY:none`;
      const holderReady = deferred();
      const releaseHolder = deferred();
      const publicAttempted = deferred();
      const behalfAttempted = deferred();
      const held = holder.$transaction(async (tx) => {
        await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS locked
      `;
        holderReady.resolve();
        await releaseHolder.promise;
      });
      await holderReady.promise;

      const publicService = new ProcessesService(
        signalDedupLockAttempt(first, publicAttempted) as any,
        {} as any,
      );
      const behalfService = new ProcessesService(
        signalDedupLockAttempt(second, behalfAttempted) as any,
        {} as any,
      );
      const publicCreate = publicService.create(
        { client_id: clientId, specialist_id: specialistId } as any,
        { id: randomUUID(), role: UserRole.ADMIN },
      );
      const behalfCreate = behalfService.createOnBehalfOfClient({
        client_id: clientId,
        specialist_id: specialistId,
        product_type: 'CAR',
        product_id: undefined,
        createdBy: specialistId,
        actorLabel: 'especialista',
      });
      const bothAttemptedBeforeCompletion = await Promise.race([
        Promise.all([publicAttempted.promise, behalfAttempted.promise]).then(
          () => true,
        ),
        publicCreate.then(
          () => false,
          () => false,
        ),
      ]);
      releaseHolder.resolve();
      await held;
      const outcomes = await Promise.allSettled([publicCreate, behalfCreate]);

      expect(bothAttemptedBeforeCompletion).toBe(true);
      expect(
        outcomes.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        outcomes.find(({ status }) => status === 'rejected'),
      ).toMatchObject({
        reason: expect.any(ConflictException),
      });
      await expect(
        holder.appointment.count({
          where: {
            client_id: clientId,
            specialist_id: specialistId,
            product_type: null,
            product_id: null,
          },
        }),
      ).resolves.toBeLessThanOrEqual(1);
      await expect(
        holder.process.count({
          where: {
            client_id: clientId,
            specialist_id: specialistId,
            product_type: null,
            status: {
              in: [
                ProcessStatus.SCHEDULING,
                ProcessStatus.NEGOTIATION,
                ProcessStatus.PROCESSING_CONTRACT,
                ProcessStatus.DOCUMENTATION,
              ],
            },
          },
        }),
      ).resolves.toBe(1);
    }, 15_000);
  },
);
