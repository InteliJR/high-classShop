import { Prisma } from '@prisma/client';
import { AircraftsService } from '../aircrafts/aircrafts.service';
import { BoatsService } from '../boats/boats.service';
import { CarsService } from '../cars/cars.service';

describe.each([
  ['car', CarsService, 'getAllCars'],
  ['boat', BoatsService, 'getAllBoats'],
  ['aircraft', AircraftsService, 'getAllAircrafts'],
] as const)('%s price responses', (model, Service, listMethod) => {
  it.each([
    ['BRL', false],
    ['BRL', true],
    ['USD', false],
    ['USD', true],
  ] as const)(
    'keeps list/detail amounts numeric in %s (images: %s)',
    async (currency, hasImages) => {
      for (const input of [
        '950000.00',
        '1000000.00',
        '1500000.00',
        '950000.01',
        '1500000.50',
        '1500000.01',
      ]) {
        const record = {
          id: 'product-248',
          valor: new Prisma.Decimal(input),
          currency,
          images: hasImages
            ? [{ image_url: 'product/photo.jpg', is_primary: true }]
            : [],
        };
        const delegate = {
          findUnique: jest.fn().mockResolvedValue(record),
          findMany: jest.fn().mockResolvedValue([record]),
          count: jest.fn().mockResolvedValue(1),
          update: jest.fn(),
        };
        const prisma = {
          [model]: delegate,
          $transaction: jest.fn((operations) => Promise.all(operations)),
        };
        const s3 = {
          getSignedUrl: jest
            .fn()
            .mockResolvedValue('https://cdn.test/photo.jpg'),
        };
        const service = new Service(prisma as any, s3 as any);

        const detail = JSON.parse(
          JSON.stringify(await service.findOne(record.id)),
        );
        const list = await (service as any)[listMethod]({
          page: 1,
          perPage: 20,
          appliedFilters: {},
        });

        expect(typeof detail.valor).toBe('number');
        expect(detail.valor).toBe(Number(input));
        expect(detail.valor).toBe(list.data[0].valor);
        expect(detail.currency).toBe(currency);
        expect(list.data[0].currency).toBe(currency);
        expect(record.valor.equals(new Prisma.Decimal(input))).toBe(true);
        expect(delegate.update).not.toHaveBeenCalled();
      }
    },
  );
});
