import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { S3Service } from './s3.service';
import { SesService } from './ses.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
  ],
  providers: [S3Service, SesService],
  exports: [S3Service, SesService],
})
export class AwsModule {}