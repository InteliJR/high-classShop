import { NestFactory, Reflector } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import cookieParser from 'cookie-parser';
import express, { Express } from 'express';

export async function createApp(): Promise<Express> {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

  const configuredFrontendUrl =
    process.env.FRONTEND_URL || 'http://localhost:5173';
  const allowedOrigins = [configuredFrontendUrl, 'http://localhost:5173'];

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['Set-Cookie'],
    optionsSuccessStatus: 204,
    credentials: true,
  });

  // Aumenta o limite de tamanho do payload JSON para aceitar imagens em base64
  // e preserva rawBody para validação de assinatura de webhooks (Calendly)
  app.use(
    express.json({
      limit: '50mb',
      verify: (req: any, _res: any, buf: Buffer) => {
        req.rawBody = buf.toString('utf8');
      },
    }),
  );
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.use(cookieParser());
  app.setGlobalPrefix('api');

  await app.init();
  return server;
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const server = await createApp();

  const port = process.env.PORT ?? 3000;
  server.listen(port, () => {
    logger.log(`Aplicação rodando na porta ${port}`);
    logger.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Erro ao inicializar aplicação:', error);
  process.exit(1);
});
