import {
  AppointmentSchedulingMethod,
  ProductCurrency,
  ProcessStatus,
  ProductType,
  StatusAgendamento,
} from '@prisma/client';
import { Expose, Type } from 'class-transformer';

/** Processo do cliente no produto; histórico expõe apenas status e data. */
export interface ProductProcessSummary {
  id: string;
  status: ProcessStatus;
  is_active: boolean;
  status_history: { status: ProcessStatus; changed_at: Date }[];
}

/**
 * exists indica processo ativo (trava anti-duplicidade); process traz o ativo
 * ou, sem ativo, o encerrado mais recente. Campos de agendamento só para
 * agendamento vigente (PENDING/SCHEDULED).
 */
export type ExistingAppointmentCheck =
  | { exists: false; process: ProductProcessSummary | null }
  | {
      exists: true;
      appointment_id: string | null;
      process_id: string;
      appointment_status: StatusAgendamento | null;
      scheduling_method: AppointmentSchedulingMethod | null;
      appointment_datetime: Date | null;
      specialist_contact_email?: string;
      process: ProductProcessSummary;
    };

export interface ActiveProcessSnapshot {
  process_id: string;
  appointment_id: string | null;
  appointment_status: StatusAgendamento | null;
  scheduling_method: AppointmentSchedulingMethod | null;
  appointment_datetime: Date | null;
  specialist_contact_email?: string;
}

/**
 * DTO aninhado: dados do cliente no agendamento
 * Contém informações mínimas necessárias para exibição
 */
export class ClientResponseDto {
  /**
   * ID do cliente (UUID)
   */
  @Expose()
  id: string;

  /**
   * Nome completo do cliente
   */
  @Expose()
  name: string;

  /**
   * Sobrenome do cliente
   */
  @Expose()
  surname: string;

  /**
   * Email do cliente (pode ser usado para notificações)
   */
  @Expose()
  email: string;
}

/**
 * DTO aninhado: dados do especialista no agendamento
 * Contém informações mínimas necessárias para exibição
 */
export class SpecialistResponseDto {
  /**
   * ID do especialista (UUID)
   */
  @Expose()
  id: string;

  /**
   * Nome completo do especialista
   */
  @Expose()
  name: string;

  /**
   * Sobrenome do especialista
   */
  @Expose()
  surname: string;

  /**
   * Especialidade do especialista
   * Valores: CAR, BOAT, AIRCRAFT
   */
  @Expose()
  speciality?: ProductType | null;

  /**
   * Link do Calendly (se disponível)
   * Usado para redirecionar cliente para agendar na plataforma Calendly
   * Exemplo: "https://calendly.com/maria-especialista"
   * Pode ser null se não configurado
   */
  @Expose()
  calendly_url?: string | null;
}

/**
 * DTO aninhado: dados do produto no agendamento
 * Contém informações essenciais para identificação do produto
 */
export class ProductResponseDto {
  /**
   * ID do produto (inteiro, pode ser car_id, boat_id ou aircraft_id)
   * Usado junto com product_type para identificar único
   */
  @Expose()
  id: string;

  /**
   * Tipo de produto
   * Valores: CAR, BOAT, AIRCRAFT
   * Indica qual tabela contém o produto
   */
  @Expose()
  product_type: ProductType;

  /**
   * Marca do veículo/embarcação/aeronave
   * Exemplos: Ferrari, Bertram, Gulfstream
   */
  @Expose()
  marca: string;

  /**
   * Modelo do veículo/embarcação/aeronave
   * Exemplos: F8 Tributo, 54 Convertible, GIV
   */
  @Expose()
  modelo: string;

  /**
   * Valor/Preço do produto em decimal
   * Formato: número com até 2 casas decimais
   * Exemplo: 2850000.00
   */
  @Expose()
  valor: number | string; // Decimal do Prisma pode ser number ou string

  @Expose()
  currency: ProductCurrency;
}

/**
 * DTO de resposta para um agendamento
 * Usado em todas as respostas que retornam dados de Appointment
 *
 * Contém:
 * - Dados básicos do agendamento
 * - Dados do cliente (nested)
 * - Dados do especialista (nested)
 * - Dados do produto (nested, conforme tipo: Car/Boat/Aircraft)
 * - Timestamps para auditoria
 *
 * Frontend:
 * - appointment_datetime vem em UTC ISO 8601
 * - Converter para horário local do usuário ao exibir
 * - Exemplo: "2024-10-10T14:00:00Z" → 14:00 (São Paulo, -03:00)
 */
export class AppointmentResponseEntity {
  @Expose()
  process_id?: string;

  /** Contato liberado somente ao cliente autenticado no fluxo EMAIL. */
  @Expose()
  specialist_contact_email?: string;

  /**
   * ID único do agendamento (UUID)
   */
  @Expose()
  id: string;

  /**
   * Data e hora do agendamento em UTC (ISO 8601)
   * Exemplo: "2024-10-10T14:00:00Z"
   * Pode ser null para agendamentos PENDING (data ainda não definida)
   *
   * Frontend DEVE converter para horário local:
   * - Receber: "2024-10-10T14:00:00Z" (UTC)
   * - Converter: 14:00 (São Paulo, UTC-3) = 11:00 UTC (inversamente)
   * - Exibir: "10/10/2024 - 14:00"
   */
  @Expose()
  appointment_datetime: Date | null;

  /**
   * Status atual do agendamento
   * Valores: SCHEDULED, COMPLETED, CANCELLED
   */
  @Expose()
  status: StatusAgendamento;

  @Expose()
  scheduling_method?: AppointmentSchedulingMethod | null;

  @Expose()
  specialist_rescheduled_at?: Date | null;

  @Expose()
  specialist_rescheduled_from?: Date | null;

  /**
   * Anotações do agendamento
   * Pode ser null
   */
  @Expose()
  notes?: string;

  @Expose()
  calendly_event_uri?: string | null;

  @Expose()
  calendly_invitee_uri?: string | null;

  @Expose()
  calendly_scheduled_at?: Date | null;

  @Expose()
  calendly_last_sync_at?: Date | null;

  @Expose()
  calendly_sync_status?: string;

  /**
   * Cliente que agendou
   * Dados aninhados com informações essenciais
   */
  @Expose()
  @Type(() => ClientResponseDto)
  client: ClientResponseDto;

  /**
   * Especialista agendado
   * Dados aninhados com informações essenciais
   */
  @Expose()
  @Type(() => SpecialistResponseDto)
  specialist: SpecialistResponseDto;

  /**
   * Produto relacionado (Car, Boat ou Aircraft)
   * Dados aninhados conforme tipo
   */
  @Expose()
  @Type(() => ProductResponseDto)
  product: ProductResponseDto;

  /**
   * Data de criação do agendamento (ISO 8601 UTC)
   * Usado para auditoria e logging
   */
  @Expose()
  created_at: Date;

  /**
   * Data da última atualização (ISO 8601 UTC)
   * Usado para auditoria e otimistic locking (se implementado)
   */
  @Expose()
  updated_at: Date;
}
