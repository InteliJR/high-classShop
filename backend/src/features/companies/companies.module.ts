import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { AwsModule } from 'src/aws/aws.module';
import { LogoSanitizerService } from 'src/shared/services/logo-sanitizer.service';

@Module({
  imports: [
    AwsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.getOrThrow('JWT_SECRET_REFERRAL'),
      }),
    }),
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService, LogoSanitizerService],
})
export class CompaniesModule {}
