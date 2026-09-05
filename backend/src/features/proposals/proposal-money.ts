import { Prisma } from '@prisma/client';

export function calculateMinimumProposalValue(
  productValue: Prisma.Decimal,
  percentage: number,
): Prisma.Decimal {
  return productValue
    .mul(new Prisma.Decimal(percentage))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
