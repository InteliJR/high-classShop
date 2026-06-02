import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { NotificationModule } from 'src/features/notifications/notification.module';

@Module({
  imports: [
    JwtModule.register({
      global: true,
    }),
    NotificationModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
})
export class AuthModule {}
