import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.getOrThrow('AWS_BUCKET_NAME');
    this.s3Client = new S3Client({
      region: this.configService.getOrThrow('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.getOrThrow('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  /**
   * Faz o upload de um ficheiro PRIVADO para o bucket S3.
   * @param file O ficheiro recebido via Multer.
   * @param key O nome/caminho completo do ficheiro no bucket.
   * @returns Apenas a 'key' do objeto salvo, pois o URL será gerado sob demanda.
   */
  async uploadFile(file: Express.Multer.File, key: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await this.s3Client.send(command);
      return key; 
    } catch (error) {
      console.error('Failed to upload file to S3', error);
      throw new InternalServerErrorException('Failed to upload file.');
    }
  }

  /**
   * Gera um URL assinado e temporário para um objeto privado.
   * @param key A chave do objeto no S3.
   * @returns Um URL que expira após um tempo.
   */
  async getSignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      
      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
      return signedUrl;
    } catch (error) {
      console.error('Failed to get signed URL', error);
      throw new InternalServerErrorException('Failed to access file.');
    }
  }
}