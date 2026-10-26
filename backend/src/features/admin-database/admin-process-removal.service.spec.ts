import { ConflictException } from '@nestjs/common';
import {
  AppointmentSchedulingMethod,
  ProviderStatus,
  StatusAgendamento,
} from '@prisma/client';
import { AdminProcessRemovalService } from './admin-process-removal.service';

const processId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const specialistId = '33333333-3333-4333-8333-333333333333';
const clientId = '44444444-4444-4444-8444-444444444444';
const appointmentId = '55555555-5555-4555-8555-555555555555';
const changedAt = new Date('2026-10-25T12:00:00Z');

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    id: processId,
    client_id: clientId,
    specialist_id: specialistId,
    removed_at: null,
    updated_at: changedAt,
    appointment_id: appointmentId,
    appointment: {
      id: appointmentId,
      client_id: clientId,
      specialist_id: specialistId,
      status: StatusAgendamento.PENDING,
      scheduling_method: AppointmentSchedulingMethod.EMAIL,
      calendly_event_uri: null,
      calendly_invitee_uri: null,
      updated_at: changedAt,
    },
    meeting_session: null,
    contracts: [],
    ...overrides,
  };
}

function harness(process = fixture()) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    process: {
      findUnique: jest.fn().mockResolvedValue(process),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    appointment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    process: {
      findUnique: jest.fn().mockResolvedValue({ specialist_id: specialistId }),
    },
    $transaction: jest.fn(async (callback) => callback(tx)),
  } as any;
  return { service: new AdminProcessRemovalService(prisma), tx };
}

describe('AdminProcessRemovalService', () => {
  it('preserva o processo e cancela o agendamento local na mesma transação', async () => {
    const { service, tx } = harness();
    const result = await service.remove(
      processId,
      actorId,
      '  pedido do cliente  ',
    );
    expect(result).toMatchObject({ id: processId, removed_by: actorId });
    expect(tx.process.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: processId,
          removed_at: null,
          updated_at: changedAt,
        }),
        data: expect.objectContaining({
          removed_by: actorId,
          removal_reason: 'pedido do cliente',
        }),
      }),
    );
    expect(tx.appointment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: appointmentId,
          updated_at: changedAt,
        }),
        data: expect.objectContaining({ status: StatusAgendamento.CANCELLED }),
      }),
    );
  });

  it.each([
    ['reunião aberta', { meeting_session: { ended_at: null } }],
    [
      'envelope enviado',
      {
        contracts: [
          { provider_id: 'env-1', provider_status: ProviderStatus.SENT },
        ],
      },
    ],
    [
      'Calendly marcado',
      {
        appointment: {
          ...fixture().appointment,
          status: StatusAgendamento.SCHEDULED,
          scheduling_method: AppointmentSchedulingMethod.CALENDLY,
        },
      },
    ],
  ])('bloqueia %s antes de escrever', async (_case, overrides) => {
    const { service, tx } = harness(fixture(overrides));
    await expect(
      service.remove(processId, actorId, 'motivo'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.process.updateMany).not.toHaveBeenCalled();
    expect(tx.appointment.updateMany).not.toHaveBeenCalled();
  });

  it('permite remover processo com contrato já assinado sem apagar o contrato', async () => {
    const { service, tx } = harness(
      fixture({
        appointment_id: null,
        appointment: null,
        contracts: [
          { provider_id: 'env-1', provider_status: ProviderStatus.COMPLETED },
        ],
      }),
    );
    await expect(
      service.remove(processId, actorId, 'encerramento'),
    ).resolves.toMatchObject({ id: processId });
    expect(tx.appointment.updateMany).not.toHaveBeenCalled();
    expect(tx.process.updateMany).toHaveBeenCalledTimes(1);
  });

  it('não permite excluir duas vezes', async () => {
    const { service, tx } = harness(fixture({ removed_at: changedAt }));
    await expect(
      service.remove(processId, actorId, 'motivo'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.process.updateMany).not.toHaveBeenCalled();
  });
});
