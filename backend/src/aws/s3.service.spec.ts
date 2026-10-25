import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { S3Service } from './s3.service';

describe('S3Service product image uploads', () => {
  let service: S3Service;
  let send: jest.SpyInstance;

  beforeEach(() => {
    send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    service = new S3Service({
      getOrThrow: (name: string) =>
        ({
          AWS_BUCKET_NAME: 'test-bucket',
          AWS_REGION: 'us-east-1',
          AWS_ACCESS_KEY_ID: 'test',
          AWS_SECRET_ACCESS_KEY: 'test',
        })[name],
      get: () => undefined,
    } as unknown as ConfigService);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
    'image/vnd.microsoft.icon',
  ])('preserves the bytes and MIME type of a %s data URI', async (mime) => {
    const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const key = 'cars/product/primary.jpg';
    await expect(
      service.uploadImageAuto(
        `data:${mime};base64,${bytes.toString('base64')}`,
        key,
      ),
    ).resolves.toBe(key);
    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command.input).toMatchObject({
      Bucket: 'test-bucket',
      Key: key,
      Body: bytes,
      ContentType: mime,
    });
  });

  it('continues to accept raw base64', async () => {
    await service.uploadBase64Image('aW1hZ2U=', 'image.jpg');
    expect(send.mock.calls[0][0].input.Body).toEqual(Buffer.from('image'));
  });

  it.each([
    'https://example.com/image.jpg',
    'https://images.example.com/cars/photo.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=test',
    'data:image/svg+xml;base64,???',
    'data:text/plain;base64,aW1hZ2U=',
    '',
    '%%%',
  ])(
    'rejects invalid base64 instead of storing corrupted bytes: %s',
    async (data) => {
      await expect(
        service.uploadBase64Image(data, 'image.jpg'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('downloads an existing signed URL rather than decoding it as base64', async () => {
    const bytes = Buffer.from('original image bytes');
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(bytes, {
        headers: { 'content-type': 'image/png' },
      }),
    );
    // A URL assinada que voltou do formulário de edição era decodificada
    // como base64 até o primeiro "=", gerando arquivos pequenos e inválidos.
    const url = 'https://images.example.com/cars/photo.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=test';
    await service.uploadImageAuto(url, 'cars/product/replacement.jpg');
    expect(fetchMock).toHaveBeenCalledWith(url, expect.any(Object));
    expect(send.mock.calls[0][0].input).toMatchObject({
      Body: bytes,
      ContentType: 'image/png',
    });
  });
});
