import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import {
  AppointmentSchedulingMethod,
  CalendlySyncStatus,
  PrismaClient,
  ProcessStatus,
  ProductCurrency,
  ProductType,
  StatusAgendamento,
  UserRole,
} from '@prisma/client';
import { ProcessesService } from '../processes/processes.service';
import { AppointmentsService } from './appointments.service';

type Deferred<T = void> = { promise: Promise<T>; resolve: (value: T) => void };

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function observeFirstAdvisoryLock(
  client: PrismaClient,
  attempted: Deferred<string>,
  productAcquired: Deferred,
) {
  let observed = false;
  return new Proxy(client, {
    get(target, property) {
      if (property === '$transaction') {
        return (callback: (tx: any) => Promise<unknown>, options?: any) =>
          target.$transaction(
            (tx) =>
              callback(
                new Proxy(tx, {
                  get(transaction, member) {
                    if (member === '$queryRaw') {
                      return async (
                        strings: TemplateStringsArray,
                        ...values: unknown[]
                      ) => {
                        const key = String(values[0]);
                        if (!observed) {
                          observed = true;
                          attempted.resolve(key);
                        }
                        const result = await transaction.$queryRaw(
                          strings,
                          ...values,
                        );
                        if (key.startsWith('product-money:')) {
                          productAcquired.resolve();
                        }
                        return result;
                      };
                    }
                    return bindMember(transaction, member);
                  },
                }),
              ),
            options,
          );
      }
      return bindMember(target, property);
    },
  });
}

function pauseAfterScheduleLock(
  client: PrismaClient,
  acquired: Deferred,
  release: Deferred,
) {
  return new Proxy(client, {
    get(target, property) {
      if (property === '$transaction') {
        return (callback: (tx: any) => Promise<unknown>, options?: any) =>
          target.$transaction(
            (tx) =>
              callback(
                new Proxy(tx, {
                  get(transaction, member) {
                    if (member === '$queryRaw') {
                      return async (
                        strings: TemplateStringsArray,
                        ...values: unknown[]
                      ) => {
                        const result = await transaction.$queryRaw(
                          strings,
                          ...values,
                        );
                        if (
                          String(values[0]).startsWith('appointment-schedule:')
                        ) {
                          acquired.resolve();
                          await release.promise;
                        }
                        return result;
                      };
                    }
                    return bindMember(transaction, member);
                  },
                }),
              ),
            options,
          );
      }
      return bindMember(target, property);
    },
  });
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
  return new Proxy(client, {
    get(target, property) {
      if (property === '$transaction') {
        return (callback: (tx: any) => Promise<unknown>, options?: any) =>
          target.$transaction(
            (tx) =>
              callback(
                new Proxy(tx, {
                  get(transaction, member) {
                    if (member === '$queryRaw') {
                      return (
                        strings: TemplateStringsArray,
                        ...values: unknown[]
                      ) => {
                        if (
                          String(values[0]).startsWith('appointment-schedule:')
                        )
                          attempted.resolve();
                        return transaction.$queryRaw(strings, ...values);
                      };
                    }
                    return bindMember(transaction, member);
                  },
                }),
              ),
            options,
          );
      }
      return bindMember(target, property);
    },
  });
}

const databaseUrl = process.env.POSTGRES_CONCURRENCY_TEST_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres(
  'appointment schedule lock — PostgreSQL concurrency',
  () => {
    const suffix = randomUUID().replaceAll('-', '');
    const clientIds = [randomUUID(), randomUUID()];
    const specialistIds = [randomUUID(), randomUUID()];
    const carIds = [randomUUID(), randomUUID(), randomUUID()];
    const specialistId = specialistIds[0];
    const proposedIso = '2099-01-01T10:00:00.000Z';
    const proposedDate = new Date(proposedIso);
    let first: PrismaClient;
    let second: PrismaClient;
    let holder: PrismaClient;
    const notifications = {
      sendAppointmentConfirmedEmail: jest.fn().mockResolvedValue(undefined),
      sendAppointmentRescheduledEmail: jest.fn().mockResolvedValue(undefined),
      sendAppointmentCancelledEmail: jest.fn().mockResolvedValue(undefined),
      sendProcessStatusChangedEmail: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
      const client = (name: string) =>
        new PrismaClient({
          datasources: {
            db: { url: withApplicationName(databaseUrl!, `${name}_${suffix}`) },
          },
        });
      first = client('schedule_a');
      second = client('schedule_b');
      holder = client('schedule_holder');
      await holder.user.createMany({
        data: [...clientIds, ...specialistIds].map((id, index) => ({
          id,
          name: 'Schedule',
          surname: `Fixture ${index}`,
          email: `schedule-${index}-${suffix}@example.test`,
          rg: `${suffix.slice(0, 10)}${index}`,
          role: index < 2 ? UserRole.CUSTOMER : UserRole.SPECIALIST,
          speciality: index < 2 ? null : ProductType.CAR,
          password_hash: 'not-used',
        })),
      });
      await holder.car.createMany({
        data: carIds.map((id, index) => ({
          id,
          specialist_id: index < 2 ? specialistId : specialistIds[1],
          marca: 'Schedule',
          modelo: `Car ${index}`,
          identificador: `schedule-${index}-${suffix}`,
          valor: 100000 + index,
          currency: ProductCurrency.BRL,
          estado: 'SP',
          ano: 2026,
        })),
      });
    });

    async function clearAppointments() {
      const where = {
        specialist_id: { in: specialistIds },
        client_id: { in: clientIds },
      };
      const processes = await holder.process.findMany({
        where,
        select: { id: true },
      });
      await holder.processStatusHistory.deleteMany({
        where: { processId: { in: processes.map(({ id }) => id) } },
      });
      await holder.process.deleteMany({
        where: { id: { in: processes.map(({ id }) => id) } },
      });
      await holder.appointment.deleteMany({ where });
    }

    beforeEach(async () => {
      await clearAppointments();
      jest.clearAllMocks();
    });

    afterAll(async () => {
      try {
        if (holder) {
          await clearAppointments();
          await holder.car.deleteMany({ where: { id: { in: carIds } } });
          await holder.user.deleteMany({
            where: { id: { in: [...clientIds, ...specialistIds] } },
          });
        }
      } finally {
        await Promise.all([
          first?.$disconnect(),
          second?.$disconnect(),
          holder?.$disconnect(),
        ]);
      }
    });

    function appointments(client: PrismaClient, attempted?: Deferred) {
      return new AppointmentsService(
        (attempted
          ? signalScheduleLockAttempt(client, attempted)
          : client) as any,
        notifications as any,
        {
          resolveScheduledStartTime: jest.fn().mockResolvedValue(proposedDate),
        } as any,
      );
    }

    function processes(client: PrismaClient, attempted: Deferred) {
      return new ProcessesService(
        signalScheduleLockAttempt(client, attempted) as any,
        notifications as any,
      );
    }

    function createRequest(
      client: PrismaClient,
      index: number,
      otherSpecialist = false,
    ) {
      return appointments(client).createPending(
        {
          client_id: clientIds[index],
          specialist_id: otherSpecialist ? specialistIds[1] : specialistId,
          product_type: ProductType.CAR,
          product_id: otherSpecialist ? carIds[2] : carIds[index],
          scheduling_method: AppointmentSchedulingMethod.EMAIL,
          appointment_datetime: proposedIso,
        },
        clientIds[index],
        UserRole.CUSTOMER,
      );
    }

    // Force both service calls to attempt the real advisory lock while it is held.
    // Release even on an early failure so a broken prerequisite cannot hang Jest.
    async function race<T>(
      start: (a: Deferred, b: Deferred) => [Promise<T>, Promise<T>],
      lockSpecialist = specialistId,
    ) {
      const ready = deferred();
      const release = deferred();
      const a = deferred();
      const b = deferred();
      const held = holder.$transaction(async (tx) => {
        const key = `appointment-schedule:${lockSpecialist}`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text AS locked`;
        ready.resolve();
        await release.promise;
      });
      await ready.promise;
      const calls = start(a, b);
      const outcomes = Promise.allSettled(calls);
      let bothAttempted: boolean;
      try {
        bothAttempted = await Promise.race([
          Promise.all([a.promise, b.promise]).then(() => true),
          Promise.race(
            calls.map((call) =>
              call.then(
                () => false,
                () => false,
              ),
            ),
          ),
        ]);
      } finally {
        release.resolve();
        await held;
      }
      const result = await outcomes;
      expect(bothAttempted).toBe(true);
      return result;
    }

    it('allows concurrent dated EMAIL proposals for the same specialist/time', async () => {
      const outcomes = await Promise.allSettled([
        createRequest(first, 0),
        createRequest(second, 1),
      ]);
      expect(
        outcomes.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(2);
      expect(
        await holder.appointment.count({
          where: {
            specialist_id: specialistId,
            status: StatusAgendamento.PENDING,
            scheduling_method: AppointmentSchedulingMethod.EMAIL,
            appointment_datetime: proposedDate,
          },
        }),
      ).toBe(2);
      expect(
        await holder.process.count({
          where: {
            specialist_id: specialistId,
            status: ProcessStatus.SCHEDULING,
          },
        }),
      ).toBe(2);
      expect(
        await holder.processStatusHistory.count({
          where: { process: { specialist_id: specialistId } },
        }),
      ).toBe(2);
    }, 15_000);

    it('serializes canonical confirmations and leaves the losing request completely pending', async () => {
      const firstRequest = await createRequest(holder, 0);
      const secondRequest = await createRequest(holder, 1);
      const before = await holder.process.findMany({
        where: {
          id: { in: [firstRequest.process_id, secondRequest.process_id] },
        },
        include: { appointment: true },
      });
      const outcomes = await race((a, b) => [
        processes(first, a).confirmAppointment(
          firstRequest.process_id,
          specialistId,
          proposedIso,
        ),
        processes(second, b).confirmAppointment(
          secondRequest.process_id,
          specialistId,
          proposedIso,
        ),
      ]);
      expect(
        outcomes.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
      const failure = outcomes.find(
        ({ status }) => status === 'rejected',
      ) as PromiseRejectedResult;
      expect(failure.reason).toBeInstanceOf(ConflictException);
      const loserIndex = outcomes.findIndex(
        ({ status }) => status === 'rejected',
      );
      const loserId = [firstRequest.process_id, secondRequest.process_id][
        loserIndex
      ];
      expect(
        await holder.process.findUniqueOrThrow({
          where: { id: loserId },
          include: { appointment: true },
        }),
      ).toEqual(before.find(({ id }) => id === loserId));
      expect(
        await holder.appointment.count({
          where: {
            specialist_id: specialistId,
            appointment_datetime: proposedDate,
            status: StatusAgendamento.SCHEDULED,
          },
        }),
      ).toBe(1);
      expect(
        await holder.process.count({
          where: {
            specialist_id: specialistId,
            status: ProcessStatus.SCHEDULING,
          },
        }),
      ).toBe(2);
      expect(
        await holder.processStatusHistory.count({
          where: { process: { specialist_id: specialistId } },
        }),
      ).toBe(2);
    }, 15_000);

    it('allows different specialists to confirm the same instant', async () => {
      const firstRequest = await createRequest(holder, 0);
      const secondRequest = await createRequest(holder, 1, true);
      const outcomes = await Promise.allSettled([
        new ProcessesService(
          first as any,
          notifications as any,
        ).confirmAppointment(
          firstRequest.process_id,
          specialistId,
          proposedIso,
        ),
        new ProcessesService(
          second as any,
          notifications as any,
        ).confirmAppointment(
          secondRequest.process_id,
          specialistIds[1],
          proposedIso,
        ),
      ]);
      expect(
        outcomes.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(2);
      expect(
        await holder.appointment.count({
          where: {
            specialist_id: { in: specialistIds },
            status: StatusAgendamento.SCHEDULED,
            appointment_datetime: proposedDate,
          },
        }),
      ).toBe(2);
    }, 15_000);

    it('makes a concurrent double-click idempotent without duplicate notes, histories or emails', async () => {
      const request = await createRequest(holder, 0);
      const outcomes = await race((a, b) => [
        processes(first, a).confirmAppointment(
          request.process_id,
          specialistId,
          proposedIso,
        ),
        processes(second, b).confirmAppointment(
          request.process_id,
          specialistId,
          proposedIso,
        ),
      ]);
      expect(
        outcomes.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(2);
      expect(outcomes[0]).toEqual(outcomes[1]);
      const stored = await holder.process.findUniqueOrThrow({
        where: { id: request.process_id },
        include: { appointment: true },
      });
      expect(stored.status).toBe(ProcessStatus.SCHEDULING);
      expect(
        stored.notes?.match(/Agendamento confirmado pelo especialista/g),
      ).toHaveLength(1);
      expect(stored.appointment).toMatchObject({
        status: StatusAgendamento.SCHEDULED,
        appointment_datetime: proposedDate,
        specialist_rescheduled_at: null,
        specialist_rescheduled_from: null,
      });
      expect(
        await holder.processStatusHistory.count({
          where: { processId: stored.id },
        }),
      ).toBe(1);
      expect(
        await holder.appointment.count({
          where: { specialist_id: specialistId },
        }),
      ).toBe(1);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(notifications.sendAppointmentConfirmedEmail).toHaveBeenCalledTimes(
        1,
      );
    }, 15_000);

    it('rolls back the process claim if appointment persistence fails', async () => {
      const request = await createRequest(holder, 0);
      const before = await holder.process.findUniqueOrThrow({
        where: { id: request.process_id },
        include: { appointment: true },
      });
      const failingStorage = new Proxy(first, {
        get(target, property) {
          if (property === '$transaction')
            return (callback: any) =>
              target.$transaction((tx) =>
                callback(
                  new Proxy(tx, {
                    get(transaction, member) {
                      if (member === 'appointment')
                        return new Proxy(transaction.appointment, {
                          get(repository, action) {
                            if (action === 'update')
                              return async () => {
                                throw new Error(
                                  'appointment persistence failed',
                                );
                              };
                            return bindMember(repository, action);
                          },
                        });
                      return bindMember(transaction, member);
                    },
                  }),
                ),
              );
          return bindMember(target, property);
        },
      });
      await expect(
        new ProcessesService(
          failingStorage as any,
          notifications as any,
        ).confirmAppointment(request.process_id, specialistId, proposedIso),
      ).rejects.toThrow('appointment persistence failed');
      expect(
        await holder.process.findUniqueOrThrow({
          where: { id: request.process_id },
          include: { appointment: true },
        }),
      ).toEqual(before);
      expect(
        await holder.processStatusHistory.count({
          where: { processId: request.process_id },
        }),
      ).toBe(1);
      expect(
        notifications.sendAppointmentConfirmedEmail,
      ).not.toHaveBeenCalled();
    }, 15_000);

    it('allows only one definitive reschedule under concurrent requests', async () => {
      const request = await createRequest(holder, 0);
      await new ProcessesService(
        holder as any,
        notifications as any,
      ).confirmAppointment(request.process_id, specialistId, proposedIso);
      const outcomes = await race((a, b) => [
        appointments(first, a).reschedule(
          request.id,
          '2099-01-02T10:00:00Z',
          specialistId,
        ),
        appointments(second, b).reschedule(
          request.id,
          '2099-01-03T10:00:00Z',
          specialistId,
        ),
      ]);
      expect(
        outcomes.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        outcomes.find(({ status }) => status === 'rejected'),
      ).toMatchObject({ reason: expect.any(ConflictException) });
      const stored = await holder.appointment.findUniqueOrThrow({
        where: { id: request.id },
      });
      expect(stored.specialist_rescheduled_at).not.toBeNull();
      expect(stored.specialist_rescheduled_from).toEqual(proposedDate);
    }, 15_000);

    async function calendlyRequest(index: number) {
      return holder.appointment.create({
        data: {
          client_id: clientIds[index],
          specialist_id: specialistId,
          product_type: ProductType.CAR,
          product_id: carIds[index],
          status: StatusAgendamento.PENDING,
          scheduling_method: AppointmentSchedulingMethod.CALENDLY,
        },
      });
    }

    it.each([AppointmentSchedulingMethod.CALENDLY, null])(
      'serializes legacy confirmPending requests for the same specialist/time (%s)',
      async (schedulingMethod) => {
        const pending = await Promise.all(
          clientIds.map(async (clientId, index) => {
            const appointment = await holder.appointment.create({
              data: {
                client_id: clientId,
                specialist_id: specialistId,
                product_type: ProductType.CAR,
                product_id: carIds[index],
                status: StatusAgendamento.PENDING,
                scheduling_method: schedulingMethod,
                appointment_datetime: null,
              },
            });
            await holder.process.create({
              data: {
                client_id: clientId,
                specialist_id: specialistId,
                product_type: ProductType.CAR,
                car_id: carIds[index],
                appointment_id: appointment.id,
                status: ProcessStatus.SCHEDULING,
              },
            });
            return appointment;
          }),
        );
        const before = await holder.process.findMany({
          where: { appointment_id: { in: pending.map(({ id }) => id) } },
          include: { appointment: true },
        });
        const outcomes = await race((a, b) => [
          appointments(first, a).confirmPending(
            pending[0].id,
            specialistId,
            proposedDate,
          ),
          appointments(second, b).confirmPending(
            pending[1].id,
            specialistId,
            proposedDate,
          ),
        ]);
        expect(
          outcomes.filter(({ status }) => status === 'fulfilled'),
        ).toHaveLength(1);
        expect(
          outcomes.find(({ status }) => status === 'rejected'),
        ).toMatchObject({ reason: expect.any(ConflictException) });
        const loserId =
          pending[outcomes.findIndex(({ status }) => status === 'rejected')].id;
        expect(
          await holder.process.findUniqueOrThrow({
            where: { appointment_id: loserId },
            include: { appointment: true },
          }),
        ).toEqual(
          before.find(({ appointment_id }) => appointment_id === loserId),
        );
        expect(
          await holder.appointment.count({
            where: {
              specialist_id: specialistId,
              status: StatusAgendamento.SCHEDULED,
              appointment_datetime: proposedDate,
            },
          }),
        ).toBe(1);
        expect(
          await holder.process.count({
            where: {
              specialist_id: specialistId,
              status: ProcessStatus.NEGOTIATION,
            },
          }),
        ).toBe(1);
        expect(
          await holder.processStatusHistory.count({
            where: { process: { specialist_id: specialistId } },
          }),
        ).toBe(1);
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(
          notifications.sendAppointmentConfirmedEmail,
        ).toHaveBeenCalledTimes(1);
      },
      15_000,
    );

    it('keeps schedule → product lock order across completion and legacy confirmation', async () => {
      const confirmingAppointment = await holder.appointment.create({
        data: {
          client_id: clientIds[0],
          specialist_id: specialistId,
          product_type: ProductType.CAR,
          product_id: carIds[0],
          status: StatusAgendamento.PENDING,
          scheduling_method: AppointmentSchedulingMethod.CALENDLY,
        },
      });
      await holder.process.create({
        data: {
          client_id: clientIds[0],
          specialist_id: specialistId,
          product_type: ProductType.CAR,
          car_id: carIds[0],
          appointment_id: confirmingAppointment.id,
          status: ProcessStatus.SCHEDULING,
        },
      });

      const completingAppointment = await holder.appointment.create({
        data: {
          client_id: clientIds[1],
          specialist_id: specialistId,
          product_type: ProductType.CAR,
          product_id: carIds[0],
          status: StatusAgendamento.SCHEDULED,
          scheduling_method: AppointmentSchedulingMethod.CALENDLY,
          appointment_datetime: new Date('2099-01-01T08:00:00.000Z'),
        },
      });
      await holder.process.create({
        data: {
          client_id: clientIds[1],
          specialist_id: specialistId,
          product_type: ProductType.CAR,
          car_id: carIds[0],
          appointment_id: completingAppointment.id,
          status: ProcessStatus.SCHEDULING,
        },
      });

      const completionHasSchedule = deferred();
      const releaseCompletion = deferred();
      const confirmationFirstAttempt = deferred<string>();
      const confirmationProductAcquired = deferred();
      const completionService = new AppointmentsService(
        pauseAfterScheduleLock(
          second,
          completionHasSchedule,
          releaseCompletion,
        ) as any,
        notifications as any,
        {} as any,
      );
      const confirmationService = new AppointmentsService(
        observeFirstAdvisoryLock(
          first,
          confirmationFirstAttempt,
          confirmationProductAcquired,
        ) as any,
        notifications as any,
        {} as any,
      );

      const completion = completionService.updateStatus(
        completingAppointment.id,
        { status: StatusAgendamento.COMPLETED },
        specialistId,
        UserRole.SPECIALIST,
      );
      await completionHasSchedule.promise;
      const confirmation = confirmationService.confirmPending(
        confirmingAppointment.id,
        specialistId,
        new Date('2099-01-02T10:00:00.000Z'),
      );
      const firstKey = await confirmationFirstAttempt.promise;
      if (firstKey.startsWith('product-money:')) {
        await confirmationProductAcquired.promise;
      }
      releaseCompletion.resolve();

      await expect(
        Promise.all([completion, confirmation]),
      ).resolves.toHaveLength(2);
      expect(firstKey).toBe(`appointment-schedule:${specialistId}`);
    }, 15_000);

    it('keeps confirmation/cancellation races consistent and releases the product for a new request', async () => {
      const request = await createRequest(holder, 0);
      const outcomes = await race<any>((a, b) => [
        appointments(first, a).updateStatus(
          request.id,
          { status: StatusAgendamento.CANCELLED },
          clientIds[0],
          UserRole.CUSTOMER,
        ),
        processes(second, b).confirmAppointment(
          request.process_id,
          specialistId,
          proposedIso,
        ),
      ]);

      expect(outcomes[0].status).toBe('fulfilled');
      expect(
        await holder.appointment.findUniqueOrThrow({
          where: { id: request.id },
          include: { process: true },
        }),
      ).toMatchObject({
        status: StatusAgendamento.CANCELLED,
        process: null,
      });
      expect(
        await holder.process.findUnique({ where: { id: request.process_id } }),
      ).toBeNull();

      const replacement = await createRequest(holder, 0);
      expect(replacement).toMatchObject({
        status: StatusAgendamento.PENDING,
      });
      expect(replacement.id).not.toBe(request.id);
      expect(replacement.process_id).not.toBe(request.process_id);
      expect(
        await holder.process.findUniqueOrThrow({
          where: { id: replacement.process_id },
        }),
      ).toMatchObject({ status: ProcessStatus.SCHEDULING });
    }, 15_000);

    it('serializes the process cancellation route against confirmation without orphaning either record', async () => {
      const request = await createRequest(holder, 0);
      const outcomes = await race<any>((a, b) => [
        processes(first, a).cancelAppointment(request.process_id, clientIds[0]),
        processes(second, b).confirmAppointment(
          request.process_id,
          specialistId,
          proposedIso,
        ),
      ]);

      expect(outcomes[0].status).toBe('fulfilled');
      expect(
        await holder.appointment.findUnique({ where: { id: request.id } }),
      ).toBeNull();
      expect(
        await holder.process.findUnique({ where: { id: request.process_id } }),
      ).toBeNull();

      const replacement = await createRequest(holder, 0);
      expect(replacement.status).toBe(StatusAgendamento.PENDING);
      expect(replacement.id).not.toBe(request.id);
      expect(replacement.process_id).not.toBe(request.process_id);
    }, 15_000);

    it.each(['appointment', 'process'] as const)(
      'serializes %s cancellation against a process status advance',
      async (route) => {
        const request = await createRequest(holder, 0);
        const outcomes = await race<any>((a, b) => [
          route === 'appointment'
            ? appointments(first, a).cancelPending(request.id, clientIds[0])
            : processes(first, a).cancelAppointment(
                request.process_id,
                clientIds[0],
              ),
          processes(second, b).update(
            request.process_id,
            {
              status: ProcessStatus.NEGOTIATION,
              notes: 'advance concorrente',
            },
            specialistId,
            UserRole.SPECIALIST,
          ),
        ]);

        expect(
          outcomes.filter(({ status }) => status === 'fulfilled'),
        ).toHaveLength(1);
        const storedProcess = await holder.process.findUnique({
          where: { id: request.process_id },
        });
        const storedAppointment = await holder.appointment.findUnique({
          where: { id: request.id },
        });
        if (outcomes[0].status === 'fulfilled') {
          expect(storedProcess).toBeNull();
          expect(storedAppointment).toBeNull();
        } else {
          expect(storedProcess).toMatchObject({
            status: ProcessStatus.NEGOTIATION,
          });
          expect(storedAppointment).toMatchObject({
            status: StatusAgendamento.PENDING,
          });
        }
      },
      15_000,
    );

    function callback(
      client: PrismaClient,
      attempted: Deferred,
      appointment: { id: string },
      index: number,
    ) {
      return appointments(client, attempted).registerCalendlyScheduled(
        appointment.id,
        clientIds[index],
        {
          event_uri: `https://api.calendly.com/scheduled_events/${appointment.id}`,
          invitee_uri: `https://api.calendly.com/scheduled_events/${appointment.id}/invitees/${appointment.id}`,
        },
      );
    }

    it('serializes two Calendly callbacks that resolve to an overlapping time', async () => {
      const a = await calendlyRequest(0);
      const b = await calendlyRequest(1);
      const outcomes = await race((firstAttempt, secondAttempt) => [
        callback(first, firstAttempt, a, 0),
        callback(second, secondAttempt, b, 1),
      ]);
      expect(
        outcomes.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        outcomes.find(({ status }) => status === 'rejected'),
      ).toMatchObject({ reason: expect.any(ConflictException) });
      expect(
        await holder.appointment.count({
          where: {
            specialist_id: specialistId,
            calendly_sync_status: CalendlySyncStatus.SYNCED,
          },
        }),
      ).toBe(1);
    }, 15_000);

    it('serializes the canonical confirmation against a Calendly callback', async () => {
      const request = await createRequest(holder, 0);
      const pendingCalendly = await calendlyRequest(1);
      const outcomes = await race<any>((a, b) => [
        processes(first, a).confirmAppointment(
          request.process_id,
          specialistId,
          proposedIso,
        ),
        callback(second, b, pendingCalendly, 1),
      ]);
      expect(
        outcomes.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        outcomes.find(({ status }) => status === 'rejected'),
      ).toMatchObject({ reason: expect.any(ConflictException) });
      expect(
        await holder.appointment.count({
          where: {
            specialist_id: specialistId,
            appointment_datetime: proposedDate,
            OR: [
              { status: StatusAgendamento.SCHEDULED },
              {
                status: StatusAgendamento.PENDING,
                scheduling_method: AppointmentSchedulingMethod.CALENDLY,
                calendly_sync_status: CalendlySyncStatus.SYNCED,
              },
            ],
          },
        }),
      ).toBe(1);
    }, 15_000);
  },
);
