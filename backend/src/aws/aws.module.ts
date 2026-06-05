import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { S3Service } from './s3.service';
import { SesService } from './ses.service';

// Global pois o AuthGuard (registrado como APP_GUARD em AppModule) depende
// de S3Service para resolver `logoUrl` da empresa em cada requisição autenticada.
// Tornar global evita ter que importar AwsModule no AppModule e em cada feature.
@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
  ],
  providers: [S3Service, SesService],
  exports: [S3Service, SesService],
})
export class AwsModule {}