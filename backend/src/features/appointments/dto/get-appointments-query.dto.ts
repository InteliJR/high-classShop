import {
  IsOptional,
  IsEnum,
  Min,
  IsInt,
  IsDateString,
  IsUUID,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductType } from '@prisma/client';
import { StatusAgendamento } from '@prisma/client';

/**
 * DTO para query parameters do endpoint GET /api/appointments
 * Controla paginação, filtros e ordenação de agendamentos
 *
 * Frontend:
 * - Enviar date_from/date_to em formato YYYY-MM-DD (será convertido para UTC pelo backend)
 * - Os dados retornados estarão em UTC ISO 8601 (ex: "2024-10-10T14:00:00Z")
 * - Converter para horário local no frontend ao exibir ao usuário
 */
export class GetAppointmentsQueryDto {
  // ═══════════════════════════════════════════════════════════════════════════
  // PAGINAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Número da página (começa em 1)
   * Padrão: 1
   * Mínimo: 1
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page deve ser um número inteiro' })
  @Min(1, { message: 'page deve ser no mínimo 1' })
  page?: number = 1;

  /**
   * Quantidade de itens por página
   * Padrão: 20
   * Máximo: 100 (proteção contra query muito grande)
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit deve ser um número inteiro' })
  @Min(1, { message: 'limit deve ser no mínimo 1' })
  @Type(() => Number)
  limit?: number = 20;

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTROS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Status do agendamento
   * Valores: SCHEDULED, COMPLETED, CANCELLED
   * Opcional - se não fornecido, retorna todos os agendamentos
   */
  @IsOptional()
  @IsEnum(StatusAgendamento, {
    message: 'status deve ser SCHEDULED, COMPLETED ou CANCELLED',
  })
  status?: StatusAgendamento;

  /**
   * Data inicial para filtro (formato: YYYY-MM-DD)
   * Exemplo: 2024-10-10
   * Será convertido para UTC pelo backend
   * Opcional - se não fornecido, sem filtro de data inicial
   */
  @IsOptional()
  @IsDateString({}, { message: 'date_from deve estar no formato YYYY-MM-DD' })
  date_from?: string;

  /**
   * Data final para filtro (formato: YYYY-MM-DD)
   * Exemplo: 2024-10-31
   * Será convertido para UTC pelo backend
   * Opcional - se não fornecido, sem filtro de data final
   */
  @IsOptional()
  @IsDateString({}, { message: 'date_to deve estar no formato YYYY-MM-DD' })
  date_to?: string;

  /**
   * ID do cliente para filtro
   * UUID válido
   * Respeitará permissões: CUSTOMER vê apenas seus próprios, SPECIALIST vê seus clientes, ADMIN vê todos
   */
  @IsOptional()
  @IsUUID('4', { message: 'client_id deve ser um UUID válido' })
  client_id?: string;

  /**
   * ID do especialista para filtro
   * UUID válido
   * Respeitará permissões: SPECIALIST vê apenas seus próprios, ADMIN vê todos
   */
  @IsOptional()
  @IsUUID('4', { message: 'specialist_id deve ser um UUID válido' })
  specialist_id?: string;

  /**
   * Tipo de produto
   * Valores: CAR, BOAT, AIRCRAFT
   * Opcional - se não fornecido, retorna de todos os tipos
   */
  @IsOptional()
  @IsEnum(ProductType, {
    message: 'product_type deve ser CAR, BOAT ou AIRCRAFT',
  })
  product_type?: ProductType;

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDENAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Campo para ordenação
   * Valores: appointment_datetime (padrão), created_at
   * Padrão: appointment_datetime (agrupa agendamentos futuros primeiro)
   */
  @IsOptional()
  @IsIn(['appointment_datetime', 'created_at'], {
    message: 'sort deve ser appointment_datetime ou created_at',
  })
  sort?: string = 'appointment_datetime';

  /**
   * Direção de ordenação
   * Valores: ASC (crescente), DESC (decrescente)
   * Padrão: ASC (agendamentos mais antigos primeiro)
   */
  @IsOptional()
  @IsIn(['ASC', 'DESC'], { message: 'order deve ser ASC ou DESC' })
  order?: 'ASC' | 'DESC' = 'ASC';
}
