import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { AwsModule } from 'src/aws/aws.module';

/**
 * NotificationModule - Módulo de Notificações por Email
 * 
 * Responsabilidades:
 * - Prover NotificationService para outros módulos
 * - Importar AwsModule para acesso ao SesService
 * - Importar ConfigModule para variáveis de ambiente
 * 
 * Uso:
 * Importe este módulo em qualquer feature module que precise enviar notificações:
 * - ProcessesModule
 * - ProposalsModule
 * - ContractsModule
 * - DocusignModule (webhook)
 * - AppointmentsModule
 */
@Module({
  imports: [
    ConfigModule, // Para env variables (EMAIL_FROM, FRONTEND_URL, etc)
    AwsModule,    // Para SesService (acesso ao AWS SES)
  ],
  providers: [NotificationService],
  exports: [NotificationService], // Exporta APENAS NotificationService
})
export class NotificationModule {}
