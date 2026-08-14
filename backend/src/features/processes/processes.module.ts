import { Module } from '@nestjs/common';
import { ProcessesService } from './processes.service';
import { ProcessesController } from './processes.controller';
import { NotificationModule } from 'src/features/notifications/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [ProcessesController],
  providers: [ProcessesService],
  // Consultor e escritório abrem processos em nome do cliente reaproveitando
  // createOnBehalfOfClient em vez de duplicar a transação de criação.
  exports: [ProcessesService],
})
export class ProcessesModule {}
