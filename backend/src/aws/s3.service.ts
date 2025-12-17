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
   * Faz o upload de uma imagem em base64 para o bucket S3.
   * @param base64Data String base64 da imagem (com ou sem prefixo data:image/...)
   * @param key O nome/caminho completo do ficheiro no bucket.
   * @returns A 'key' do objeto salvo.
   */
  async uploadBase64Image(base64Data: string, key: string): Promise<string> {
    // Remove o prefixo "data:image/...;base64," se existir
    const base64Match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    let buffer: Buffer;
    let contentType = 'image/jpeg'; // default

    if (base64Match) {
      const imageType = base64Match[1]; // jpeg, png, etc
      const base64Content = base64Match[2];
      buffer = Buffer.from(base64Content, 'base64');
      contentType = `image/${imageType}`;
    } else {
      // Assume que já é base64 puro
      buffer = Buffer.from(base64Data, 'base64');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    try {
      await this.s3Client.send(command);
      return key;
    } catch (error) {
      console.error('Failed to upload base64 image to S3', error);
      throw new InternalServerErrorException('Failed to upload image.');
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

  /**
   * Faz o upload de uma imagem a partir de uma URL externa para o bucket S3.
   * @param imageUrl URL da imagem externa
   * @param key O nome/caminho completo do ficheiro no bucket.
   * @returns A 'key' do objeto salvo.
   */
  async uploadFromUrl(imageUrl: string, key: string): Promise<string> {
    try {
      // Fetch da imagem
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ImageBot/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      // Validar que é uma imagem
      if (!contentType.startsWith('image/')) {
        throw new Error(`URL não é uma imagem válida. Content-Type: ${contentType}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Limite de 10MB
      if (buffer.length > 10 * 1024 * 1024) {
        throw new Error('Imagem muito grande. Limite: 10MB');
      }

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);
      return key;
    } catch (error) {
      console.error('Failed to upload image from URL to S3', error);
      throw new InternalServerErrorException(`Failed to upload image from URL: ${error.message}`);
    }
  }

  /**
   * Detecta se o valor é uma URL ou base64 e faz upload apropriado.
   * @param imageData URL ou string base64 da imagem
   * @param key O nome/caminho completo do ficheiro no bucket.
   * @returns A 'key' do objeto salvo.
   */
  async uploadImageAuto(imageData: string, key: string): Promise<string> {
    // Detecta se é uma URL (http:// ou https://)
    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      return this.uploadFromUrl(imageData, key);
    }
    
    // Caso contrário, assume que é base64
    return this.uploadBase64Image(imageData, key);
  }
}