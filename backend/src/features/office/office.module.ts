import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AwsModule } from 'src/aws/aws.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { LogoSanitizerService } from 'src/shared/services/logo-sanitizer.service';
import { XlsxImportService } from 'src/shared/services/xlsx-import.service';
import { ConsultantInviteJobsService } from './consultant-invite-jobs.service';
import { OfficeController } from './office.controller';
import { OfficeService } from './office.service';

@Module({
  imports: [
    PrismaModule,
    AwsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: config.getOrThrow('JWT_SECRET_REFERRAL'),
      }),
    }),
  ],
  controllers: [OfficeController],
  providers: [
    OfficeService,
    ConsultantInviteJobsService,
    XlsxImportService,
    LogoSanitizerService,
  ],
})
export class OfficeModule {}
