import {
  BadRequestException,
  ForbiddenException,
  ValidationPipe,
} from '@nestjs/common';
import {
  AppointmentSchedulingMethod,
  ProductType,
  StatusAgendamento,
  UserRole,
} from '@prisma/client';
import { AppointmentsController } from './appointments.controller';

describe('AppointmentsController own request check', () => {
  const query = {
    specialist_id: '33333333-3333-4333-8333-333333333333',
    product_type: ProductType.CAR,
    product_id: '11111111-1111-4111-8111-111111111111',
  };
  const request = { user: { id: 'customer-1', role: UserRole.CUSTOMER } };
  const snapshot = {
    exists: true,
    appointment_id: 'appointment-1',
    process_id: 'process-1',
    appointment_status: StatusAgendamento.PENDING,
    scheduling_method: AppointmentSchedulingMethod.EMAIL,
    appointment_datetime: new Date('2099-01-01T10:00:00.000Z'),
  };
  function harness(data: any = snapshot) {
    const service = {
      findExistingAppointment: jest.fn().mockResolvedValue(data),
    };
    return { service, controller: new AppointmentsController(service as any) };
  }

  it('derives the customer exclusively from JWT and returns the minimal contract', async () => {
    const { controller, service } = harness();
    expect(
      await controller.checkExisting(
        { ...query, client_id: 'another-customer' } as any,
        request,
      ),
    ).toEqual({
      success: true,
      message: 'Consulta realizada com sucesso',
      data: snapshot,
    });
    expect(service.findExistingAppointment).toHaveBeenCalledWith(
      request.user.id,
      query.specialist_id,
      query.product_type,
      query.product_id,
    );
  });

  it('returns the absent discriminant', async () => {
    const { controller } = harness({ exists: false });
    expect(await controller.checkExisting(query, request)).toEqual({
      success: true,
      message: 'Consulta realizada com sucesso',
      data: { exists: false },
    });
  });

  it.each([
    UserRole.SPECIALIST,
    UserRole.ADMIN,
    UserRole.OFFICE,
    UserRole.CONSULTANT,
  ])('denies %s before invoking the service', async (role) => {
    const { controller, service } = harness();
    await expect(
      controller.checkExisting(query, { user: { id: 'outsider', role } }),
    ).rejects.toThrow(ForbiddenException);
    expect(service.findExistingAppointment).not.toHaveBeenCalled();
  });

  it('validates the query DTO and forbids client identity at the HTTP boundary', async () => {
    const [queryType] = Reflect.getMetadata(
      'design:paramtypes',
      AppointmentsController.prototype,
      'checkExisting',
    );
    expect(queryType.name).toBe('CheckExistingAppointmentDto');
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const metadata = { type: 'query' as const, metatype: queryType };
    await expect(pipe.transform(query, metadata)).resolves.toMatchObject(query);
    for (const invalid of [
      { ...query, client_id: request.user.id },
      { ...query, specialist_id: 'bad-uuid' },
      { ...query, product_type: 'OTHER' },
      { ...query, product_id: 'bad-uuid' },
      { specialist_id: query.specialist_id },
    ]) {
      await expect(pipe.transform(invalid, metadata)).rejects.toThrow(
        BadRequestException,
      );
    }
  });
});
