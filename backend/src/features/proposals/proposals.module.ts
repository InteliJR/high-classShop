import { Module } from '@nestjs/common';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { JwtModule } from '@nestjs/jwt';
import { SettingsModule } from 'src/features/settings/settings.module';
import { NotificationModule } from 'src/features/notifications/notification.module';

/**
 * ProposalsModule
 *
 * Módulo responsável pelo gerenciamento de propostas de negociação
 *
 * Funcionalidades:
 * - Criar propostas de valor
 * - Aceitar/rejeitar propostas
 * - Listar histórico de propostas
 * - Validar regras de negócio (80% mínimo, alternância)
 */
@Module({
  imports: [JwtModule, SettingsModule, NotificationModule],
  controllers: [ProposalsController],
  providers: [ProposalsService],
  exports: [ProposalsService],
})
export class ProposalsModule {}
