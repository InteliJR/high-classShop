import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { NotificationModule } from 'src/features/notifications/notification.module';
import { MeetingReminderService } from './meeting-reminder.service';
import { GoogleMeetOAuthService } from './google-meet-oauth.service';
import { GoogleMeetOAuthController } from './google-meet-oauth.controller';

@Module({
  imports: [ConfigModule, NotificationModule],
  controllers: [MeetingsController, GoogleMeetOAuthController],
  providers: [MeetingsService, MeetingReminderService, GoogleMeetOAuthService],
})
export class MeetingsModule {}
