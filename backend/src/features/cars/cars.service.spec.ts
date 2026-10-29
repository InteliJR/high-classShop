import { CarsService } from './cars.service';
import { Prisma, ProductCurrency } from '@prisma/client';
import { publicCarSelect } from 'src/shared/selects/public-catalog.select';

describe('CarsService — UUID do produto', () => {
  it('consulta o carro pelo UUID recebido', async () => {
    const carId = '11111111-1111-4111-8111-111111111111';
    const findUnique = jest.fn().mockResolvedValue({
      id: carId,
      valor: new Prisma.Decimal('1500000.01'),
      currency: ProductCurrency.BRL,
      images: [],
    });
    const service = new CarsService(
      { car: { findUnique } } as any,
      {} as any,
      {} as any,
    );

    const result = await service.findOne(carId);

    expect(result.valor).toBe(1500000.01);
    expect(result.currency).toBe(ProductCurrency.BRL);

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: carId },
      select: publicCarSelect,
    });
  });

  it('allows a non-monetary update while the car is in negotiation', async () => {
    const carId = '11111111-1111-4111-8111-111111111111';
    const currentCar = {
      id: carId,
      valor: new Prisma.Decimal('100000.00'),
      currency: ProductCurrency.BRL,
      images: [],
    };
    const findUnique = jest.fn().mockResolvedValue(currentCar);
    const update = jest.fn().mockResolvedValue(currentCar);
    const findFirst = jest.fn();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
      car: { findUnique, update },
      process: { findFirst },
    };
    const service = new CarsService(
      {
        car: { findUnique, update },
        process: { findFirst },
        $transaction: jest.fn(async (callback: any) => callback(tx)),
      } as any,
      {} as any,
    );

    await service.update(carId, { modelo: 'Novo modelo' });

    expect(findFirst).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: carId },
      data: { modelo: 'Novo modelo' },
    });
  });
});
