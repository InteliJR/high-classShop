import { ConflictException } from '@nestjs/common';
import {
  Prisma,
  ProcessStatus,
  ProductCurrency,
  ProductType,
} from '@prisma/client';
import { assertProductMonetaryFieldsUnlocked } from './product-monetary-lock';

const prisma = { process: { findFirst: jest.fn() } } as any;
const base = {
  productType: ProductType.CAR,
  productId: 'car-1',
  currentValue: new Prisma.Decimal('100000.00'),
  currentCurrency: ProductCurrency.BRL,
};

describe('assertProductMonetaryFieldsUnlocked', () => {
  beforeEach(() => {
    prisma.process.findFirst.mockReset();
  });

  it('blocks an effective value change during negotiation', async () => {
    prisma.process.findFirst.mockResolvedValue({ id: 'process-1' });

    let thrown: ConflictException | undefined;
    try {
      await assertProductMonetaryFieldsUnlocked(prisma, {
        ...base,
        nextValue: 110000,
      });
    } catch (error) {
      thrown = error as ConflictException;
    }

    expect(thrown).toBeInstanceOf(ConflictException);
    expect(thrown?.getStatus()).toBe(409);
    expect(thrown?.getResponse()).toEqual({
      code: 'PRODUCT_MONETARY_FIELDS_LOCKED',
      message:
        'Valor e moeda não podem ser alterados enquanto o produto estiver em negociação.',
    });
    expect(prisma.process.findFirst).toHaveBeenCalledWith({
      where: { car_id: 'car-1', status: ProcessStatus.NEGOTIATION },
      select: { id: true },
    });
  });

  it('does not query when value and currency are unchanged', async () => {
    await assertProductMonetaryFieldsUnlocked(prisma, {
      ...base,
      nextValue: 100000,
      nextCurrency: ProductCurrency.BRL,
    });

    expect(prisma.process.findFirst).not.toHaveBeenCalled();
  });

  it('allows non-monetary updates and monetary updates without active negotiation', async () => {
    prisma.process.findFirst.mockResolvedValue(null);

    await expect(
      assertProductMonetaryFieldsUnlocked(prisma, {
        ...base,
        nextCurrency: ProductCurrency.USD,
      }),
    ).resolves.toBeUndefined();
  });
});
