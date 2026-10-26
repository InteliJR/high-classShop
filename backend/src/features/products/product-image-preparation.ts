import { S3Service } from 'src/aws/s3.service';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

const logger = new Logger('ProductImagePreparation');

export type ProductImageInput = {
  data: string;
  is_primary: boolean;
};

export type PreparedProductImage = {
  image_url: string;
  is_primary: boolean;
};

export async function prepareProductImages(
  s3Service: S3Service,
  prefix: string,
  productId: string,
  images: ProductImageInput[] = [],
): Promise<PreparedProductImage[]> {
  const prepared: PreparedProductImage[] = [];
  try {
    for (let index = 0; index < images.length; index += 1) {
      const key = `${prefix}/${productId}/${randomUUID()}-${index}.jpg`;
      const imageUrl = await s3Service.uploadBase64Image(
        images[index].data,
        key,
      );
      prepared.push({
        image_url: imageUrl,
        is_primary: images[index].is_primary,
      });
    }
    return prepared;
  } catch (error) {
    await cleanupPreparedProductImages(s3Service, prepared);
    throw error;
  }
}

export async function cleanupPreparedProductImages(
  s3Service: S3Service,
  prepared: PreparedProductImage[],
): Promise<void> {
  if (prepared.length === 0) return;
  try {
    await s3Service.deleteObjects(prepared.map((image) => image.image_url));
  } catch (error) {
    logger.error(
      `Falha ao compensar ${prepared.length} upload(s) de produto`,
      error instanceof Error ? error.stack : undefined,
    );
  }
}
