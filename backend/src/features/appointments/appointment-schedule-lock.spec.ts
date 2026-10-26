import { ConflictException } from '@nestjs/common';
import {
  AppointmentSchedulingMethod,
  CalendlySyncStatus,
  StatusAgendamento,
} from '@prisma/client';
import * as scheduleLock from './appointment-schedule-lock';

describe('specialist schedule occupation', () => {
  const when = new Date('2099-01-01T10:00:00.000Z');
  const hour = 60 * 60 * 1000;

  // Evaluate the Prisma filter at the storage boundary so availability tests
  // exercise the actual query produced by the domain helper.
  function matches(record: any, where: any): boolean {
    return Object.entries(where).every(([key, value]: [string, any]) => {
      if (key === 'OR')
        return value.some((branch: any) => matches(record, branch));
      if (key === 'appointment_datetime') {
        return (
          record[key] !== null &&
          record[key] >= value.gte &&
          record[key] <= value.lte
        );
      }
      if (value && typeof value === 'object') {
        if ('not' in value) return record[key] !== value.not;
        if ('in' in value) return value.in.includes(record[key]);
      }
      return record[key] === value;
    });
  }

  function transaction(record: any) {
    return {
      appointment: {
        findFirst: jest.fn(async ({ where }) =>
          matches(record, where) ? record : null,
        ),
      },
    };
  }

  const occupied = {
    id: 'competing-appointment',
    client_id: 'competing-client',
    process_id: 'competing-process',
    specialist_id: 's1',
    status: StatusAgendamento.SCHEDULED,
    scheduling_method: AppointmentSchedulingMethod.EMAIL,
    calendly_sync_status: CalendlySyncStatus.PENDING,
    appointment_datetime: when,
  };

  it('builds one occupation predicate with the original inclusive one-hour window', () => {
    expect(
      (scheduleLock as any).buildOccupiedScheduleWhere('s1', when),
    ).toEqual({
      specialist_id: 's1',
      appointment_datetime: {
        gte: new Date(when.getTime() - hour),
        lte: new Date(when.getTime() + hour),
      },
      OR: [
        { status: StatusAgendamento.SCHEDULED },
        {
          status: StatusAgendamento.PENDING,
          scheduling_method: AppointmentSchedulingMethod.CALENDLY,
          calendly_sync_status: CalendlySyncStatus.SYNCED,
        },
        { status: StatusAgendamento.PENDING, scheduling_method: null },
      ],
    });
  });

  it.each([-hour, hour])(
    'conflicts at the inclusive boundary %i ms',
    async (offset) => {
      const tx = transaction({
        ...occupied,
        appointment_datetime: new Date(when.getTime() + offset),
      });
      await expect(
        scheduleLock.assertSpecialistScheduleAvailable(tx, 's1', when),
      ).rejects.toThrow(ConflictException);
    },
  );

  it.each([-hour - 1, hour + 1])(
    'allows one millisecond outside the boundary %i ms',
    async (offset) => {
      const tx = transaction({
        ...occupied,
        appointment_datetime: new Date(when.getTime() + offset),
      });
      await expect(
        scheduleLock.assertSpecialistScheduleAvailable(tx, 's1', when),
      ).resolves.toBeUndefined();
    },
  );

  it.each([
    [AppointmentSchedulingMethod.EMAIL, CalendlySyncStatus.PENDING],
    [AppointmentSchedulingMethod.EMAIL, CalendlySyncStatus.SYNCED],
    [AppointmentSchedulingMethod.CALENDLY, CalendlySyncStatus.PENDING],
    [AppointmentSchedulingMethod.CALENDLY, CalendlySyncStatus.FAILED],
  ])(
    'does not reserve a pending %s request with sync %s',
    async (method, sync) => {
      const tx = transaction({
        ...occupied,
        status: StatusAgendamento.PENDING,
        scheduling_method: method,
        calendly_sync_status: sync,
      });
      await expect(
        scheduleLock.assertSpecialistScheduleAvailable(tx, 's1', when),
      ).resolves.toBeUndefined();
    },
  );

  it.each([
    [AppointmentSchedulingMethod.CALENDLY, CalendlySyncStatus.SYNCED],
    [null, CalendlySyncStatus.PENDING],
  ])(
    'reserves synced Calendly and legacy dated pending requests: %s',
    async (method, sync) => {
      const tx = transaction({
        ...occupied,
        status: StatusAgendamento.PENDING,
        scheduling_method: method,
        calendly_sync_status: sync,
      });
      await expect(
        scheduleLock.assertSpecialistScheduleAvailable(tx, 's1', when),
      ).rejects.toThrow(ConflictException);
    },
  );

  it.each([StatusAgendamento.COMPLETED, StatusAgendamento.CANCELLED])(
    'does not reserve a %s appointment',
    async (status) => {
      await expect(
        scheduleLock.assertSpecialistScheduleAvailable(
          transaction({ ...occupied, status }),
          's1',
          when,
        ),
      ).resolves.toBeUndefined();
    },
  );

  it('does not reserve undated legacy pending requests or another specialist', async () => {
    await expect(
      scheduleLock.assertSpecialistScheduleAvailable(
        transaction({
          ...occupied,
          status: StatusAgendamento.PENDING,
          scheduling_method: null,
          appointment_datetime: null,
        }),
        's1',
        when,
      ),
    ).resolves.toBeUndefined();
    await expect(
      scheduleLock.assertSpecialistScheduleAvailable(
        transaction({ ...occupied, specialist_id: 's2' }),
        's1',
        when,
      ),
    ).resolves.toBeUndefined();
  });

  it('excludes the appointment being updated', async () => {
    await expect(
      scheduleLock.assertSpecialistScheduleAvailable(
        transaction(occupied),
        's1',
        when,
        occupied.id,
      ),
    ).resolves.toBeUndefined();
  });

  it('does not query availability for an absent datetime', async () => {
    const tx = transaction(occupied);
    await expect(
      scheduleLock.assertSpecialistScheduleAvailable(tx, 's1', null),
    ).resolves.toBeUndefined();
    expect(tx.appointment.findFirst).not.toHaveBeenCalled();
  });

  it('returns a conflict without competing appointment, client or process identities', async () => {
    const tx = transaction(occupied);
    const error = await scheduleLock
      .assertSpecialistScheduleAvailable(tx, 's1', when)
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toEqual({
      success: false,
      error: {
        code: 409,
        message: expect.any(String),
        details: { suggested_times: expect.any(Array) },
      },
    });
    const response = JSON.stringify(error.getResponse());
    for (const identity of [
      occupied.id,
      occupied.client_id,
      occupied.process_id,
    ]) {
      expect(response).not.toContain(identity);
    }
    expect(tx.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true } }),
    );
  });
});
