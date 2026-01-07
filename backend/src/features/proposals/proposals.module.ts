import { Module } from '@nestjs/common';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';

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
  imports: [JwtModule],
  controllers: [ProposalsController],
  providers: [ProposalsService, PrismaService],
  exports: [ProposalsService],
})
export class ProposalsModule {}
