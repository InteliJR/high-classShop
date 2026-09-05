import { Prisma } from '@prisma/client';
import { calculateMinimumProposalValue } from './proposal-money';

describe('calculateMinimumProposalValue', () => {
  it.each([
    ['333.33', 0.8, '266.66'],
    ['100.01', 0.5, '50.01'],
  ])(
    'rounds %s × %s to cents with ROUND_HALF_UP',
    (productValue, percentage, expected) => {
      expect(
        calculateMinimumProposalValue(
          new Prisma.Decimal(productValue),
          percentage,
        ).toFixed(2),
      ).toBe(expected);
    },
  );
});
