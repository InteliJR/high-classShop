import { IsEnum, IsOptional, MaxLength } from 'class-validator';
import { StatusAgendamento } from '@prisma/client';

/**
 * DTO para atualizar status do agendamento via PUT /api/appointments/:id/status
 *
 * Fluxo de status:
 * 1. SCHEDULED (padrão ao criar)
 * 2. COMPLETED (quando reunião ocorre) → Move Process para NEGOTIATION (se estava em SCHEDULING)
 * 3. CANCELLED (se cancelado)
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
   * - SCHEDULED → CANCELLED: cancela agendamento
   * - COMPLETED → CANCELLED: undo (reverter)
   * - CANCELLED → SCHEDULED: reativar (raramente usado)
   *
   * Backend validará:
   * - Transições lógicas (ex: não voltar de COMPLETED para SCHEDULED sem razão)
   * - Se status=COMPLETED, Process está em SCHEDULING ou NEGOTIATION
   * - Evitar conflito: se Process já está em NEGOTIATION, manter sem retroceder
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
   */
  @IsOptional()
  @MaxLength(500, { message: 'notes não pode ter mais que 500 caracteres' })
  notes?: string;
}
