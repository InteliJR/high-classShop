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
