import { ConflictException } from '@nestjs/common';
import {
  Prisma,
  ProcessStatus,
  ProductCurrency,
  ProductType,
} from '@prisma/client';
import {
  assertProductMonetaryFieldsUnlocked,
  updateProductWithMonetaryLock,
} from './product-monetary-lock';

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

  it.each([
    [ProductType.CAR, 'car_id'],
    [ProductType.BOAT, 'boat_id'],
    [ProductType.AIRCRAFT, 'aircraft_id'],
  ])('maps %s to its process foreign key', async (productType, foreignKey) => {
    prisma.process.findFirst.mockResolvedValue({ id: 'process-1' });

    await expect(
      assertProductMonetaryFieldsUnlocked(prisma, {
        ...base,
        productType,
        nextCurrency: ProductCurrency.USD,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.process.findFirst).toHaveBeenCalledWith({
      where: {
        [foreignKey]: 'car-1',
        status: ProcessStatus.NEGOTIATION,
      },
      select: { id: true },
    });
  });
});

describe('updateProductWithMonetaryLock', () => {
  it.each([
    [ProductType.CAR, 'car'],
    [ProductType.BOAT, 'boat'],
    [ProductType.AIRCRAFT, 'aircraft'],
  ])(
    'locks, re-reads and updates %s inside one transaction',
    async (productType, delegateName) => {
      const lock = jest.fn().mockResolvedValue([{ locked: null }]);
      const findUnique = jest.fn().mockResolvedValue({
        id: 'product-1',
        valor: new Prisma.Decimal('100000.00'),
        currency: ProductCurrency.BRL,
      });
      const findFirst = jest.fn().mockResolvedValue(null);
      const update = jest.fn().mockResolvedValue({ id: 'product-1' });
      const tx = {
        $queryRaw: lock,
        process: { findFirst },
        [delegateName]: { findUnique, update },
      };
      const transactionalPrisma = {
        $transaction: jest.fn(async (callback) => callback(tx)),
      } as any;

      await updateProductWithMonetaryLock(transactionalPrisma, {
        productType,
        productId: 'product-1',
        nextValue: 110000,
        nextCurrency: ProductCurrency.USD,
        data: { valor: 110000, currency: ProductCurrency.USD },
      });

      expect(transactionalPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(lock).toHaveBeenCalledTimes(1);
      expect(lock.mock.calls[0][1]).toBe(
        `product-money:${productType}:product-1`,
      );
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        select: { id: true, valor: true, currency: true },
      });
      expect(findFirst).toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: { valor: 110000, currency: ProductCurrency.USD },
      });
      expect(lock.mock.invocationCallOrder[0]).toBeLessThan(
        findUnique.mock.invocationCallOrder[0],
      );
      expect(findUnique.mock.invocationCallOrder[0]).toBeLessThan(
        update.mock.invocationCallOrder[0],
      );
    },
  );
});
