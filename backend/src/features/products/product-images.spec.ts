import { CarsService } from '../cars/cars.service';
import { BoatsService } from '../boats/boats.service';
import { AircraftsService } from '../aircrafts/aircrafts.service';

describe.each([
  ['car', CarsService, 'car_image'],
  ['boat', BoatsService, 'boat_image'],
  ['aircraft', AircraftsService, 'aircraft_image'],
] as const)('%s image upload and reopening', (model, Service, imageModel) => {
  it('stores image keys and primary flags, then signs those same keys on reopening', async () => {
    const imageRecords: any[] = [];
    const prisma = {
      [model]: {
        create: jest.fn().mockResolvedValue({ id: 'product-1' }),
        findUnique: jest.fn(async () => ({
          id: 'product-1',
          images: imageRecords,
        })),
      },
      [imageModel]: {
        create: jest.fn(async ({ data }) => {
          imageRecords.push(data);
          return data;
        }),
      },
    };
    const s3 = {
      uploadImageAuto: jest.fn(async (_data, key) => key),
      getSignedUrl: jest.fn(
        async (key) => `https://images.example.com/${key}?signature=fresh`,
      ),
    };
    const service = new Service(prisma as any, s3 as any);
    const images = [
      { data: 'data:image/png;base64,aW1hZ2U=', is_primary: false },
      {
        data: 'https://images.example.com/original?signature=old',
        is_primary: true,
      },
    ];
    await service.create({ marca: 'Test', modelo: 'Test', images } as any);

    expect(s3.uploadImageAuto).toHaveBeenCalledTimes(2);
    expect(s3.uploadImageAuto.mock.calls.map(([data]) => data)).toEqual(
      images.map((image) => image.data),
    );
    expect(imageRecords.map((image) => image.is_primary)).toEqual([
      false,
      true,
    ]);
    expect(
      imageRecords.every((image) => !image.image_url.startsWith('https:')),
    ).toBe(true);

    const reopened = await service.findOne('product-1');
    expect(s3.getSignedUrl.mock.calls.map(([key]) => key)).toEqual(
      imageRecords.map((image) => image.image_url),
    );
    expect(reopened.images?.map((image) => image.image_url)).toEqual(
      imageRecords.map(
        (image) =>
          `https://images.example.com/${image.image_url}?signature=fresh`,
      ),
    );
    expect(reopened.images?.map((image) => image.is_primary)).toEqual([
      false,
      true,
    ]);
  });
});
