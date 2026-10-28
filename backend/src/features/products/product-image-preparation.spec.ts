import {
  cleanupPreparedProductImages,
  prepareProductImages,
} from './product-image-preparation';
import { Logger } from '@nestjs/common';

describe('product image preparation', () => {
  it('remove somente uploads concluídos se um upload posterior falhar', async () => {
    const s3 = {
      uploadImageAuto: jest
        .fn()
        .mockResolvedValueOnce('cars/product/new-0.jpg')
        .mockRejectedValueOnce(new Error('upload unavailable')),
      deleteObjects: jest.fn().mockResolvedValue(undefined),
    } as any;

    await expect(
      prepareProductImages(s3, 'cars', 'product', [
        { data: 'first', is_primary: true },
        { data: 'second', is_primary: false },
      ]),
    ).rejects.toThrow('upload unavailable');

    expect(s3.deleteObjects).toHaveBeenCalledWith([
      'cars/product/new-0.jpg',
    ]);
  });

  it('não chama S3 para uma compensação vazia', async () => {
    const s3 = { deleteObjects: jest.fn() } as any;

    await cleanupPreparedProductImages(s3, []);

    expect(s3.deleteObjects).not.toHaveBeenCalled();
  });

  it('não mascara a falha original se a limpeza compensatória também falhar', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const s3 = {
      uploadImageAuto: jest
        .fn()
        .mockResolvedValueOnce('cars/product/new-0.jpg')
        .mockRejectedValueOnce(new Error('upload unavailable')),
      deleteObjects: jest.fn().mockRejectedValue(new Error('cleanup unavailable')),
    } as any;

    await expect(
      prepareProductImages(s3, 'cars', 'product', [
        { data: 'first', is_primary: true },
        { data: 'second', is_primary: false },
      ]),
    ).rejects.toThrow('upload unavailable');
    logSpy.mockRestore();
  });

  it('gera chaves distintas para preparações concorrentes mesmo no mesmo milissegundo', async () => {
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(123456789);
    const uploadedKeys: string[] = [];
    const s3 = {
      uploadImageAuto: jest.fn(async (_data: string, key: string) => {
        uploadedKeys.push(key);
        return key;
      }),
      deleteObjects: jest.fn(),
    } as any;

    await Promise.all([
      prepareProductImages(s3, 'cars', 'same-product', [
        { data: 'first', is_primary: true },
      ]),
      prepareProductImages(s3, 'cars', 'same-product', [
        { data: 'second', is_primary: true },
      ]),
    ]);

    expect(new Set(uploadedKeys).size).toBe(2);
    dateSpy.mockRestore();
  });
});
