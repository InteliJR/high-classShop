import { ConflictException } from '@nestjs/common';
import { ProcessStatus, ProductType } from '@prisma/client';

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

const PRODUCT_FIELD: Record<ProductType, 'car_id' | 'boat_id' | 'aircraft_id'> = {
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
): Promise<void> {
  const isConsultancy = !scope.productType || !scope.productId;
  const where: Record<string, unknown> = isConsultancy
    ? {
        client_id: scope.clientId,
        specialist_id: scope.specialistId,
        product_type: null,
        status: { in: ACTIVE_PROCESS_STATUSES },
      }
    : {
        client_id: scope.clientId,
        specialist_id: scope.specialistId,
        [PRODUCT_FIELD[scope.productType!]]: scope.productId,
        status: { in: ACTIVE_PROCESS_STATUSES },
      };
  if (excludeProcessId) where.id = { not: excludeProcessId };

  const existing = await tx.process.findFirst({ where });
  if (existing) {
    throw new ConflictException(
      isConsultancy
        ? 'Já existe consultoria ativa entre este cliente e este especialista.'
        : 'Já existe processo ativo para este cliente com este produto.',
    );
  }
}

export async function lockAndAssertNoActiveProcess(
  tx: any,
  scope: ActiveProcessScope,
  excludeProcessId?: string,
): Promise<void> {
  await acquireActiveProcessDedupLock(tx, scope);
  await assertNoActiveProcess(tx, scope, excludeProcessId);
}
