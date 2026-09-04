import {
  Prisma,
  ProcessStatus,
  ProductCurrency,
  ProductType,
  StatusAgendamento,
  UserRole,
} from '@prisma/client';
import { validate } from 'class-validator';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
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
});

describe('AppointmentsService.create — associação e atomicidade', () => {
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
  } as CreateAppointmentDto;

  function harness(options: {
    transactionalProduct?: typeof activeProduct;
    processFailure?: Error;
  }) {
    const storedAppointments: any[] = [];
    const appointmentCreate = jest.fn(async ({ data }) => {
      const appointment = {
        id: 'appointment-1',
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
      };
      storedAppointments.push(appointment);
      return appointment;
    });
    const processCreate = jest.fn(async () => {
      if (options.processFailure) throw options.processFailure;
      return { id: 'process-1' };
    });
    const userFindUnique = jest.fn(async ({ where }) =>
      where.id === client.id ? client : specialist,
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
        findFirst: jest.fn().mockResolvedValue(null),
        create: processCreate,
      },
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
        try {
          return await callback(tx);
        } catch (error) {
          storedAppointments.splice(before);
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
      rootAppointmentCreate,
      rootProcessCreate,
      storedAppointments,
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

      await expect(service.create(dto, client.id)).rejects.toThrow(
        expectedError,
      );
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

    await expect(service.create(dto, client.id)).rejects.toBe(processFailure);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(storedAppointments).toHaveLength(0);
    expect(rootAppointmentCreate).not.toHaveBeenCalled();
    expect(rootProcessCreate).not.toHaveBeenCalled();
  });

  it('serializa a verificação e a inserção do horário por especialista', async () => {
    const { service, tx } = harness({});

    await service.create(dto, client.id);

    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      'appointment-schedule:specialist-1',
    );
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.appointment.findFirst.mock.invocationCallOrder[0],
    );
  });

  it('checks the exact generated timestamp when no datetime is supplied', async () => {
    const { service, tx, appointmentCreate } = harness({});
    const withoutDate = { ...dto, appointment_datetime: undefined };

    await service.create(withoutDate as CreateAppointmentDto, client.id);

    const insertedAt = appointmentCreate.mock.calls[0][0].data
      .appointment_datetime as Date;
    expect(tx.appointment.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        appointment_datetime: {
          gte: new Date(insertedAt.getTime() - 60 * 60 * 1000),
          lte: new Date(insertedAt.getTime() + 60 * 60 * 1000),
        },
      }),
    });
  });

  it('serializa e repete a deduplicação do processo antes de criá-lo', async () => {
    const { service, tx } = harness({});

    await service.create(dto, client.id);

    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      'process-dedup:client-1:specialist-1:CAR:product-1',
    );
    expect(tx.process.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ car_id: 'product-1' }),
    });
    expect(tx.process.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
      tx.process.create.mock.invocationCallOrder[0],
    );
  });
});

describe('AppointmentsService.createPending — integridade das partes', () => {
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
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('locks and rechecks active-process dedup inside the write transaction', async () => {
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
        } as CreateAppointmentDto,
        client.id,
      ),
    ).rejects.toThrow('stop after checks');

    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      'process-dedup:client-1:specialist-1:CONSULTANCY:none',
    );
    expect(tx.process.findFirst).toHaveBeenCalledTimes(1);
  });
});

describe('AppointmentsService.updateStatus — snapshot da negociação', () => {
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
    const appointmentUpdate = jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        ...appointment,
        ...data,
        client,
        specialist,
        process,
      }),
    );
    const processUpdate = jest.fn().mockResolvedValue({});
    const processUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const rootAppointmentUpdate = jest.fn();
    const rootProcessUpdate = jest.fn();
    const historyCreate = jest.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      appointment: { update: appointmentUpdate },
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
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0][1]).toBe('product-money:CAR:product-1');
    expect(appointmentUpdate).toHaveBeenCalled();
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
      const appointmentUpdate = jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          ...appointment,
          ...data,
          client,
          specialist,
          process,
        }),
      );
      const processUpdate = jest.fn().mockResolvedValue({});
      const processUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const historyCreate = jest.fn().mockResolvedValue({});
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
        appointment: { update: appointmentUpdate },
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
        appointment_datetime: new Date('2026-01-01T10:00:00.000Z'),
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
  it('serializes and rechecks the resolved time in the write transaction', async () => {
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
        event_uri: 'https://calendly.test/events/1',
        invitee_uri: 'https://calendly.test/invitees/1',
        scheduled_start_time: '2099-01-01T10:00:00.000Z',
      } as any,
    );

    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      'appointment-schedule:specialist-1',
    );
    expect(tx.appointment.findFirst).toHaveBeenCalled();
    expect(prisma.appointment.update).not.toHaveBeenCalled();
    expect(tx.appointment.update).toHaveBeenCalledTimes(1);
  });

  it('rejects a reschedule that overlaps an already SCHEDULED appointment', async () => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      status: StatusAgendamento.PENDING,
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
        event_uri: 'https://calendly.test/events/1',
        invitee_uri: 'https://calendly.test/invitees/1',
        scheduled_start_time: '2099-01-01T10:00:00.000Z',
      } as any),
    ).rejects.toThrow(ConflictException);
    expect(tx.appointment.update).not.toHaveBeenCalled();
  });
});
