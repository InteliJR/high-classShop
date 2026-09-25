import { AppointmentSchedulingMethod } from '@prisma/client';
import { CalendlyIntegrationService } from './calendly-integration.service';

describe('CalendlyIntegrationService webhook schedule integrity', () => {
  it.each([
    AppointmentSchedulingMethod.EMAIL,
    AppointmentSchedulingMethod.PLATFORM,
  ])('ignora eventos do Calendly para origem %s', async (method) => {
    const appointment = {
      id: 'appointment-1',
      specialist_id: 'specialist-1',
      calendly_event_uri: 'https://calendly.test/events/1',
      scheduling_method: method,
      specialist_rescheduled_at: null,
    };
    const prisma = {
      appointment: {
        findFirst: jest.fn().mockResolvedValue(appointment),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const service = new CalendlyIntegrationService(prisma as any);
    jest
      .spyOn(service as any, 'validateWebhookSignature')
      .mockReturnValue(undefined);

    const result = await service.processWebhook(
      {
        event: 'invitee.created',
        payload: {
          event: appointment.calendly_event_uri,
          scheduled_event: { start_time: '2099-01-01T10:00:00.000Z' },
        },
      },
      undefined,
      undefined,
    );

    expect(result.processed).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it('ignora eventos posteriores à alteração definitiva do especialista', async () => {
    const appointment = {
      id: 'appointment-1',
      specialist_id: 'specialist-1',
      calendly_event_uri: 'https://calendly.test/events/1',
      scheduling_method: AppointmentSchedulingMethod.CALENDLY,
      specialist_rescheduled_at: new Date('2026-01-01T00:00:00.000Z'),
    };
    const prisma = {
      appointment: { findFirst: jest.fn().mockResolvedValue(appointment) },
      $transaction: jest.fn(),
    };
    const service = new CalendlyIntegrationService(prisma as any);
    jest
      .spyOn(service as any, 'validateWebhookSignature')
      .mockReturnValue(undefined);

    const result = await service.processWebhook(
      {
        event: 'invitee.created',
        payload: {
          event: appointment.calendly_event_uri,
          scheduled_event: { start_time: '2099-01-01T10:00:00.000Z' },
        },
      },
      undefined,
      undefined,
    );

    expect(result.processed).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('serializes and rechecks an invitee.created time before writing it', async () => {
    const appointment = {
      id: 'appointment-1',
      client_id: 'client-1',
      specialist_id: 'specialist-1',
      calendly_event_uri: 'https://calendly.test/events/1',
      calendly_invitee_uri: null,
      calendly_sync_status: 'PENDING',
      appointment_datetime: null,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(appointment),
      },
    };
    const prisma = {
      appointment: {
        findFirst: jest.fn().mockResolvedValue(appointment),
        update: jest.fn().mockResolvedValue(appointment),
      },
      $transaction: jest.fn(async (callback: (client: any) => unknown) =>
        callback(tx),
      ),
    };
    const service = new CalendlyIntegrationService(prisma as any);
    jest
      .spyOn(service as any, 'validateWebhookSignature')
      .mockReturnValue(undefined);

    await service.processWebhook(
      {
        event: 'invitee.created',
        payload: {
          event: appointment.calendly_event_uri,
          invitee: 'https://calendly.test/invitees/1',
          scheduled_event: {
            start_time: '2099-01-01T10:00:00.000Z',
          },
        },
      },
      undefined,
      undefined,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.appointment.findUnique).toHaveBeenCalledWith({
      where: { id: appointment.id },
    });
    expect(tx.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          specialist_id: appointment.specialist_id,
          id: { not: appointment.id },
        }),
      }),
    );
    expect(tx.appointment.update).toHaveBeenCalledTimes(1);
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });
});
