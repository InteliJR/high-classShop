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
    const historyCreate = jest.fn().mockResolvedValue({});
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
      historyCreate,
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

      await expect(
        service.create(dto as any, client.id, UserRole.CUSTOMER),
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
      service.create(dto as any, client.id, UserRole.CUSTOMER),
    ).rejects.toBe(processFailure);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(storedAppointments).toHaveLength(0);
    expect(rootAppointmentCreate).not.toHaveBeenCalled();
    expect(rootProcessCreate).not.toHaveBeenCalled();
  });

  it.each([UserRole.SPECIALIST, UserRole.CONSULTANT, UserRole.ADMIN])(
    'rejects direct scheduling by %s',
    async (role) => {
      const { service, appointmentCreate } = harness({});

      await expect(
        (service.create as any)(dto, client.id, role),
      ).rejects.toThrow(ForbiddenException);
      expect(appointmentCreate).not.toHaveBeenCalled();
    },
  );

  it('rejects a customer scheduling for another client', async () => {
    const { service, appointmentCreate } = harness({});

    await expect(
      (service.create as any)(dto, 'another-client', UserRole.CUSTOMER),
    ).rejects.toThrow(ForbiddenException);
    expect(appointmentCreate).not.toHaveBeenCalled();
  });

  it('stores direct scheduling as SCHEDULED and PLATFORM', async () => {
    const { service, appointmentCreate, historyCreate } = harness({});

    await (service.create as any)(dto, client.id, UserRole.CUSTOMER);

    expect(appointmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StatusAgendamento.SCHEDULED,
          scheduling_method: AppointmentSchedulingMethod.PLATFORM,
        }),
      }),
    );
    expect(historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        processId: 'process-1',
        status: ProcessStatus.SCHEDULING,
        changed_by: client.id,
      }),
    });
  });

  it('serializa a verificação e a inserção do horário por especialista', async () => {
    const { service, tx } = harness({});

    await service.create(dto as any, client.id, UserRole.CUSTOMER);

    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      'appointment-schedule:specialist-1',
    );
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.appointment.findFirst.mock.invocationCallOrder[0],
    );
  });

  it('rejects platform scheduling when no datetime is supplied', async () => {
    const { service, tx, appointmentCreate } = harness({});
    const withoutDate = { ...dto, appointment_datetime: undefined };

    await expect(
      (service.create as any)(
        withoutDate as CreateAppointmentDto,
        client.id,
        UserRole.CUSTOMER,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(tx.appointment.findFirst).not.toHaveBeenCalled();
    expect(appointmentCreate).not.toHaveBeenCalled();
  });

  it('serializa e repete a deduplicação do processo antes de criá-lo', async () => {
    const { service, tx } = harness({});

    await service.create(dto as any, client.id, UserRole.CUSTOMER);

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
  it('rejeita horário pré-preenchido em uma solicitação por e-mail', async () => {
    const prisma = {
      user: { findUnique: jest.fn() },
    } as any;
    const service = new AppointmentsService(prisma, {} as any, {} as any);

    await expect(
      service.createPending(
        {
          client_id: 'client-1',
          specialist_id: 'specialist-1',
          scheduling_method: AppointmentSchedulingMethod.EMAIL,
          appointment_datetime: '2099-01-01T10:00:00.000Z',
        } as CreatePendingAppointmentDto,
        'client-1',
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
        event_uri: 'https://calendly.test/events/1',
        invitee_uri: 'https://calendly.test/invitees/1',
        scheduled_start_time: '2099-01-01T10:00:00.000Z',
      } as any),
    ).rejects.toThrow(BadRequestException);
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
        event_uri: 'https://calendly.test/events/2',
        invitee_uri: 'https://calendly.test/invitees/2',
        scheduled_start_time: '2099-01-02T10:00:00.000Z',
      } as any),
    ).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

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
        event_uri: 'https://calendly.test/events/1',
        invitee_uri: 'https://calendly.test/invitees/1',
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
