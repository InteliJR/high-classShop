import { Prisma, ProductCurrency, ProductType } from '@prisma/client';
import { AircraftsService } from '../aircrafts/aircrafts.service';
import { BoatsService } from '../boats/boats.service';
import { CarsService } from '../cars/cars.service';

describe('product REST monetary updates', () => {
  it.each([
    [ProductType.CAR, 'car', CarsService],
    [ProductType.BOAT, 'boat', BoatsService],
    [ProductType.AIRCRAFT, 'aircraft', AircraftsService],
  ] as const)(
    'routes %s updates through the shared transaction lock',
    async (productType, delegateName, ServiceClass) => {
      const current = {
        id: 'product-1',
        valor: new Prisma.Decimal('100000.00'),
        currency: ProductCurrency.BRL,
        images: [],
      };
      const rootFindUnique = jest.fn().mockResolvedValue(current);
      const rootUpdate = jest.fn().mockResolvedValue(current);
      const txFindUnique = jest.fn().mockResolvedValue(current);
      const txUpdate = jest.fn().mockResolvedValue({
        ...current,
        valor: new Prisma.Decimal('110000.00'),
      });
      const txLock = jest.fn().mockResolvedValue([{ locked: null }]);
      const tx = {
        $queryRaw: txLock,
        process: { findFirst: jest.fn().mockResolvedValue(null) },
        [delegateName]: { findUnique: txFindUnique, update: txUpdate },
      };
      const prisma = {
        process: { findFirst: jest.fn().mockResolvedValue(null) },
        [delegateName]: { findUnique: rootFindUnique, update: rootUpdate },
        $transaction: jest.fn(async (callback) => callback(tx)),
      } as any;
      const service = new ServiceClass(prisma, {} as any);

      await service.update('product-1', { valor: 110000 } as any);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txLock).toHaveBeenCalledTimes(1);
      expect(txLock.mock.calls[0][1]).toBe(
        `product-money:${productType}:product-1`,
      );
      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: { valor: 110000 },
      });
      expect(rootUpdate).not.toHaveBeenCalled();
    },
  );
});
