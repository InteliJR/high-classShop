import { Module } from '@nestjs/common';
import { ProcessesService } from './processes.service';
import { ProcessesController } from './processes.controller';
import { NotificationModule } from 'src/features/notifications/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [ProcessesController],
  providers: [ProcessesService],
})
export class ProcessesModule {}
