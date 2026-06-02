import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SpecialistsService } from './specialists.service';
import { SpecialistsController } from './specialists.controller';
import { AwsModule } from 'src/aws/aws.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [
    AwsModule,
    NotificationModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.getOrThrow('JWT_SECRET_REFERRAL'),
      }),
    }),
  ],
  controllers: [SpecialistsController],
  providers: [SpecialistsService],
})
export class SpecialistsModule {}
