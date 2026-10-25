import { ForbiddenException } from '@nestjs/common';
import {
  AppointmentSchedulingMethod,
  ProcessStatus,
  ProductType,
  StatusAgendamento,
  UserRole,
} from '@prisma/client';
import { ProcessesService } from './processes.service';

describe('persisted consultancy reason in private process responses', () => {
  const reason = 'Quero escolher um carro para viagens';
  const process = {
    id: 'process-1',
    client_id: 'customer-1',
    specialist_id: 'specialist-1',
    appointment_id: 'appointment-1',
    status: ProcessStatus.NEGOTIATION,
    product_type: ProductType.CAR,
    car_id: 'car-1',
    client: { id: 'customer-1', name: 'Cliente' },
    specialist: {
      id: 'specialist-1',
      name: 'Especialista',
      speciality: ProductType.CAR,
    },
    appointment: {
      status: StatusAgendamento.COMPLETED,
      scheduling_method: AppointmentSchedulingMethod.EMAIL,
      product_type: null,
      product_id: null,
      notes: reason,
    },
    car: { id: 'car-1', marca: 'Marca', modelo: 'Modelo' },
    notes: 'Nota técnica do processo',
    created_at: new Date('2026-10-25T12:00:00Z'),
  };

  function setup(value = process) {
    const prisma = {
      process: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(value),
        findMany: jest.fn().mockResolvedValue([value]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    return {
      prisma,
      service: new ProcessesService(prisma as never, {} as never),
    };
  }

  it('reads the original appointment reason in detail after assignment and reload', async () => {
    const { service, prisma } = setup();
    for (let load = 0; load < 2; load++) {
      const response = await service.getById(
        process.id,
        process.specialist_id,
        UserRole.SPECIALIST,
      );
      expect(response.consultancy_reason).toBe(reason);
      expect(response.notes).toBe('Nota técnica do processo');
    }
    expect(prisma.process.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          appointment: {
            select: expect.objectContaining({
              notes: true,
              product_type: true,
              product_id: true,
            }),
          },
        }),
      }),
    );
  });

  it('includes the reason in the actual specialist list endpoint', async () => {
    const { service } = setup();
    const response = await service.getBySpecialistIdWithFilters(
      process.specialist_id,
      {},
      { id: process.specialist_id, role: UserRole.SPECIALIST },
    );
    expect(response.processes[0].consultancy_reason).toBe(reason);
  });

  it('includes the reason for the owner-scoped customer list', async () => {
    const { service } = setup();
    const response = await service.getByClientId(
      process.client_id,
      { page: 1, perPage: 20 },
      process.client_id,
      UserRole.CUSTOMER,
    );
    expect(response.processes[0].consultancy_reason).toBe(reason);
  });

  it('does not allow another customer to read the private reason', async () => {
    const { service } = setup();
    await expect(
      service.getById(process.id, 'other-customer', UserRole.CUSTOMER),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.getByClientId(
        process.client_id,
        { page: 1, perPage: 20 },
        'other-customer',
        UserRole.CUSTOMER,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
