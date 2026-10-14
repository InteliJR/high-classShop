import {
  AppointmentSchedulingMethod,
  Prisma,
  ProcessStatus,
  ProductCurrency,
  ProductType,
  StatusAgendamento,
  UserRole,
} from '@prisma/client';
import { validate } from 'class-validator';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreatePendingAppointmentDto } from './dto/create-pending-appointment.dto';
import { CreatePlatformAppointmentDto } from './dto/create-platform-appointment.dto';
import { GetAppointmentsQueryDto } from './dto/get-appointments-query.dto';
import { AppointmentsService } from './appointments.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

describe('CreateAppointmentDto — seleção de produto', () => {
  const base = {
    client_id: '22222222-2222-4222-8222-222222222222',
    specialist_id: '33333333-3333-4333-8333-333333333333',
  };

  it.each([
    { product_type: ProductType.CAR },
    { product_id: '11111111-1111-4111-8111-111111111111' },
  ])('rejeita seleção parcial de produto: %o', async (partial) => {
    const dto = Object.assign(new CreateAppointmentDto(), base, partial);

    const errors = await validate(dto);

    expect(
      errors.some((error) =>
        ['product_type', 'product_id'].includes(error.property),
      ),
    ).toBe(true);
  });

  it('exige appointment_datetime no agendamento interno', async () => {
    const dto = Object.assign(new CreatePlatformAppointmentDto(), base);

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'appointment_datetime'),
    ).toBe(true);
  });

  it('rejeita PLATFORM no endpoint de agendamento pendente', async () => {
    const dto = Object.assign(new CreatePendingAppointmentDto(), base, {
      scheduling_method: AppointmentSchedulingMethod.PLATFORM,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'scheduling_method')).toBe(
      true,
    );
  });

  it('validates an optional pending datetime as ISO 8601', async () => {
    const dto = Object.assign(new CreatePendingAppointmentDto(), base, {
      scheduling_method: AppointmentSchedulingMethod.EMAIL,
      appointment_datetime: 'not-a-date',
    });
    expect(
      (await validate(dto)).some(
        (error) => error.property === 'appointment_datetime',
      ),
    ).toBe(true);
  });

  it.each([
    '2099-01-01',
    '2099-01-01T10:00:00',
    '2099-01-01T10:00:00.000',
    '2099-02-30T10:00:00Z',
    '2099-01-01T10:00:00+25:00',
  ])(
    'rejects a pending datetime without a valid time and timezone: %s',
    async (datetime) => {
      const dto = Object.assign(new CreatePendingAppointmentDto(), base, {
        scheduling_method: AppointmentSchedulingMethod.EMAIL,
        appointment_datetime: datetime,
      });
      expect(
        (await validate(dto)).some(
          (error) => error.property === 'appointment_datetime',
        ),
      ).toBe(true);
    },
  );

  it.each([
    '2099-01-01T10:00:00.000Z',
    '2099-01-01T07:00:00-03:00',
    '2099-01-01T15:30:00+05:30',
    '2099-01-01T07:00:00-0300',
  ])('accepts an explicit pending datetime timezone: %s', async (datetime) => {
    const dto = Object.assign(new CreatePendingAppointmentDto(), base, {
      scheduling_method: AppointmentSchedulingMethod.EMAIL,
      appointment_datetime: datetime,
    });
    expect(await validate(dto)).toEqual([]);
  });
});

describe('GetAppointmentsQueryDto — limite de paginação', () => {
  it('rejeita limit maior que 100', async () => {
    const dto = Object.assign(new GetAppointmentsQueryDto(), { limit: 101 });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'limit',
          constraints: expect.objectContaining({ max: expect.any(String) }),
        }),
      ]),
    );
  });
});

describe('AppointmentsService.createPending — associação e atomicidade', () => {
  const client = {
    id: 'client-1',
    name: 'Cliente',
    surname: 'Teste',
    email: 'cliente@example.com',
    role: UserRole.CUSTOMER,
  };
  const specialist = {
    id: 'specialist-1',
    name: 'Especialista',
    surname: 'Teste',
    email: 'especialista@example.com',
    role: UserRole.SPECIALIST,
    speciality: ProductType.CAR,
  };
  const activeProduct = {
    id: 'product-1',
    specialist_id: specialist.id,
    is_active: true,
    marca: 'Porsche',
    modelo: '911',
  };
  const dto = {
    client_id: client.id,
    specialist_id: specialist.id,
    product_type: ProductType.CAR,
    product_id: activeProduct.id,
    appointment_datetime: '2099-01-01T10:00:00.000Z',
    scheduling_method: AppointmentSchedulingMethod.EMAIL,
  } as CreatePendingAppointmentDto;

  function harness(options: {
    transactionalProduct?: typeof activeProduct;
    processFailure?: Error;
    historyFailure?: Error;
    calendlyUrl?: string | null;
    connectionActive?: boolean;
    existingProcess?: any;
  }) {
    const storedAppointments: any[] = [];
    const storedProcesses: any[] = [];
    const appointmentCreate = jest.fn(async ({ data }) => {
      const appointment = {
        id: `appointment-${storedAppointments.length + 1}`,
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
      };
      storedAppointments.push(appointment);
      return appointment;
    });
    const processCreate = jest.fn(async ({ data }) => {
      if (options.processFailure) throw options.processFailure;
      const process = { id: `process-${storedProcesses.length + 1}`, ...data };
      storedProcesses.push(process);
      return process;
    });
    const historyCreate = jest.fn(async () => {
      if (options.historyFailure) throw options.historyFailure;
      return {};
    });
    const selectedSpecialist = {
      ...specialist,
      calendly_url: options.calendlyUrl ?? null,
      calendly_connection:
        options.connectionActive === undefined
          ? null
          : { is_active: options.connectionActive },
    };
    const userFindUnique = jest.fn(async ({ where }) =>
      where.id === client.id ? client : selectedSpecialist,
    );
    const rootProductFindUnique = jest.fn().mockResolvedValue(activeProduct);
    const rootAppointmentCreate = jest.fn();
    const rootProcessCreate = jest.fn();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      user: { findUnique: userFindUnique },
      car: {
        findUnique: jest
          .fn()
          .mockResolvedValue(options.transactionalProduct ?? activeProduct),
      },
      boat: { findUnique: jest.fn() },
      aircraft: { findUnique: jest.fn() },
      appointment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: appointmentCreate,
      },
      process: {
        findFirst: jest.fn().mockResolvedValue(options.existingProcess ?? null),
        create: processCreate,
      },
      processStatusHistory: { create: historyCreate },
    };
    const prisma = {
      user: { findUnique: userFindUnique },
      car: { findUnique: rootProductFindUnique },
      boat: { findUnique: jest.fn() },
      aircraft: { findUnique: jest.fn() },
      appointment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: rootAppointmentCreate,
      },
      process: { create: rootProcessCreate },
      $transaction: jest.fn(async (callback) => {
        const before = storedAppointments.length;
        const beforeProcesses = storedProcesses.length;
        try {
          return await callback(tx);
        } catch (error) {
          storedAppointments.splice(before);
          storedProcesses.splice(beforeProcesses);
          throw error;
        }
      }),
    } as any;
    return {
      service: new AppointmentsService(
        prisma,
        {
          sendAppointmentCreatedEmail: jest.fn().mockResolvedValue(undefined),
        } as any,
        {} as any,
      ),
      prisma,
      tx,
      appointmentCreate,
      processCreate,
      historyCreate,
      rootAppointmentCreate,
      rootProcessCreate,
      storedAppointments,
      storedProcesses,
    };
  }

  it.each([
    ['inativo', { ...activeProduct, is_active: false }, BadRequestException],
    [
      'de outro especialista',
      { ...activeProduct, specialist_id: 'other-specialist' },
      ForbiddenException,
    ],
  ])(
    'rejeita produto %s usando o cliente transacional antes das escritas',
    async (_label, transactionalProduct, expectedError) => {
      const { service, prisma, tx, appointmentCreate, processCreate } = harness(
        {
          transactionalProduct,
          processFailure: new Error('process should not be reached'),
        },
      );

      await expect(
        service.createPending(dto, client.id, UserRole.CUSTOMER),
      ).rejects.toThrow(expectedError);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.car.findUnique).toHaveBeenCalled();
      expect(appointmentCreate).not.toHaveBeenCalled();
      expect(processCreate).not.toHaveBeenCalled();
    },
  );

  it('rolls back the appointment when process creation fails', async () => {
    const processFailure = new Error('process insert failed');
    const {
      service,
      prisma,
      storedAppointments,
      rootAppointmentCreate,
      rootProcessCreate,
    } = harness({
      processFailure,
    });

    await expect(
      service.createPending(dto, client.id, UserRole.CUSTOMER),
    ).rejects.toBe(processFailure);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(storedAppointments).toHaveLength(0);
    expect(rootAppointmentCreate).not.toHaveBeenCalled();
    expect(rootProcessCreate).not.toHaveBeenCalled();
  });

  it.each([UserRole.SPECIALIST, UserRole.CONSULTANT, UserRole.ADMIN])(
    'rejects pending requests by %s',
    async (role) => {
      const { service, appointmentCreate } = harness({});

      await expect(service.createPending(dto, client.id, role)).rejects.toThrow(
        ForbiddenException,
      );
      expect(appointmentCreate).not.toHaveBeenCalled();
    },
  );

  it('rejects a customer scheduling for another client', async () => {
    const { service, appointmentCreate } = harness({});

    await expect(
      service.createPending(dto, 'another-client', UserRole.CUSTOMER),
    ).rejects.toThrow(ForbiddenException);
    expect(appointmentCreate).not.toHaveBeenCalled();
  });

  it('stores the proposed date as PENDING/EMAIL and returns the process ID', async () => {
    const { service, appointmentCreate, historyCreate } = harness({});

    const result = await service.createPending(
      dto,
      client.id,
      UserRole.CUSTOMER,
    );

    expect(appointmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StatusAgendamento.PENDING,
          scheduling_method: AppointmentSchedulingMethod.EMAIL,
          appointment_datetime: new Date(dto.appointment_datetime!),
        }),
      }),
    );
    expect(result).toMatchObject({
      id: 'appointment-1',
      process_id: 'process-1',
    });
    expect(historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        processId: 'process-1',
        status: ProcessStatus.SCHEDULING,
        changed_by: client.id,
      }),
    });
  });

  it.each([false, true])(
    'checks the new request after rejection regardless of record order (reverse=%s)',
    async (reverse) => {
      const { service, prisma, tx, storedAppointments, storedProcesses } =
        harness({});
      const matches = (row: any, where: any) =>
        Object.entries(where).every(([key, value]) =>
          value !== null && typeof value === 'object' && 'in' in value
            ? (value.in as unknown[]).includes(row[key])
            : row[key] === value,
        );
      tx.process.findFirst.mockImplementation(
        async ({ where }) =>
          storedProcesses.find((row) => matches(row, where)) ?? null,
      );
      prisma.appointment.findFirst.mockImplementation(async ({ where }) => {
        const { process: processFilter, ...appointmentFilter } = where;
        const rows = reverse
          ? [...storedAppointments].reverse()
          : storedAppointments;
        for (const appointment of rows) {
          const process = storedProcesses.find(
            (row) => row.appointment_id === appointment.id,
          );
          if (
            matches(appointment, appointmentFilter) &&
            process &&
            matches(process, processFilter.is)
          ) {
            return { ...appointment, process };
          }
        }
        return null;
      });

      await service.createPending(dto, client.id, UserRole.CUSTOMER);
      // Rejecting a process preserves the original PENDING appointment.
      storedProcesses[0].status = ProcessStatus.REJECTED;
      const replacement = await service.createPending(
        dto,
        client.id,
        UserRole.CUSTOMER,
      );

      expect(
        await service.findExistingAppointment(
          client.id,
          specialist.id,
          ProductType.CAR,
          activeProduct.id,
        ),
      ).toEqual({
        exists: true,
        appointment_id: replacement.id,
        process_id: replacement.process_id,
        appointment_status: StatusAgendamento.PENDING,
        scheduling_method: AppointmentSchedulingMethod.EMAIL,
        appointment_datetime: new Date(dto.appointment_datetime!),
      });

      storedProcesses[1].status = ProcessStatus.REJECTED;
      expect(
        await service.findExistingAppointment(
          client.id,
          specialist.id,
          ProductType.CAR,
          activeProduct.id,
        ),
      ).toEqual({ exists: false });
    },
  );

  it.each([
    '2099-01-01T07:00:00-03:00',
    '2099-01-01T15:30:00+05:30',
    '2099-01-01T07:00:00-0300',
  ])(
    'persists the exact instant of a product EMAIL proposal with offset %s',
    async (datetime) => {
      const { service } = harness({});
      await expect(
        service.createPending(
          { ...dto, appointment_datetime: datetime },
          client.id,
          UserRole.CUSTOMER,
        ),
      ).resolves.toMatchObject({
        appointment_datetime: new Date('2099-01-01T10:00:00.000Z'),
        status: StatusAgendamento.PENDING,
      });
    },
  );

  it('does not lock or check schedule availability for an EMAIL proposal', async () => {
    const { service, tx } = harness({});

    await service.createPending(dto, client.id, UserRole.CUSTOMER);

    expect(tx.$queryRaw.mock.calls.map((call) => call[1])).not.toContain(
      'appointment-schedule:specialist-1',
    );
    expect(tx.appointment.findFirst).not.toHaveBeenCalled();
  });

  it('requires a date for an EMAIL product request', async () => {
    const { service, tx, appointmentCreate } = harness({});
    const withoutDate = { ...dto, appointment_datetime: undefined };

    await expect(
      service.createPending(withoutDate, client.id, UserRole.CUSTOMER),
    ).rejects.toThrow(BadRequestException);

    expect(tx.appointment.findFirst).not.toHaveBeenCalled();
    expect(appointmentCreate).not.toHaveBeenCalled();
  });

  it('serializa e repete a deduplicação do processo antes de criá-lo', async () => {
    const { service, tx } = harness({});

    await service.createPending(dto, client.id, UserRole.CUSTOMER);

    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      'process-dedup:client-1:specialist-1:CAR:product-1',
    );
    expect(tx.process.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ car_id: 'product-1' }),
      }),
    );
    expect(tx.process.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
      tx.process.create.mock.invocationCallOrder[0],
    );
  });

  it.each([
    'not-a-date',
    '2099-01-01',
    '2099-01-01T10:00:00',
    '2099-01-01T10:00:00.000',
    '2099-02-30T10:00:00Z',
    '2099-01-01T10:00:00+25:00',
    '2000-01-01T00:00:00.000Z',
    '2026-10-14T12:00:00.000Z',
    '2026-10-14T09:00:00-03:00',
  ])(
    'rejects an invalid, ambiguous, past or current product EMAIL date %s before writes',
    async (datetime) => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-14T12:00:00.000Z'));
      try {
        const {
          service,
          prisma,
          appointmentCreate,
          processCreate,
          historyCreate,
        } = harness({});
        await expect(
          service.createPending(
            { ...dto, appointment_datetime: datetime },
            client.id,
            UserRole.CUSTOMER,
          ),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(appointmentCreate).not.toHaveBeenCalled();
        expect(processCreate).not.toHaveBeenCalled();
        expect(historyCreate).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it('rolls back appointment and process when history insertion fails', async () => {
    const historyFailure = new Error('history insert failed');
    const { service, storedAppointments, storedProcesses } = harness({
      historyFailure,
    });
    await expect(
      service.createPending(dto, client.id, UserRole.CUSTOMER),
    ).rejects.toBe(historyFailure);
    expect(storedAppointments).toHaveLength(0);
    expect(storedProcesses).toHaveLength(0);
  });

  it.each([
    [null, false, false],
    ['https://calendly.com/specialist/meeting', false, false],
    [null, true, false],
    ['http://calendly.com/specialist/meeting', true, false],
    ['https://calendly.com.evil.test/meeting', true, false],
    ['https://calendly.com/specialist/meeting', true, true],
  ])(
    'enforces reciprocal method capability for URL %s and connection %s',
    async (calendlyUrl, connectionActive, available) => {
      for (const method of [
        AppointmentSchedulingMethod.EMAIL,
        AppointmentSchedulingMethod.CALENDLY,
      ]) {
        const { service, appointmentCreate } = harness({
          calendlyUrl,
          connectionActive,
        });
        const input = {
          ...dto,
          scheduling_method: method,
          appointment_datetime:
            method === AppointmentSchedulingMethod.EMAIL
              ? dto.appointment_datetime
              : undefined,
        };
        const creation = service.createPending(
          input,
          client.id,
          UserRole.CUSTOMER,
        );
        if ((method === AppointmentSchedulingMethod.CALENDLY) === available) {
          await expect(creation).resolves.toMatchObject({
            status: StatusAgendamento.PENDING,
            scheduling_method: method,
            process_id: 'process-1',
          });
        } else {
          const error = await creation.catch((caught) => caught);
          expect(error).toBeInstanceOf(ConflictException);
          expect(error.getResponse()).toEqual({
            success: false,
            error: {
              code:
                method === AppointmentSchedulingMethod.CALENDLY
                  ? 'CALENDLY_UNAVAILABLE'
                  : 'EMAIL_FLOW_UNAVAILABLE',
              message: expect.any(String),
            },
          });
          expect(appointmentCreate).not.toHaveBeenCalled();
        }
      }
    },
  );

  it('preserves optional date EMAIL consultancy even with Calendly available', async () => {
    const { service, appointmentCreate } = harness({
      calendlyUrl: 'https://calendly.com/specialist/meeting',
      connectionActive: true,
    });
    await expect(
      service.createPending(
        {
          client_id: client.id,
          specialist_id: specialist.id,
          scheduling_method: AppointmentSchedulingMethod.EMAIL,
        },
        client.id,
        UserRole.CUSTOMER,
      ),
    ).resolves.toMatchObject({
      process_id: 'process-1',
      appointment_datetime: null,
    });
    expect(appointmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StatusAgendamento.PENDING,
          scheduling_method: AppointmentSchedulingMethod.EMAIL,
          appointment_datetime: null,
        }),
      }),
    );
  });

  it('persists an optional future consultancy EMAIL date exactly under the schedule lock', async () => {
    const { service, tx } = harness({});
    const datetime = '2099-01-01T07:00:00-03:00';
    await expect(
      service.createPending(
        {
          client_id: client.id,
          specialist_id: specialist.id,
          scheduling_method: AppointmentSchedulingMethod.EMAIL,
          appointment_datetime: datetime,
        },
        client.id,
        UserRole.CUSTOMER,
      ),
    ).resolves.toMatchObject({
      appointment_datetime: new Date(datetime),
      status: StatusAgendamento.PENDING,
      process_id: 'process-1',
    });
    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      'appointment-schedule:specialist-1',
    );
    expect(tx.appointment.findFirst).toHaveBeenCalledTimes(1);
  });

  it.each([
    'not-a-date',
    '01/01/2099',
    '2099-01-01',
    '2099-01-01T10:00:00',
    '2099-01-01T10:00:00.000',
    '2000-01-01T00:00:00.000Z',
    '2026-10-14T12:00:00.000Z',
  ])(
    'rejects invalid, non-ISO, past or current optional consultancy date %s before writes',
    async (datetime) => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-14T12:00:00.000Z'));
      try {
        const { service, appointmentCreate, processCreate } = harness({});
        await expect(
          service.createPending(
            {
              client_id: client.id,
              specialist_id: specialist.id,
              scheduling_method: AppointmentSchedulingMethod.EMAIL,
              appointment_datetime: datetime,
            },
            client.id,
            UserRole.CUSTOMER,
          ),
        ).rejects.toThrow(BadRequestException);
        expect(appointmentCreate).not.toHaveBeenCalled();
        expect(processCreate).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it('returns ACTIVE_PROCESS_EXISTS with the owned proposal after acquiring the dedup lock', async () => {
    const proposedDate = new Date(dto.appointment_datetime!);
    const { service, prisma, tx, appointmentCreate } = harness({
      existingProcess: {
        id: 'process-existing',
        client_id: client.id,
        appointment: {
          id: 'appointment-existing',
          client_id: client.id,
          status: StatusAgendamento.PENDING,
          scheduling_method: AppointmentSchedulingMethod.EMAIL,
          appointment_datetime: proposedDate,
        },
      },
    });
    const error = await service
      .createPending(dto, client.id, UserRole.CUSTOMER)
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse().error.details.existing_request).toEqual({
      process_id: 'process-existing',
      appointment_id: 'appointment-existing',
      appointment_status: StatusAgendamento.PENDING,
      scheduling_method: AppointmentSchedulingMethod.EMAIL,
      appointment_datetime: proposedDate,
    });
    expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
      tx.process.findFirst.mock.invocationCallOrder[0],
    );
    expect(appointmentCreate).not.toHaveBeenCalled();
  });

  it.each([
    UserRole.CUSTOMER,
    UserRole.SPECIALIST,
    UserRole.ADMIN,
    UserRole.CONSULTANT,
  ])(
    'rejects the direct PLATFORM bypass for %s before any database access',
    async (role) => {
      const { service, prisma, tx, appointmentCreate } = harness({});
      const error = await service
        .create(dto as any, client.id, role)
        .catch((caught) => caught);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.getResponse()).toEqual({
        success: false,
        error: { code: 403, message: expect.any(String) },
      });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expect(appointmentCreate).not.toHaveBeenCalled();
    },
  );
});

describe('AppointmentsService.findExistingAppointment — own minimal projection', () => {
  const ownedAppointment = {
    id: 'appointment-1',
    client_id: 'client-1',
    specialist_id: 'specialist-1',
    product_type: ProductType.CAR,
    product_id: 'car-1',
    status: StatusAgendamento.PENDING,
    scheduling_method: AppointmentSchedulingMethod.EMAIL,
    appointment_datetime: new Date('2099-01-01T10:00:00.000Z'),
    process: { id: 'process-1', client_id: 'client-1' },
    client: {
      id: 'client-1',
      name: 'Private Client',
      email: 'private@example.com',
    },
    specialist: { id: 'specialist-1', name: 'Specialist' },
    notes: 'private-notes',
    created_at: new Date(),
    updated_at: new Date(),
  };
  function harness(appointment: any) {
    const prisma = {
      appointment: { findFirst: jest.fn().mockResolvedValue(appointment) },
      car: { findUnique: jest.fn().mockResolvedValue({ id: 'car-1' }) },
    } as any;
    return {
      prisma,
      service: new AppointmentsService(prisma, {} as any, {} as any),
    };
  }
  it.each([
    ownedAppointment,
    {
      ...ownedAppointment,
      scheduling_method: null,
      appointment_datetime: null,
    },
  ])(
    'returns only the owned discriminator and supports legacy date/method nulls',
    async (appointment) => {
      const { prisma, service } = harness(appointment);
      expect(
        await service.findExistingAppointment(
          'client-1',
          'specialist-1',
          ProductType.CAR,
          'car-1',
        ),
      ).toEqual({
        exists: true,
        appointment_id: appointment.id,
        process_id: 'process-1',
        appointment_status: appointment.status,
        scheduling_method: appointment.scheduling_method,
        appointment_datetime: appointment.appointment_datetime,
      });
      expect(prisma.appointment.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          client_id: 'client-1',
          specialist_id: 'specialist-1',
          product_type: ProductType.CAR,
          product_id: 'car-1',
          process: {
            is: {
              client_id: 'client-1',
              specialist_id: 'specialist-1',
              product_type: ProductType.CAR,
              car_id: 'car-1',
              status: {
                in: [
                  ProcessStatus.SCHEDULING,
                  ProcessStatus.NEGOTIATION,
                  ProcessStatus.PROCESSING_CONTRACT,
                  ProcessStatus.DOCUMENTATION,
                ],
              },
            },
          },
        }),
        select: {
          id: true,
          client_id: true,
          status: true,
          scheduling_method: true,
          appointment_datetime: true,
          process: { select: { id: true, client_id: true } },
        },
      });
      expect(prisma.car.findUnique).not.toHaveBeenCalled();
    },
  );
  it.each([
    null,
    { ...ownedAppointment, client_id: 'another-client' },
    { ...ownedAppointment, process: null },
    {
      ...ownedAppointment,
      process: { id: 'private-process', client_id: 'another-client' },
    },
  ])(
    'fails closed for missing or unowned appointment/process %o',
    async (appointment) => {
      const { service } = harness(appointment);
      expect(
        await service.findExistingAppointment(
          'client-1',
          'specialist-1',
          ProductType.CAR,
          'car-1',
        ),
      ).toEqual({ exists: false });
    },
  );
});

describe('AppointmentsService.createPending — integridade das partes', () => {
  it('rejeita usuário que não seja CUSTOMER antes de consultar o banco', async () => {
    const prisma = {
      user: { findUnique: jest.fn() },
    } as any;
    const service = new AppointmentsService(prisma, {} as any, {} as any);

    await expect(
      service.createPending(
        {
          client_id: 'specialist-1',
          specialist_id: 'other-specialist-1',
          scheduling_method: AppointmentSchedulingMethod.EMAIL,
        } as CreatePendingAppointmentDto,
        'specialist-1',
        UserRole.SPECIALIST,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejeita horário enviado pelo cliente para Calendly', async () => {
    const prisma = {
      user: { findUnique: jest.fn() },
    } as any;
    const service = new AppointmentsService(prisma, {} as any, {} as any);

    await expect(
      service.createPending(
        {
          client_id: 'client-1',
          specialist_id: 'specialist-1',
          scheduling_method: AppointmentSchedulingMethod.CALENDLY,
          appointment_datetime: '2099-01-01T10:00:00.000Z',
        } as CreatePendingAppointmentDto,
        'client-1',
        UserRole.CUSTOMER,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('não permite que CUSTOMER se informe como especialista', async () => {
    const customer = {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Cliente',
      role: UserRole.CUSTOMER,
      speciality: null,
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(customer) },
      appointment: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback: any) =>
        callback({
          user: { findUnique: jest.fn().mockResolvedValue(customer) },
          car: { findUnique: jest.fn() },
          boat: { findUnique: jest.fn() },
          aircraft: { findUnique: jest.fn() },
        }),
      ),
    } as any;
    const service = new AppointmentsService(prisma, {} as any, {} as any);

    await expect(
      service.createPending(
        {
          client_id: customer.id,
          specialist_id: customer.id,
        } as CreateAppointmentDto,
        customer.id,
        UserRole.CUSTOMER,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it.each([
    [undefined, AppointmentSchedulingMethod.CALENDLY],
    [AppointmentSchedulingMethod.EMAIL, AppointmentSchedulingMethod.EMAIL],
  ])(
    'locks active-process dedup and persists pending source %s as %s',
    async (inputMethod, expectedMethod) => {
      const client = {
        id: 'client-1',
        name: 'Client',
        role: UserRole.CUSTOMER,
      };
      const specialist = {
        id: 'specialist-1',
        name: 'Specialist',
        role: UserRole.SPECIALIST,
        speciality: ProductType.CAR,
        calendly_url: 'https://calendly.com/specialist/meeting',
        calendly_connection: { is_active: true },
      };
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
        user: { findUnique: jest.fn().mockResolvedValue(specialist) },
        car: { findUnique: jest.fn() },
        boat: { findUnique: jest.fn() },
        aircraft: { findUnique: jest.fn() },
        appointment: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockRejectedValue(new Error('stop after checks')),
        },
        process: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      const prisma = {
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(client)
            .mockResolvedValueOnce(specialist),
        },
        appointment: { findFirst: jest.fn().mockResolvedValue(null) },
        $transaction: jest.fn(async (callback: any) => callback(tx)),
      } as any;
      const service = new AppointmentsService(prisma, {} as any, {} as any);

      await expect(
        service.createPending(
          {
            client_id: client.id,
            specialist_id: specialist.id,
            scheduling_method: inputMethod,
          } as CreatePendingAppointmentDto,
          client.id,
          UserRole.CUSTOMER,
        ),
      ).rejects.toThrow('stop after checks');

      expect(tx.$queryRaw).toHaveBeenCalledWith(
        expect.anything(),
        'process-dedup:client-1:specialist-1:CONSULTANCY:none',
      );
      expect(tx.process.findFirst).toHaveBeenCalledTimes(1);
      expect(tx.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scheduling_method: expectedMethod,
          }),
        }),
      );
    },
  );
});

describe('AppointmentsService.updateStatus — snapshot da negociação', () => {
  it.each([ProcessStatus.NEGOTIATION, ProcessStatus.DOCUMENTATION])(
    'rejeita cancelamento quando o Process já avançou para %s antes de iniciar a transação',
    async (processStatus) => {
      const appointment = {
        id: 'appointment-1',
        client_id: 'client-1',
        specialist_id: 'specialist-1',
        status: StatusAgendamento.SCHEDULED,
        appointment_datetime: new Date('2099-01-01T10:00:00.000Z'),
        process: { id: 'process-1', status: processStatus },
      };
      const prisma = {
        appointment: { findUnique: jest.fn().mockResolvedValue(appointment) },
        $transaction: jest.fn(),
      } as any;
      const service = new AppointmentsService(prisma, {} as any, {} as any);

      await expect(
        service.updateStatus(
          appointment.id,
          { status: StatusAgendamento.CANCELLED },
          appointment.client_id,
          UserRole.CUSTOMER,
        ),
      ).rejects.toThrow(
        'Não é possível cancelar uma reunião cujo processo já avançou',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each([StatusAgendamento.PENDING, StatusAgendamento.SCHEDULED])(
    'cancela %s e remove o Process SCHEDULING na mesma transação',
    async (currentStatus) => {
      const client = {
        id: 'client-1',
        name: 'Cliente',
        surname: 'Teste',
        email: 'cliente@example.com',
      };
      const specialist = {
        id: 'specialist-1',
        name: 'Especialista',
        surname: 'Teste',
        email: 'especialista@example.com',
        speciality: ProductType.CAR,
      };
      const process = {
        id: 'process-1',
        status: ProcessStatus.SCHEDULING,
      };
      const appointment = {
        id: 'appointment-1',
        client_id: client.id,
        specialist_id: specialist.id,
        product_type: null,
        product_id: null,
        status: currentStatus,
        notes: null,
        appointment_datetime:
          currentStatus === StatusAgendamento.SCHEDULED
            ? new Date('2099-01-01T10:00:00.000Z')
            : null,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        updated_at: new Date('2026-01-01T00:00:00.000Z'),
        client,
        specialist,
        process,
      };
      const updatedAppointment = {
        ...appointment,
        status: StatusAgendamento.CANCELLED,
        process: null,
      };
      const deleteHistory = jest.fn().mockResolvedValue({ count: 1 });
      const deleteProcess = jest.fn().mockResolvedValue({ count: 1 });
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
        appointment: {
          findUnique: jest.fn().mockResolvedValue(appointment),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(updatedAppointment),
        },
        process: { deleteMany: deleteProcess },
        processStatusHistory: { deleteMany: deleteHistory },
      };
      const prisma = {
        appointment: { findUnique: jest.fn().mockResolvedValue(appointment) },
        $transaction: jest.fn(async (callback) => callback(tx)),
      } as any;
      const service = new AppointmentsService(prisma, {} as any, {} as any);

      const result = await service.updateStatus(
        appointment.id,
        { status: StatusAgendamento.CANCELLED },
        appointment.client_id,
        UserRole.CUSTOMER,
      );

      expect(tx.appointment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: appointment.id,
            status: currentStatus,
            updated_at: appointment.updated_at,
          }),
          data: expect.objectContaining({
            status: StatusAgendamento.CANCELLED,
          }),
        }),
      );
      expect(deleteHistory).toHaveBeenCalledWith({
        where: { processId: process.id },
      });
      expect(deleteProcess).toHaveBeenCalledWith({
        where: {
          id: process.id,
          status: ProcessStatus.SCHEDULING,
        },
      });
      expect(deleteHistory.mock.invocationCallOrder[0]).toBeLessThan(
        deleteProcess.mock.invocationCallOrder[0],
      );
      expect(result.status).toBe(StatusAgendamento.CANCELLED);
    },
  );

  it('rejeita a transição quando perde a reivindicação concorrente do appointment', async () => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      product_type: null,
      product_id: null,
      status: StatusAgendamento.SCHEDULED,
      appointment_datetime: new Date('2099-01-01T10:00:00.000Z'),
      notes: null,
      updated_at: new Date('2099-01-01T00:00:00.000Z'),
      client: { id: 'client-1' },
      specialist: { id: 'specialist-1' },
      process: null,
    };
    const appointmentUpdate = jest.fn().mockResolvedValue({
      ...appointment,
      status: StatusAgendamento.COMPLETED,
    });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        update: appointmentUpdate,
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      appointment: { findUnique: jest.fn().mockResolvedValue(appointment) },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as any;
    const service = new AppointmentsService(prisma, {} as any, {} as any);

    await expect(
      service.updateStatus(
        appointment.id,
        { status: StatusAgendamento.COMPLETED },
        appointment.specialist_id,
        UserRole.SPECIALIST,
      ),
    ).rejects.toThrow(ConflictException);
    expect(tx.appointment.updateMany).toHaveBeenCalledTimes(1);
    expect(appointmentUpdate).not.toHaveBeenCalled();
  });

  it('impede o cliente de concluir o agendamento e avançar a negociação', async () => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      status: StatusAgendamento.SCHEDULED,
      appointment_datetime: new Date('2099-01-01T10:00:00.000Z'),
      process: { id: 'process-1', status: ProcessStatus.SCHEDULING },
    };
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
      },
      $transaction: jest.fn(),
    } as any;
    const service = new AppointmentsService(prisma, {} as any, {} as any);

    await expect(
      service.updateStatus(
        appointment.id,
        { status: StatusAgendamento.COMPLETED },
        appointment.client_id,
        UserRole.CUSTOMER,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('impede que a rota genérica confirme ou reabra um agendamento', async () => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      status: StatusAgendamento.PENDING,
      appointment_datetime: null,
      process: { id: 'process-1', status: ProcessStatus.SCHEDULING },
    };
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
      },
      $transaction: jest.fn(),
    } as any;
    const service = new AppointmentsService(prisma, {} as any, {} as any);

    await expect(
      service.updateStatus(
        appointment.id,
        { status: StatusAgendamento.SCHEDULED },
        appointment.specialist_id,
        UserRole.SPECIALIST,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('grava appointment, snapshot USD, status e histórico na mesma transação', async () => {
    const product = {
      id: 'product-1',
      marca: 'Porsche',
      modelo: '911',
      valor: new Prisma.Decimal('120000.00'),
      currency: ProductCurrency.USD,
    };
    const client = {
      id: 'client-1',
      name: 'Cliente',
      surname: 'Teste',
      email: 'cliente@example.com',
    };
    const specialist = {
      id: 'specialist-1',
      name: 'Especialista',
      surname: 'Teste',
      email: 'especialista@example.com',
      speciality: ProductType.CAR,
    };
    const process = {
      id: 'process-1',
      status: ProcessStatus.SCHEDULING,
      notes: null,
      product_type: ProductType.CAR,
      car_id: 'product-1',
      boat_id: null,
      aircraft_id: null,
      negotiation_currency: null,
      negotiation_product_value: null,
      car: product,
      boat: null,
      aircraft: null,
    };
    const appointment = {
      id: 'appointment-1',
      client_id: client.id,
      specialist_id: specialist.id,
      product_type: ProductType.CAR,
      product_id: product.id,
      status: StatusAgendamento.SCHEDULED,
      notes: null,
      appointment_datetime: new Date('2026-01-01T10:00:00.000Z'),
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
      client,
      specialist,
      process,
    };
    const appointmentUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const updatedAppointment = {
      ...appointment,
      status: StatusAgendamento.COMPLETED,
    };
    const processUpdate = jest.fn().mockResolvedValue({});
    const processUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const rootAppointmentUpdate = jest.fn();
    const rootProcessUpdate = jest.fn();
    const historyCreate = jest.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        updateMany: appointmentUpdateMany,
        findUniqueOrThrow: jest.fn().mockResolvedValue(updatedAppointment),
      },
      process: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(process),
        update: processUpdate,
        updateMany: processUpdateMany,
      },
      processStatusHistory: { create: historyCreate },
    };
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        update: rootAppointmentUpdate,
      },
      process: { update: rootProcessUpdate },
      processStatusHistory: { create: jest.fn() },
      car: { findUnique: jest.fn().mockResolvedValue(product) },
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as any;
    const service = new AppointmentsService(prisma, {} as any, {} as any);

    await service.updateStatus(
      'appointment-1',
      { status: StatusAgendamento.COMPLETED },
      specialist.id,
      UserRole.SPECIALIST,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw.mock.calls[0][1]).toBe(
      'appointment-schedule:specialist-1',
    );
    expect(tx.$queryRaw.mock.calls[1][1]).toBe('product-money:CAR:product-1');
    expect(appointmentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: appointment.id,
          status: StatusAgendamento.SCHEDULED,
          updated_at: appointment.updated_at,
        }),
        data: expect.objectContaining({ status: StatusAgendamento.COMPLETED }),
      }),
    );
    expect(rootAppointmentUpdate).not.toHaveBeenCalled();
    expect(rootProcessUpdate).not.toHaveBeenCalled();
    expect(processUpdate).not.toHaveBeenCalled();
    expect(processUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'process-1',
          status: ProcessStatus.SCHEDULING,
        },
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
          processId: 'process-1',
          status: ProcessStatus.NEGOTIATION,
        }),
      }),
    );
    expect(processUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
      historyCreate.mock.invocationCallOrder[0],
    );
  });

  it.each([
    [ProcessStatus.PROCESSING_CONTRACT, false],
    [ProcessStatus.SCHEDULING, true],
  ])(
    'não cria histórico concorrente com estado transacional %s',
    async (transactionalStatus, expectsClaim) => {
      const product = {
        id: 'product-1',
        specialist_id: 'specialist-1',
        is_active: true,
        marca: 'Porsche',
        modelo: '911',
        valor: new Prisma.Decimal('120000.00'),
        currency: ProductCurrency.USD,
      };
      const client = {
        id: 'client-1',
        name: 'Cliente',
        surname: 'Teste',
        email: 'cliente@example.com',
      };
      const specialist = {
        id: 'specialist-1',
        name: 'Especialista',
        surname: 'Teste',
        email: 'especialista@example.com',
        role: UserRole.SPECIALIST,
        speciality: ProductType.CAR,
      };
      const process = {
        id: 'process-1',
        status: ProcessStatus.SCHEDULING,
        notes: null,
        product_type: ProductType.CAR,
        car_id: product.id,
        boat_id: null,
        aircraft_id: null,
        negotiation_currency: null,
        negotiation_product_value: null,
        car: product,
        boat: null,
        aircraft: null,
      };
      const appointment = {
        id: 'appointment-1',
        client_id: client.id,
        specialist_id: specialist.id,
        product_type: ProductType.CAR,
        product_id: product.id,
        status: StatusAgendamento.SCHEDULED,
        notes: null,
        appointment_datetime: new Date('2026-01-01T10:00:00.000Z'),
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        updated_at: new Date('2026-01-01T00:00:00.000Z'),
        client,
        specialist,
        process,
      };
      const appointmentUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const updatedAppointment = {
        ...appointment,
        status: StatusAgendamento.COMPLETED,
      };
      const processUpdate = jest.fn().mockResolvedValue({});
      const processUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const historyCreate = jest.fn().mockResolvedValue({});
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
        appointment: {
          findUnique: jest.fn().mockResolvedValue(appointment),
          updateMany: appointmentUpdateMany,
          findUniqueOrThrow: jest.fn().mockResolvedValue(updatedAppointment),
        },
        process: {
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValue({ ...process, status: transactionalStatus }),
          update: processUpdate,
          updateMany: processUpdateMany,
        },
        processStatusHistory: { create: historyCreate },
      };
      const prisma = {
        appointment: { findUnique: jest.fn().mockResolvedValue(appointment) },
        car: { findUnique: jest.fn().mockResolvedValue(product) },
        $transaction: jest.fn(async (callback) => callback(tx)),
      } as any;
      const service = new AppointmentsService(prisma, {} as any, {} as any);

      await service.updateStatus(
        appointment.id,
        { status: StatusAgendamento.COMPLETED },
        specialist.id,
        UserRole.SPECIALIST,
      );

      expect(processUpdate).not.toHaveBeenCalled();
      if (expectsClaim) {
        expect(processUpdateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'process-1', status: ProcessStatus.SCHEDULING },
          }),
        );
      } else {
        expect(processUpdateMany).not.toHaveBeenCalled();
      }
      expect(historyCreate).not.toHaveBeenCalled();
    },
  );
});

describe('AppointmentsService.confirmPending — snapshot da negociação', () => {
  let immediateSpy: jest.SpyInstance;

  beforeEach(() => {
    immediateSpy = jest.spyOn(global, 'setImmediate').mockImplementation(((
      callback: (...args: any[]) => void,
    ) => {
      callback();
      return {} as NodeJS.Immediate;
    }) as typeof setImmediate);
  });

  afterEach(() => {
    immediateSpy.mockRestore();
  });

  it('rejeita data passada antes de iniciar a transação', async () => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      status: StatusAgendamento.PENDING,
      scheduling_method: AppointmentSchedulingMethod.CALENDLY,
      appointment_datetime: null,
      process: null,
    };
    const prisma = {
      appointment: { findUnique: jest.fn().mockResolvedValue(appointment) },
      $transaction: jest.fn(),
    } as any;
    const service = new AppointmentsService(prisma, {} as any, {} as any);

    await expect(
      service.confirmPending(
        appointment.id,
        appointment.specialist_id,
        new Date('2000-01-01T10:00:00.000Z'),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('direciona solicitações EMAIL para a confirmação do processo', async () => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      status: StatusAgendamento.PENDING,
      scheduling_method: AppointmentSchedulingMethod.EMAIL,
      appointment_datetime: null,
      process: { id: 'process-1' },
    };
    const prisma = {
      appointment: { findUnique: jest.fn().mockResolvedValue(appointment) },
      $transaction: jest.fn(),
    } as any;
    const service = new AppointmentsService(prisma, {} as any, {} as any);

    await expect(
      service.confirmPending(appointment.id, appointment.specialist_id),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    [false, ProductCurrency.BRL],
    [false, ProductCurrency.USD],
    [true, ProductCurrency.BRL],
    [true, ProductCurrency.USD],
  ])(
    'snapshots a %s process using %s money in the same claim',
    async (hasExistingProcess, currency) => {
      const product = {
        id: 'product-1',
        specialist_id: 'specialist-1',
        is_active: true,
        marca: 'Porsche',
        modelo: '911',
        valor: new Prisma.Decimal('120000.00'),
        currency,
      };
      const client = {
        id: 'client-1',
        name: 'Cliente',
        surname: 'Teste',
        email: 'cliente@example.com',
      };
      const specialist = {
        id: 'specialist-1',
        name: 'Especialista',
        surname: 'Teste',
        email: 'especialista@example.com',
        role: UserRole.SPECIALIST,
        speciality: ProductType.CAR,
      };
      const schedulingProcess = {
        id: 'process-1',
        client_id: client.id,
        specialist_id: specialist.id,
        status: ProcessStatus.SCHEDULING,
        notes: 'Processo',
        product_type: ProductType.CAR,
        car_id: product.id,
        boat_id: null,
        aircraft_id: null,
        negotiation_currency: null,
        negotiation_product_value: null,
        updated_at: new Date('2026-01-01T00:00:00.000Z'),
        car: product,
        boat: null,
        aircraft: null,
      };
      const appointment = {
        id: 'appointment-1',
        client_id: client.id,
        specialist_id: specialist.id,
        product_type: ProductType.CAR,
        product_id: product.id,
        status: StatusAgendamento.PENDING,
        notes: null,
        appointment_datetime: new Date('2099-01-01T10:00:00.000Z'),
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        updated_at: new Date('2026-01-01T00:00:00.000Z'),
        client,
        specialist,
        process: hasExistingProcess ? schedulingProcess : null,
      };
      const processCreate = jest.fn().mockResolvedValue(schedulingProcess);
      const processUpdate = jest.fn().mockResolvedValue({
        ...schedulingProcess,
        status: ProcessStatus.NEGOTIATION,
      });
      const processUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const processFindUniqueOrThrow = jest
        .fn()
        .mockResolvedValueOnce(schedulingProcess)
        .mockResolvedValue({
          ...schedulingProcess,
          status: ProcessStatus.NEGOTIATION,
          negotiation_currency: currency,
          negotiation_product_value: product.valor,
        });
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
        user: { findUnique: jest.fn().mockResolvedValue(specialist) },
        car: { findUnique: jest.fn().mockResolvedValue(product) },
        boat: { findUnique: jest.fn() },
        aircraft: { findUnique: jest.fn() },
        appointment: {
          findUnique: jest.fn().mockResolvedValue(appointment),
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn().mockResolvedValue({
            ...appointment,
            status: StatusAgendamento.SCHEDULED,
          }),
        },
        process: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: processCreate,
          update: processUpdate,
          updateMany: processUpdateMany,
          findUniqueOrThrow: processFindUniqueOrThrow,
        },
        processStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      };
      const prisma = {
        appointment: { findUnique: jest.fn().mockResolvedValue(appointment) },
        car: { findUnique: jest.fn().mockResolvedValue(product) },
        $transaction: jest.fn(async (callback) => callback(tx)),
      } as any;
      const notifications = {
        sendAppointmentConfirmedEmail: jest.fn().mockResolvedValue(undefined),
      } as any;
      const service = new AppointmentsService(prisma, notifications, {} as any);

      await service.confirmPending(appointment.id, specialist.id);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.$queryRaw).toHaveBeenCalledTimes(4);
      expect(tx.$queryRaw.mock.calls[0][1]).toBe('product-money:CAR:product-1');
      expect(tx.$queryRaw.mock.calls[1][1]).toBe(
        'process-dedup:client-1:specialist-1:CAR:product-1',
      );
      expect(tx.$queryRaw.mock.calls[2][1]).toBe(
        'appointment-schedule:specialist-1',
      );
      expect(tx.$queryRaw.mock.calls[3][1]).toBe('product-money:CAR:product-1');
      expect(processUpdateMany).toHaveBeenCalledWith({
        where: {
          id: schedulingProcess.id,
          status: ProcessStatus.SCHEDULING,
          updated_at: schedulingProcess.updated_at,
        },
        data: expect.objectContaining({
          status: ProcessStatus.NEGOTIATION,
          negotiation_currency: currency,
          negotiation_product_value: product.valor,
        }),
      });
      expect(processUpdate).not.toHaveBeenCalled();
      expect(processUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
        tx.processStatusHistory.create.mock.invocationCallOrder.at(-1)!,
      );
      expect(processCreate).toHaveBeenCalledTimes(hasExistingProcess ? 0 : 1);
    },
  );
});

describe('AppointmentsService.registerCalendlyScheduled — schedule lock', () => {
  it('rejeita e não persiste URIs Calendly não confiáveis mesmo com horário informado', async () => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      status: StatusAgendamento.PENDING,
      scheduling_method: AppointmentSchedulingMethod.CALENDLY,
      specialist_rescheduled_at: null,
    };
    const prisma = {
      appointment: { findUnique: jest.fn().mockResolvedValue(appointment) },
      $transaction: jest.fn(),
    } as any;
    const calendlyIntegrationService = {
      resolveScheduledStartTime: jest.fn(),
    } as any;
    const service = new AppointmentsService(
      prisma,
      {} as any,
      calendlyIntegrationService,
    );

    await expect(
      service.registerCalendlyScheduled(appointment.id, appointment.client_id, {
        event_uri: 'https://evil.test/scheduled_events/event-1',
        invitee_uri:
          'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1',
        scheduled_start_time: '2099-01-01T10:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(
      calendlyIntegrationService.resolveScheduledStartTime,
    ).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejeita evento e convidado que não pertencem ao mesmo agendamento', async () => {
    const prisma = {
      appointment: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    } as any;
    const service = new AppointmentsService(prisma, {} as any, {} as any);

    await expect(
      service.registerCalendlyScheduled('appointment-1', 'client-1', {
        event_uri: 'https://api.calendly.com/scheduled_events/event-1',
        invitee_uri:
          'https://api.calendly.com/scheduled_events/event-2/invitees/invitee-1',
        scheduled_start_time: '2099-01-01T10:00:00.000Z',
      }),
    ).rejects.toThrow('URIs do Calendly pertencem a eventos diferentes');
    expect(prisma.appointment.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    AppointmentSchedulingMethod.EMAIL,
    AppointmentSchedulingMethod.PLATFORM,
  ])('rejeita sincronização Calendly para origem %s', async (method) => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      status: StatusAgendamento.PENDING,
      scheduling_method: method,
      specialist_rescheduled_at: null,
    };
    const prisma = {
      appointment: { findUnique: jest.fn().mockResolvedValue(appointment) },
      $transaction: jest.fn(),
    } as any;
    const service = new AppointmentsService(prisma, {} as any, {} as any);

    await expect(
      service.registerCalendlyScheduled(appointment.id, appointment.client_id, {
        event_uri: 'https://api.calendly.com/scheduled_events/event-1',
        invitee_uri:
          'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1',
        scheduled_start_time: '2099-01-01T10:00:00.000Z',
      } as any),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.appointment.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('considera idempotente a mesma URI oficial após canonicalização', async () => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      status: StatusAgendamento.SCHEDULED,
      scheduling_method: AppointmentSchedulingMethod.CALENDLY,
      specialist_rescheduled_at: null,
      calendly_event_uri:
        'https://calendly.com/api/v2/scheduled_events/event-1',
      calendly_invitee_uri: null,
      calendly_sync_status: 'SYNCED',
      appointment_datetime: new Date('2099-01-01T10:00:00.000Z'),
    };
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(),
    } as any;
    const calendlyIntegrationService = {
      resolveScheduledStartTime: jest.fn(),
    } as any;
    const service = new AppointmentsService(
      prisma,
      {} as any,
      calendlyIntegrationService,
    );

    await expect(
      service.registerCalendlyScheduled(appointment.id, appointment.client_id, {
        event_uri: 'https://api.calendly.com/scheduled_events/event-1',
        invitee_uri:
          'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1',
      }),
    ).resolves.toEqual({
      appointment_id: appointment.id,
      calendly_sync_status: appointment.calendly_sync_status,
      appointment_datetime: appointment.appointment_datetime,
    });
    expect(
      calendlyIntegrationService.resolveScheduledStartTime,
    ).not.toHaveBeenCalled();
    expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
      where: {
        id: appointment.id,
        calendly_event_uri: appointment.calendly_event_uri,
        calendly_invitee_uri: null,
      },
      data: {
        calendly_event_uri:
          'https://api.calendly.com/scheduled_events/event-1',
        calendly_invitee_uri:
          'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1',
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejeita o mesmo evento quando já está associado a outro convidado', async () => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      status: StatusAgendamento.SCHEDULED,
      scheduling_method: AppointmentSchedulingMethod.CALENDLY,
      specialist_rescheduled_at: null,
      calendly_event_uri:
        'https://calendly.com/api/v2/scheduled_events/event-1',
      calendly_invitee_uri:
        'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-old',
    };
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;
    const calendlyIntegrationService = {
      resolveScheduledStartTime: jest.fn(),
    } as any;
    const service = new AppointmentsService(
      prisma,
      {} as any,
      calendlyIntegrationService,
    );

    await expect(
      service.registerCalendlyScheduled(appointment.id, appointment.client_id, {
        event_uri: 'https://api.calendly.com/scheduled_events/event-1',
        invitee_uri:
          'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-new',
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
    expect(
      calendlyIntegrationService.resolveScheduledStartTime,
    ).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('revalida sob lock e rejeita outro convidado gravado concorrentemente', async () => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      status: StatusAgendamento.SCHEDULED,
      scheduling_method: AppointmentSchedulingMethod.CALENDLY,
      specialist_rescheduled_at: null,
      calendly_event_uri: null,
      calendly_invitee_uri: null,
    };
    const lockedAppointment = {
      ...appointment,
      calendly_event_uri:
        'https://api.calendly.com/scheduled_events/event-1',
      calendly_invitee_uri:
        'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-old',
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      appointment: {
        findUnique: jest.fn().mockResolvedValue(lockedAppointment),
        update: jest.fn(),
      },
    };
    const prisma = {
      appointment: { findUnique: jest.fn().mockResolvedValue(appointment) },
      $transaction: jest.fn(async (callback: (client: any) => unknown) =>
        callback(tx),
      ),
    } as any;
    const calendlyIntegrationService = {
      resolveScheduledStartTime: jest.fn(),
    } as any;
    const service = new AppointmentsService(
      prisma,
      {} as any,
      calendlyIntegrationService,
    );

    await expect(
      service.registerCalendlyScheduled(appointment.id, appointment.client_id, {
        event_uri: 'https://api.calendly.com/scheduled_events/event-1',
        invitee_uri:
          'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-new',
        scheduled_start_time: '2099-01-01T10:00:00.000Z',
      }),
    ).rejects.toThrow(ConflictException);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.appointment.update).not.toHaveBeenCalled();
  });

  it('não ignora falha de integridade detectada na resposta do Calendly', async () => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      status: StatusAgendamento.PENDING,
      scheduling_method: AppointmentSchedulingMethod.CALENDLY,
      specialist_rescheduled_at: null,
      calendly_event_uri: null,
    };
    const prisma = {
      appointment: { findUnique: jest.fn().mockResolvedValue(appointment) },
      $transaction: jest.fn(),
    } as any;
    const integrityError = new BadRequestException(
      'URIs do Calendly pertencem a eventos diferentes',
    );
    const calendlyIntegrationService = {
      resolveScheduledStartTime: jest.fn().mockRejectedValue(integrityError),
    } as any;
    const service = new AppointmentsService(
      prisma,
      {} as any,
      calendlyIntegrationService,
    );

    await expect(
      service.registerCalendlyScheduled(appointment.id, appointment.client_id, {
        event_uri: 'https://api.calendly.com/scheduled_events/event-1',
        invitee_uri:
          'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1',
      }),
    ).rejects.toBe(integrityError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('não permite que o Calendly sobrescreva a alteração definitiva', async () => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      status: StatusAgendamento.SCHEDULED,
      scheduling_method: AppointmentSchedulingMethod.CALENDLY,
      specialist_rescheduled_at: new Date('2026-01-01T00:00:00.000Z'),
    };
    const prisma = {
      appointment: { findUnique: jest.fn().mockResolvedValue(appointment) },
      $transaction: jest.fn(),
    } as any;
    const service = new AppointmentsService(prisma, {} as any, {} as any);

    await expect(
      service.registerCalendlyScheduled(appointment.id, appointment.client_id, {
        event_uri: 'https://api.calendly.com/scheduled_events/event-2',
        invitee_uri:
          'https://api.calendly.com/scheduled_events/event-2/invitees/invitee-2',
        scheduled_start_time: '2099-01-02T10:00:00.000Z',
      } as any),
    ).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('normalizes, serializes and rechecks the resolved time in the write transaction', async () => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      status: StatusAgendamento.PENDING,
      calendly_event_uri: null,
      calendly_sync_status: 'PENDING',
      appointment_datetime: null,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({
          ...appointment,
          calendly_sync_status: 'SYNCED',
          appointment_datetime: new Date('2099-01-01T10:00:00.000Z'),
        }),
      },
    };
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as any;
    const service = new AppointmentsService(prisma, {} as any, {} as any);

    await service.registerCalendlyScheduled(
      appointment.id,
      appointment.client_id,
      {
        event_uri:
          'https://calendly.com/api/v2/scheduled_events/event-1',
        invitee_uri:
          'https://api.calendly.com/api/v2/scheduled_events/event-1/invitees/invitee-1',
        scheduled_start_time: '2099-01-01T10:00:00.000Z',
      } as any,
    );

    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      'appointment-schedule:specialist-1',
    );
    expect(tx.appointment.findFirst).toHaveBeenCalled();
    expect(prisma.appointment.update).not.toHaveBeenCalled();
    expect(tx.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          calendly_event_uri:
            'https://api.calendly.com/scheduled_events/event-1',
          calendly_invitee_uri:
            'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1',
        }),
      }),
    );
  });

  it('rejects a reschedule that overlaps an already SCHEDULED appointment', async () => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      status: StatusAgendamento.SCHEDULED,
      appointment_datetime: null,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        findFirst: jest.fn().mockResolvedValue({
          id: 'scheduled-appointment',
          client_id: 'another-client',
          status: StatusAgendamento.SCHEDULED,
          appointment_datetime: new Date('2099-01-01T10:00:00.000Z'),
        }),
        update: jest.fn(),
      },
    };
    const prisma = {
      appointment: { findUnique: jest.fn().mockResolvedValue(appointment) },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as any;
    const service = new AppointmentsService(prisma, {} as any, {} as any);

    await expect(
      service.registerCalendlyScheduled(appointment.id, appointment.client_id, {
        event_uri: 'https://api.calendly.com/scheduled_events/event-1',
        invitee_uri:
          'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1',
        scheduled_start_time: '2099-01-01T10:00:00.000Z',
      } as any),
    ).rejects.toThrow(ConflictException);
    expect(tx.appointment.update).not.toHaveBeenCalled();
  });
});

describe('AppointmentsService.reschedule — alteração definitiva', () => {
  const oldDate = new Date('2099-01-01T10:00:00.000Z');
  const newDateIso = '2099-01-02T13:00:00.000Z';

  function makeService(options?: {
    appointment?: Record<string, unknown>;
    conflict?: Record<string, unknown> | null;
    claimCount?: number;
  }) {
    const client = {
      id: 'client-1',
      name: 'Client',
      surname: 'Example',
      email: 'client@example.com',
    };
    const specialist = {
      id: 'specialist-1',
      name: 'Specialist',
      surname: 'Example',
      email: 'specialist@example.com',
      role: UserRole.SPECIALIST,
      speciality: ProductType.CAR,
      calendly_url: null,
    };
    const product = {
      id: 'product-1',
      marca: 'Porsche',
      modelo: '911',
      valor: new Prisma.Decimal('100000'),
      currency: ProductCurrency.BRL,
    };
    let current = {
      id: 'appointment-1',
      client_id: client.id,
      specialist_id: specialist.id,
      product_type: ProductType.CAR,
      product_id: product.id,
      status: StatusAgendamento.SCHEDULED,
      appointment_datetime: oldDate,
      scheduling_method: AppointmentSchedulingMethod.PLATFORM,
      specialist_rescheduled_at: null,
      specialist_rescheduled_from: null,
      notes: null,
      created_at: new Date('2098-01-01T00:00:00.000Z'),
      updated_at: new Date('2098-01-01T00:00:00.000Z'),
      client,
      specialist,
      process: { id: 'process-1' },
      ...options?.appointment,
    };
    const updateMany = jest.fn(async ({ data }) => {
      if ((options?.claimCount ?? 1) === 1) current = { ...current, ...data };
      return { count: options?.claimCount ?? 1 };
    });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      appointment: {
        findUnique: jest.fn(async () => current),
        findUniqueOrThrow: jest.fn(async () => current),
        findFirst: jest.fn().mockResolvedValue(options?.conflict ?? null),
        updateMany,
      },
    };
    const prisma = {
      appointment: { findUnique: jest.fn().mockResolvedValue(current) },
      car: { findUnique: jest.fn().mockResolvedValue(product) },
      boat: { findUnique: jest.fn() },
      aircraft: { findUnique: jest.fn() },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as any;
    const notifications = {
      sendAppointmentRescheduledEmail: jest.fn().mockResolvedValue(undefined),
    } as any;
    return {
      service: new AppointmentsService(prisma, notifications, {} as any),
      prisma,
      tx,
      updateMany,
    };
  }

  it('stores old and new datetimes and consumes the single change', async () => {
    const { service, tx, updateMany } = makeService();

    await (service as any).reschedule(
      'appointment-1',
      newDateIso,
      'specialist-1',
    );

    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      'appointment-schedule:specialist-1',
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'appointment-1',
        status: StatusAgendamento.SCHEDULED,
        specialist_rescheduled_at: null,
      },
      data: {
        appointment_datetime: new Date(newDateIso),
        specialist_rescheduled_from: oldDate,
        specialist_rescheduled_at: expect.any(Date),
      },
    });
  });

  it('rejects a second specialist change', async () => {
    const { service, updateMany } = makeService({
      appointment: { specialist_rescheduled_at: new Date() },
    });

    await expect(
      (service as any).reschedule('appointment-1', newDateIso, 'specialist-1'),
    ).rejects.toThrow(ConflictException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects anyone other than the responsible specialist', async () => {
    const { service, updateMany } = makeService();

    await expect(
      (service as any).reschedule('appointment-1', newDateIso, 'client-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects past and conflicting datetimes', async () => {
    const past = makeService();
    await expect(
      (past.service as any).reschedule(
        'appointment-1',
        '2020-01-01T10:00:00.000Z',
        'specialist-1',
      ),
    ).rejects.toThrow(BadRequestException);

    const conflict = makeService({
      conflict: {
        id: 'appointment-2',
        client_id: 'client-2',
        appointment_datetime: new Date(newDateIso),
      },
    });
    await expect(
      (conflict.service as any).reschedule(
        'appointment-1',
        newDateIso,
        'specialist-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a concurrent request that loses the conditional update', async () => {
    const { service } = makeService({ claimCount: 0 });

    await expect(
      (service as any).reschedule('appointment-1', newDateIso, 'specialist-1'),
    ).rejects.toMatchObject({
      response: {
        error: { code: 'APPOINTMENT_RESCHEDULE_ALREADY_USED' },
      },
    });
  });
});

describe('AppointmentsService — sugestões compartilham ocupação da agenda', () => {
  const requested = new Date('2099-01-01T10:00:00Z');
  it.each([
    [
      StatusAgendamento.PENDING,
      AppointmentSchedulingMethod.EMAIL,
      'PENDING',
      11,
    ],
    [
      StatusAgendamento.PENDING,
      AppointmentSchedulingMethod.CALENDLY,
      'PENDING',
      11,
    ],
    [
      StatusAgendamento.PENDING,
      AppointmentSchedulingMethod.CALENDLY,
      'SYNCED',
      13,
    ],
    [StatusAgendamento.PENDING, null, 'PENDING', 13],
    [
      StatusAgendamento.SCHEDULED,
      AppointmentSchedulingMethod.EMAIL,
      'PENDING',
      13,
    ],
  ])(
    'suggestions respect %s/%s/%s including the one-hour boundary',
    async (status, method, sync, firstHour) => {
      const record: Record<string, any> = {
        specialist_id: 'specialist-1',
        status,
        scheduling_method: method,
        calendly_sync_status: sync,
        appointment_datetime: new Date('2099-01-01T11:00:00Z'),
      };
      const findFirst = jest.fn(async ({ where }) => {
        const branches = where.OR ?? [{ status: where.status }];
        const occupied = branches.some((branch: any) =>
          Object.entries(branch).every(([key, value]) => record[key] === value),
        );
        const inWindow =
          record.appointment_datetime >= where.appointment_datetime.gte &&
          record.appointment_datetime <= where.appointment_datetime.lte;
        return occupied && inWindow ? { id: 'occupied' } : null;
      });
      const service = new AppointmentsService(
        { appointment: { findFirst } } as any,
        {} as any,
        {} as any,
      );
      expect(
        await (service as any).suggestAlternativeTimes(
          'specialist-1',
          requested,
        ),
      ).toEqual(
        [0, 1, 2].map(
          (offset) => `2099-01-01T${Number(firstHour) + offset}:00:00.000Z`,
        ),
      );
      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true },
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    },
  );
});

describe('AppointmentsService.cancelPending — serialização canônica', () => {
  it('adquire o lock da agenda e revalida appointment/process dentro da transação', async () => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      status: StatusAgendamento.PENDING,
      appointment_datetime: new Date('2099-01-01T10:00:00.000Z'),
      client: {
        id: 'client-1',
        name: 'Cliente',
        surname: 'Teste',
        email: 'cliente@example.com',
      },
      specialist: {
        id: 'specialist-1',
        name: 'Especialista',
        surname: 'Teste',
        email: 'especialista@example.com',
      },
      process: {
        id: 'process-1',
        status: ProcessStatus.SCHEDULING,
        updated_at: new Date('2026-01-01T00:00:00.000Z'),
      },
    };
    const historyDelete = jest.fn().mockResolvedValue({ count: 1 });
    const processClaim = jest.fn().mockResolvedValue({ count: 1 });
    const processDelete = jest.fn().mockResolvedValue(appointment.process);
    const appointmentDelete = jest.fn().mockResolvedValue(appointment);
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        delete: appointmentDelete,
      },
      process: { updateMany: processClaim, delete: processDelete },
      processStatusHistory: { deleteMany: historyDelete },
    };
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
      },
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as any;
    const notifications = {
      sendAppointmentCancelledEmail: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AppointmentsService(
      prisma,
      notifications as any,
      {} as any,
    );

    await service.cancelPending(appointment.id, appointment.client_id);

    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      'appointment-schedule:specialist-1',
    );
    expect(tx.appointment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: appointment.id } }),
    );
    expect(historyDelete).toHaveBeenCalledWith({
      where: { processId: appointment.process.id },
    });
    expect(processClaim).toHaveBeenCalledWith({
      where: {
        id: appointment.process.id,
        status: ProcessStatus.SCHEDULING,
        updated_at: appointment.process.updated_at,
      },
      data: { updated_at: expect.any(Date) },
    });
    expect(processClaim.mock.invocationCallOrder[0]).toBeLessThan(
      historyDelete.mock.invocationCallOrder[0],
    );
    expect(processDelete).toHaveBeenCalledWith({
      where: { id: appointment.process.id },
    });
    expect(appointmentDelete).toHaveBeenCalledWith({
      where: { id: appointment.id },
    });
  });
});
