import { ConflictException } from '@nestjs/common';
import {
  AppointmentSchedulingMethod,
  ProcessStatus,
  ProductType,
} from '@prisma/client';
import type { ActiveProcessSnapshot } from '../appointments/entities/appointment.response';

export const ACTIVE_PROCESS_STATUSES: ProcessStatus[] = [
  ProcessStatus.SCHEDULING,
  ProcessStatus.NEGOTIATION,
  ProcessStatus.PROCESSING_CONTRACT,
  ProcessStatus.DOCUMENTATION,
];

export type ActiveProcessScope = {
  clientId: string;
  specialistId: string;
  productType?: ProductType | null;
  productId?: string | null;
};

type ActiveProcessConflictOptions = {
  authenticatedClientId?: string;
};

const PRODUCT_FIELD: Record<ProductType, 'car_id' | 'boat_id' | 'aircraft_id'> =
  {
    [ProductType.CAR]: 'car_id',
    [ProductType.BOAT]: 'boat_id',
    [ProductType.AIRCRAFT]: 'aircraft_id',
  };

export function activeProcessDedupKey(scope: ActiveProcessScope): string {
  const isConsultancy = !scope.productType || !scope.productId;
  return `process-dedup:${scope.clientId}:${scope.specialistId}:${isConsultancy ? 'CONSULTANCY' : scope.productType}:${isConsultancy ? 'none' : scope.productId}`;
}

export async function acquireActiveProcessDedupLock(
  tx: any,
  scope: ActiveProcessScope,
): Promise<void> {
  const lockKey = activeProcessDedupKey(scope);
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS locked
  `;
}

export async function assertNoActiveProcess(
  tx: any,
  scope: ActiveProcessScope,
  excludeProcessId?: string,
  options?: ActiveProcessConflictOptions,
): Promise<void> {
  const isConsultancy = !scope.productType || !scope.productId;
  const where: Record<string, unknown> = isConsultancy
    ? {
        client_id: scope.clientId,
        specialist_id: scope.specialistId,
        product_type: null,
        removed_at: null,
        status: { in: ACTIVE_PROCESS_STATUSES },
      }
    : {
        client_id: scope.clientId,
        specialist_id: scope.specialistId,
        [PRODUCT_FIELD[scope.productType!]]: scope.productId,
        removed_at: null,
        status: { in: ACTIVE_PROCESS_STATUSES },
      };
  if (excludeProcessId) where.id = { not: excludeProcessId };

  const existing = await tx.process.findFirst({
    where,
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
      specialist: { select: { email: true } },
    },
  });
  if (existing) {
    const owned =
      options?.authenticatedClientId !== undefined &&
      options.authenticatedClientId === scope.clientId &&
      existing.client_id === scope.clientId;
    const appointment =
      owned && existing.appointment?.client_id === scope.clientId
        ? existing.appointment
        : null;
    const snapshot: ActiveProcessSnapshot = {
      process_id: existing.id,
      appointment_id: appointment?.id ?? null,
      appointment_status: appointment?.status ?? null,
      scheduling_method: appointment?.scheduling_method ?? null,
      appointment_datetime: appointment?.appointment_datetime ?? null,
      ...(appointment?.scheduling_method ===
        AppointmentSchedulingMethod.EMAIL && existing.specialist?.email
        ? { specialist_contact_email: existing.specialist.email }
        : {}),
    };
    throw new ConflictException({
      success: false,
      error: {
        code: 'ACTIVE_PROCESS_EXISTS',
        message: isConsultancy
          ? 'Já existe consultoria ativa entre este cliente e este especialista.'
          : 'Já existe processo ativo para este cliente com este produto.',
        ...(owned ? { details: { existing_request: snapshot } } : {}),
      },
    });
  }
}

export async function lockAndAssertNoActiveProcess(
  tx: any,
  scope: ActiveProcessScope,
  excludeProcessId?: string,
  options?: ActiveProcessConflictOptions,
): Promise<void> {
  await acquireActiveProcessDedupLock(tx, scope);
  await assertNoActiveProcess(tx, scope, excludeProcessId, options);
}
