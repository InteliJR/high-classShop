import { ProductType, StatusAgendamento } from '@prisma/client';
import { Expose, Type } from 'class-transformer';

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
  id: number;

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
  /**
   * ID único do agendamento (UUID)
   */
  @Expose()
  id: string;

  /**
   * Data e hora do agendamento em UTC (ISO 8601)
   * Exemplo: "2024-10-10T14:00:00Z"
   *
   * Frontend DEVE converter para horário local:
   * - Receber: "2024-10-10T14:00:00Z" (UTC)
   * - Converter: 14:00 (São Paulo, UTC-3) = 11:00 UTC (inversamente)
   * - Exibir: "10/10/2024 - 14:00"
   */
  @Expose()
  appointment_datetime: Date;

  /**
   * Status atual do agendamento
   * Valores: SCHEDULED, COMPLETED, CANCELLED
   */
  @Expose()
  status: StatusAgendamento;

  /**
   * Anotações do agendamento
   * Pode ser null
   */
  @Expose()
  notes?: string;

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
