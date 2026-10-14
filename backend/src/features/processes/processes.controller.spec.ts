import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ProcessesController } from './processes.controller';

describe('ProcessesController.getBySpecialist', () => {
  it('does not expose another specialist process list', async () => {
    const service = {
      getBySpecialistIdWithFilters: jest.fn(),
    } as any;
    const controller = new ProcessesController(service);

    await expect(
      controller.getBySpecialist(
        '11111111-1111-4111-8111-111111111111',
        {} as any,
        {
          user: {
            id: '22222222-2222-4222-8222-222222222222',
            role: UserRole.SPECIALIST,
          } as any,
        },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(service.getBySpecialistIdWithFilters).not.toHaveBeenCalled();
  });

  it('forwards the authenticated requester to phone visibility rules', async () => {
    const specialistId = '11111111-1111-4111-8111-111111111111';
    const getBySpecialistIdWithFilters = jest.fn().mockResolvedValue({
      processes: [],
      count: 0,
    });
    const controller = new ProcessesController({
      getBySpecialistIdWithFilters,
    } as any);

    await controller.getBySpecialist(specialistId, {} as any, {
      user: {
        id: specialistId,
        role: UserRole.SPECIALIST,
      } as any,
    });

    expect(getBySpecialistIdWithFilters).toHaveBeenCalledWith(
      specialistId,
      expect.objectContaining({ page: 1, perPage: 20 }),
      { id: specialistId, role: UserRole.SPECIALIST },
    );
  });
});

describe('ProcessesController.confirmAppointment', () => {
  it('forwards the agreed datetime to the service', async () => {
    const service = {
      confirmAppointment: jest.fn().mockResolvedValue({
        processId: '11111111-1111-4111-8111-111111111111',
        status: 'SCHEDULING',
      }),
    } as any;
    const controller = new ProcessesController(service);
    const processId = '11111111-1111-4111-8111-111111111111';
    const specialistId = '22222222-2222-4222-8222-222222222222';
    const appointmentDatetime = '2099-01-01T13:00:00.000Z';

    await (controller.confirmAppointment as any)(
      processId,
      { appointment_datetime: appointmentDatetime },
      { user: { id: specialistId, role: UserRole.SPECIALIST } },
    );

    expect(service.confirmAppointment).toHaveBeenCalledWith(
      processId,
      specialistId,
      appointmentDatetime,
    );
  });

  it.each([
    UserRole.ADMIN,
    UserRole.CUSTOMER,
    UserRole.OFFICE,
    UserRole.CONSULTANT,
    undefined,
  ])(
    'rejects role %s before calling the confirmation service',
    async (role) => {
      const service = { confirmAppointment: jest.fn() } as any;
      const controller = new ProcessesController(service);
      await expect(
        controller.confirmAppointment(
          'process-1',
          {},
          { user: { id: 'actor', role } },
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(service.confirmAppointment).not.toHaveBeenCalled();
    },
  );

  it('rejects a missing actor before calling the confirmation service', async () => {
    const service = { confirmAppointment: jest.fn() } as any;
    const controller = new ProcessesController(service);
    await expect(
      controller.confirmAppointment('process-1', {}, {}),
    ).rejects.toThrow(ForbiddenException);
    expect(service.confirmAppointment).not.toHaveBeenCalled();
  });
});
