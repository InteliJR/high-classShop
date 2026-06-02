import { Module } from '@nestjs/common';
import { ConsultantsService } from './consultants.service';
import { ConsultantsController } from './consultants.controller';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [ConsultantsController],
  providers: [ConsultantsService],
})
export class ConsultantsModule {}
