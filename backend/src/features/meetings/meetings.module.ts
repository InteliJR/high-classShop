import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { NotificationModule } from 'src/features/notifications/notification.module';
import { MeetingReminderService } from './meeting-reminder.service';

@Module({
  imports: [ConfigModule, NotificationModule],
  controllers: [MeetingsController],
  providers: [MeetingsService, MeetingReminderService],
})
export class MeetingsModule {}
