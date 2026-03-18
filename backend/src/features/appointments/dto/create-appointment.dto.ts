import {
  IsUUID,
  IsEnum,
  IsOptional,
  MaxLength,
  IsInt,
  Min,
  ValidateIf,
} from 'class-validator';
import { ProductType } from '@prisma/client';

/**
 * DTO para criar novo agendamento via POST /api/appointments
 *
 * Dois fluxos suportados:
 *
 * FLUXO 1 - Com produto (padrão):
 * 1. Cliente acessa página do produto
 * 2. Cliente clica no link do Calendly do especialista
 * 3. Cliente retorna à plataforma e submete este DTO com product_type e product_id
 * 4. Backend cria Appointment + auto-cria Process em status SCHEDULING
 *
 * FLUXO 2 - Consultoria (sem produto):
 * 1. Cliente acessa página de consultoria
 * 2. Cliente seleciona especialista e acessa link do Calendly
 * 3. Cliente retorna à plataforma e submete DTO SEM product_type/product_id
 * 4. Backend cria Appointment + Process em SCHEDULING (sem produto)
 * 5. Após reunião, especialista seleciona produto antes de NEGOTIATION
 *
 * Validação: product_type e product_id devem ser ambos fornecidos ou ambos omitidos
 */
export class CreateAppointmentDto {
  /**
   * ID do cliente (UUID)
   * Quem está agendando a reunião
   * Validação: cliente deve existir no banco de dados
   */
  @IsUUID('4', { message: 'client_id deve ser um UUID válido' })
  client_id: string;

  /**
   * ID do especialista (UUID)
   * Quem está sendo agendado
   * Validação: especialista deve existir e ter role SPECIALIST
   */
  @IsUUID('4', { message: 'specialist_id deve ser um UUID válido' })
  specialist_id: string;

  /**
   * Tipo de produto: CAR, BOAT ou AIRCRAFT
   * Opcional para consultoria (sem produto inicial)
   * Se fornecido, product_id também deve ser fornecido
   */
  @IsOptional()
  @ValidateIf((o) => o.product_id !== undefined)
  @IsEnum(ProductType, {
    message: 'product_type deve ser CAR, BOAT ou AIRCRAFT',
  })
  product_type?: ProductType;

  /**
   * ID do produto específico (car_id, boat_id ou aircraft_id)
   * Opcional para consultoria (sem produto inicial)
   * Se fornecido, product_type também deve ser fornecido
   *
   * Exemplo:
   * - Se product_type = CAR: product_id = 1 (referencia Car com id=1)
   * - Se product_type = BOAT: product_id = 5 (referencia Boat com id=5)
   * - Se product_type = AIRCRAFT: product_id = 3 (referencia Aircraft com id=3)
   */
  @IsOptional()
  @ValidateIf((o) => o.product_type !== undefined)
  @IsInt({ message: 'product_id deve ser um número inteiro' })
  @Min(1, { message: 'product_id deve ser no mínimo 1' })
  product_id?: number;

  /**
   * Data e hora do agendamento em ISO 8601 UTC
   * Formato esperado: "2024-10-10T14:00:00Z"
   *
   * IMPORTANTE PARA FRONTEND:
   * - Receber horário local do usuário (ex: cliente em São Paulo, fuso -03:00)
   * - Converter para UTC antes de enviar ao backend
   * - Exemplo: 14:00 em São Paulo (-03:00) = 17:00 UTC
   * - Enviar: "2024-10-10T17:00:00Z"
   *
   * Backend armazena sempre em UTC
   * Frontend converte de volta ao exibir: "2024-10-10T17:00:00Z" → 14:00 (São Paulo)
   *
   * Validações:
   * - appointment_datetime deve ser futuro (não permite agendamentos no passado)
   * - Verificar conflitos de horário do especialista
   */
  @IsOptional()
  appointment_datetime?: Date; // Será validado como DateTime no service

  /**
   * Anotações opcionais sobre o agendamento
   * Máximo 500 caracteres
   * Exemplos: "Test drive do Ferrari F8", "Inspeção de barco", "Manutenção"
   */
  @IsOptional()
  @MaxLength(500, { message: 'notes não pode ter mais que 500 caracteres' })
  notes?: string;
}
