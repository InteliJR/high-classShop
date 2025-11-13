
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
  }),
);

app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });
  // Aumenta o limite de tamanho do payload JSON para aceitar imagens em base64
  app.use(require('express').json({ limit: '50mb' }));
  app.use(require('express').urlencoded({ limit: '50mb', extended: true }));
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  app.use(cookieParser());
  await app.listen(3000);
}
bootstrap();
