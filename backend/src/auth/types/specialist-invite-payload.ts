import type { ProductType } from '@prisma/client';

export type SpecialistInvitePayload = {
  type: 'SPECIALIST_INVITE';
  email: string;
  speciality: ProductType;
  commission_rate?: number;
};
