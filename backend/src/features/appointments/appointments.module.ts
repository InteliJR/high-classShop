import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * AppointmentsModule
 *
 * Módulo que encapsula toda lógica de agendamentos (Appointments)
 * Integração com Calendly (Opção C - simplificada)
 *
 * Exporta:
 * - AppointmentsService: para uso por outros módulos (opcional)
 *
 * Dependências:
 * - PrismaService: acesso ao banco de dados
 * - AuthGuard: autenticação (aplicado no controller)
 *
 * Rotas expostas:
 * - GET    /api/appointments              → listar com filtros
 * - POST   /api/appointments              → criar novo agendamento
 * - GET    /api/appointments/:id          → obter detalhes
 * - PUT    /api/appointments/:id/status   → atualizar status
 */
@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService, PrismaService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
