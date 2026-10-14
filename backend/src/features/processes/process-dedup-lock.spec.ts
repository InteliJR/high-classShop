import { ConflictException } from '@nestjs/common';
import {
  AppointmentSchedulingMethod,
  CalendlySyncStatus,
  ProductType,
  StatusAgendamento,
} from '@prisma/client';
import {
  assertNoActiveProcess,
  lockAndAssertNoActiveProcess,
} from './process-dedup-lock';

describe('assertNoActiveProcess', () => {
  it('returns a stable error code when an active product process exists', async () => {
    const tx = {
      process: {
        findFirst: jest.fn().mockResolvedValue({ id: 'process-1' }),
      },
    };

    let thrown: unknown;
    try {
      await assertNoActiveProcess(tx, {
        clientId: 'client-1',
        specialistId: 'specialist-1',
        productType: ProductType.CAR,
        productId: 'car-1',
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConflictException);
    expect((thrown as ConflictException).getResponse()).toMatchObject({
      error: {
        code: 'ACTIVE_PROCESS_EXISTS',
        message: 'Já existe processo ativo para este cliente com este produto.',
      },
    });
  });
});

describe('own active process snapshot', () => {
  const scope = {
    clientId: 'client-1',
    specialistId: 'specialist-1',
    productType: ProductType.CAR,
    productId: 'car-1',
  };
  const options = { authenticatedClientId: scope.clientId };
  const appointment = {
    id: 'appointment-1',
    client_id: scope.clientId,
    status: StatusAgendamento.PENDING,
    scheduling_method: AppointmentSchedulingMethod.EMAIL,
    calendly_sync_status: CalendlySyncStatus.PENDING,
    appointment_datetime: new Date('2099-01-01T10:00:00.000Z'),
    client: { email: 'private@example.com', phone: 'private-phone' },
  };
  function harness(existing: any) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      process: { findFirst: jest.fn().mockResolvedValue(existing) },
    };
    return tx;
  }
  async function response(
    tx: any,
    actorOptions: any = options,
    exclude?: string,
  ) {
    const error = await (assertNoActiveProcess as any)(
      tx,
      scope,
      exclude,
      actorOptions,
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConflictException);
    return error.getResponse();
  }

  it.each([null, appointment])(
    'returns the exact owned snapshot with appointment %o',
    async (attached) => {
      const tx = harness({
        id: 'process-1',
        client_id: scope.clientId,
        appointment: attached,
        notes: 'private-notes',
      });
      expect(await response(tx)).toEqual({
        success: false,
        error: {
          code: 'ACTIVE_PROCESS_EXISTS',
          message: expect.any(String),
          details: {
            existing_request: {
              process_id: 'process-1',
              appointment_id: attached?.id ?? null,
              appointment_status: attached?.status ?? null,
              scheduling_method: attached?.scheduling_method ?? null,
              appointment_datetime: attached?.appointment_datetime ?? null,
            },
          },
        },
      });
      expect(tx.process.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({ client_id: scope.clientId }),
        select: {
          id: true,
          client_id: true,
          appointment: {
            select: {
              id: true,
              client_id: true,
              status: true,
              scheduling_method: true,
              appointment_datetime: true,
            },
          },
        },
      });
    },
  );

  it('does not reveal details without the authenticated client opt-in', async () => {
    const tx = harness({
      id: 'process-1',
      client_id: scope.clientId,
      appointment,
    });
    const error = await assertNoActiveProcess(tx, scope).catch(
      (caught) => caught,
    );
    expect(error.getResponse().error).not.toHaveProperty('details');
  });

  it.each([
    ['another-client', scope.clientId],
    [scope.clientId, 'another-client'],
  ])(
    'does not reveal details when actor %s or stored owner %s differs',
    async (actorId, storedId) => {
      const result = await response(
        harness({ id: 'process-1', client_id: storedId, appointment }),
        { authenticatedClientId: actorId },
      );
      expect(result.error).not.toHaveProperty('details');
    },
  );

  it('nulls all appointment fields when the linked appointment belongs to someone else', async () => {
    const result = await response(
      harness({
        id: 'process-1',
        client_id: scope.clientId,
        appointment: { ...appointment, client_id: 'another-client' },
      }),
    );
    expect(result.error.details.existing_request).toEqual({
      process_id: 'process-1',
      appointment_id: null,
      appointment_status: null,
      scheduling_method: null,
      appointment_datetime: null,
    });
  });

  it('forwards options and exclusions through the lock wrapper before reading', async () => {
    const tx = harness({
      id: 'process-1',
      client_id: scope.clientId,
      appointment,
    });
    const error = await (lockAndAssertNoActiveProcess as any)(
      tx,
      scope,
      'excluded-process',
      options,
    ).catch((caught: unknown) => caught);
    expect(error.getResponse().error.details.existing_request.process_id).toBe(
      'process-1',
    );
    expect(tx.process.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: 'excluded-process' } }),
      }),
    );
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.process.findFirst.mock.invocationCallOrder[0],
    );
    expect(JSON.stringify(error.getResponse())).not.toMatch(
      /private@example.com|private-phone|private-notes|client_id/,
    );
  });
});
