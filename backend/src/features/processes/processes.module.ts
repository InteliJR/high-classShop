import { Module } from '@nestjs/common';
import { ProcessesService } from './processes.service';
import { ProcessesController } from './processes.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationModule } from 'src/features/notifications/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [ProcessesController],
  providers: [ProcessesService, PrismaService],
})
export class ProcessesModule {}
