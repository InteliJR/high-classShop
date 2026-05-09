import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CustomerAdvisorsController } from './customer-advisors.controller';
import { CustomerAdvisorsService } from './customer-advisors.service';
import { NotificationModule } from 'src/features/notifications/notification.module';

@Module({
  imports: [JwtModule, NotificationModule],
  controllers: [CustomerAdvisorsController],
  providers: [CustomerAdvisorsService],
  exports: [CustomerAdvisorsService],
})
export class CustomerAdvisorsModule {}
