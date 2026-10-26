import { ProductType } from '@prisma/client';
import { DriveImportService } from './drive-import.service';

describe('DriveImportService fencing', () => {
  it('propaga perda do lease depois do upload e não persiste a imagem', async () => {
    const prisma = {
      car_image: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const s3 = {
      uploadBuffer: jest.fn().mockResolvedValue('drive-import/car/key.jpg'),
      deleteObjects: jest.fn().mockResolvedValue(undefined),
    } as any;
    const config = {
      get: jest.fn().mockReturnValue('drive-api-key'),
    } as any;
    const service = new DriveImportService(prisma, s3, config);
    jest.spyOn(service as any, 'listPublicFolderImages').mockResolvedValue([
      { id: 'file-1', name: 'photo.jpg', mimeType: 'image/jpeg' },
    ]);
    jest.spyOn(service as any, 'downloadDriveFile').mockResolvedValue({
      buffer: Buffer.from('image'),
      contentType: 'image/jpeg',
    });
    jest.spyOn(service as any, 'sleepBetweenDownloads').mockResolvedValue(undefined);
    let checks = 0;
    const assertActive = jest.fn(async () => {
      checks += 1;
      if (checks >= 5) throw new Error('lease perdido');
    });

    await expect(
      service.importImagesForProductFromFolder({
        folder_url: 'valid-folder-id',
        product_type: ProductType.CAR,
        product_id: '11111111-1111-4111-8111-111111111111',
        assert_active: assertActive,
        import_job_fence: {
          job_id: '22222222-2222-4222-8222-222222222222',
          lease_token: '33333333-3333-4333-8333-333333333333',
        },
      }),
    ).rejects.toThrow('lease perdido');

    expect(s3.uploadBuffer).toHaveBeenCalledTimes(1);
    expect(prisma.car_image.create).not.toHaveBeenCalled();
    expect(s3.deleteObjects).toHaveBeenCalledWith([
      'drive-import/car/key.jpg',
    ]);
    expect(assertActive).toHaveBeenCalledTimes(6);
    expect(s3.uploadBuffer.mock.calls[0][1]).toContain(
      '/33333333-3333-4333-8333-333333333333/',
    );
  });

  it('troca referências em transação fenced antes de apagar chaves antigas', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'job-1' }]),
      car_image: {
        findMany: jest.fn().mockResolvedValue([{ image_url: 'old-key.jpg' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;
    const prisma = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as any;
    const s3 = {
      uploadBuffer: jest.fn().mockResolvedValue('new-versioned-key.jpg'),
      deleteObjects: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new DriveImportService(
      prisma,
      s3,
      { get: jest.fn().mockReturnValue('drive-api-key') } as any,
    );
    jest.spyOn(service as any, 'listPublicFolderImages').mockResolvedValue([
      { id: 'file-1', name: 'photo.jpg', mimeType: 'image/jpeg' },
    ]);
    jest.spyOn(service as any, 'downloadDriveFile').mockResolvedValue({
      buffer: Buffer.from('image'),
      contentType: 'image/jpeg',
    });
    jest.spyOn(service as any, 'sleepBetweenDownloads').mockResolvedValue(undefined);
    const assertActive = jest.fn().mockResolvedValue(undefined);

    await expect(
      service.importImagesForProductFromFolder({
        folder_url: 'valid-folder-id',
        product_type: ProductType.CAR,
        product_id: '11111111-1111-4111-8111-111111111111',
        assert_active: assertActive,
        import_job_fence: {
          job_id: '22222222-2222-4222-8222-222222222222',
          lease_token: '33333333-3333-4333-8333-333333333333',
        },
      }),
    ).resolves.toMatchObject({ uploaded: 1, failed: 0 });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.car_image.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          image_url: 'new-versioned-key.jpg',
          is_primary: true,
        }),
      ],
    });
    expect(s3.deleteObjects).toHaveBeenLastCalledWith(['old-key.jpg']);
  });
});
