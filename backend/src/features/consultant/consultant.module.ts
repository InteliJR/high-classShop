import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsultantController } from './consultant.controller';
import { ConsultantService } from './consultant.service';
import { ClientInviteJobsService } from './client-invite-jobs.service';
import { AwsModule } from 'src/aws/aws.module';
import { XlsxImportService } from 'src/shared/services/xlsx-import.service';

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
  controllers: [ConsultantController],
  providers: [ConsultantService, ClientInviteJobsService, XlsxImportService],
})
export class ConsultantModule {}
