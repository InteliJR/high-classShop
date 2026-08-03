import { CarsService } from './cars.service';

describe('CarsService — UUID do produto', () => {
  it('consulta o carro pelo UUID recebido', async () => {
    const carId = '11111111-1111-4111-8111-111111111111';
    const findUnique = jest.fn().mockResolvedValue({
      id: carId,
      images: [],
    });
    const service = new CarsService(
      { car: { findUnique } } as any,
      {} as any,
      {} as any,
    );

    await service.findOne(carId);

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: carId },
      include: { images: true },
    });
  });
});
