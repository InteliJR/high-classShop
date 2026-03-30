import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { NotificationModule } from 'src/features/notifications/notification.module';

@Module({
  imports: [ConfigModule, NotificationModule],
  controllers: [MeetingsController],
  providers: [MeetingsService],
})
export class MeetingsModule {}
