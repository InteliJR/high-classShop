import { IsEnum, IsOptional, MaxLength } from 'class-validator';
import { StatusAgendamento } from '@prisma/client';

/**
 * DTO para atualizar status do agendamento via PUT /api/appointments/:id/status
 *
 * Fluxo de status:
 * 1. SCHEDULED (padrão ao criar)
 * 2. COMPLETED (quando reunião ocorre) → Move Process para NEGOTIATION (se estava em SCHEDULING)
 * 3. CANCELLED (somente enquanto o Process ainda está em SCHEDULING)
 *
 * Frontend:
 * - Botão "Confirmar realização" (especialista) → status = COMPLETED
 * - Botão "Cancelar agendamento" (ambos) → status = CANCELLED
 * - Apenas participantes (client/specialist) ou ADMIN podem atualizar
 */
export class UpdateAppointmentStatusDto {
  /**
   * Novo status do agendamento
   * Valores permitidos: SCHEDULED, COMPLETED, CANCELLED
   *
   * Transições permitidas:
   * - SCHEDULED → COMPLETED: move Process para NEGOTIATION
   * - PENDING/SCHEDULED → CANCELLED: cancela enquanto o Process está em SCHEDULING
   * - COMPLETED ou Process em NEGOTIATION+: cancelamento rejeitado
   * - CANCELLED → SCHEDULED: não permitido por esta rota
   *
   * Backend validará:
   * - Transições lógicas (ex: não voltar de COMPLETED para SCHEDULED sem razão)
   * - Se status=COMPLETED, o appointment ainda está SCHEDULED
   * - Se status=CANCELLED, o Process vinculado ainda está em SCHEDULING
   */
  @IsEnum(StatusAgendamento, {
    message: 'status deve ser SCHEDULED, COMPLETED ou CANCELLED',
  })
  status: StatusAgendamento;

  /**
   * Anotações/motivo da atualização (opcional)
   * Máximo 500 caracteres
   *
   * Exemplos:
   * - "Reunião concluída com sucesso"
   * - "Cliente pediu cancelamento"
   * - "Especialista indisponível"
   * - "Test drive realizado, produto não atendeu expectativas"
   *
   * Frontend:
   * - Ao marcar como COMPLETED: sugerir "Reunião concluída com sucesso"
   * - Ao cancelar: pedir motivo do cancelamento
   * - Campo opcional, mas recomendado preencher para auditoria
   * - Para consultorias com motivo registrado, não pode substituir o motivo.
   *   Observações do atendimento devem ser registradas no processo.
   */
  @IsOptional()
  @MaxLength(500, { message: 'notes não pode ter mais que 500 caracteres' })
  notes?: string;
}
