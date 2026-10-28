import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, ProductCurrency } from '@prisma/client';
import { CarsService } from '../cars/cars.service';
import { BoatsService } from '../boats/boats.service';
import { AircraftsService } from '../aircrafts/aircrafts.service';

type ServiceFactory = (prisma: any) => {
  update(id: string, dto: any): Promise<unknown>;
};

const services: Array<[string, string, ServiceFactory]> = [
  ['carro', 'car', (prisma) => new CarsService(prisma, {} as any)],
  ['barco', 'boat', (prisma) => new BoatsService(prisma, {} as any)],
  ['aeronave', 'aircraft', (prisma) => new AircraftsService(prisma, {} as any)],
];

describe.each(services)('%s — preserva erros HTTP no update', (_label, delegateName, factory) => {
  const productId = '11111111-1111-4111-8111-111111111111';

  function prismaWith(currentProduct: unknown, activeProcess: unknown) {
    const delegate = {
      findUnique: jest.fn().mockResolvedValue(currentProduct),
      update: jest.fn(),
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      [delegateName]: delegate,
      process: { findFirst: jest.fn().mockResolvedValue(activeProcess) },
    };
    return {
      ...tx,
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
  }

  it('mantém NotFoundException em vez de converter para 500', async () => {
    const service = factory(prismaWith(null, null));

    await expect(service.update(productId, { modelo: 'Novo' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('mantém ConflictException da trava monetária em vez de converter para 500', async () => {
    const prisma = prismaWith(
      {
        id: productId,
        valor: new Prisma.Decimal('100'),
        currency: ProductCurrency.BRL,
      },
      { id: 'process-1' },
    );
    const service = factory(prisma);

    await expect(service.update(productId, { valor: 200 })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
