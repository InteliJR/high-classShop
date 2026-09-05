import { NotFoundException } from '@nestjs/common';
import { AircraftsService } from '../aircrafts/aircrafts.service';
import { BoatsService } from '../boats/boats.service';
import { CarsService } from '../cars/cars.service';

describe('product removal not-found semantics', () => {
  it.each([
    ['car', CarsService],
    ['boat', BoatsService],
    ['aircraft', AircraftsService],
  ])('preserves the 404 emitted by the shared lock helper for %s', async (
    delegateName,
    Service,
  ) => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      [delegateName]: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      process: { findFirst: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: unknown) => unknown) =>
        callback(tx),
      ),
    };
    const service = new Service(prisma as any, {} as any);

    await expect(service.remove('missing-product')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
