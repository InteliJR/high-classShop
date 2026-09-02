import {
  Prisma,
  ProcessStatus,
  ProductCurrency,
  ProductType,
  StatusAgendamento,
  UserRole,
} from '@prisma/client';
import { AppointmentsService } from './appointments.service';

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
        appointment: {
          update: jest.fn().mockResolvedValue({
            ...appointment,
            status: StatusAgendamento.SCHEDULED,
          }),
        },
        process: {
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
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.$queryRaw.mock.calls[0][1]).toBe('product-money:CAR:product-1');
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
