import { $Enums } from '@prisma/client';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateProcessDTO {
  @IsUUID()
  @IsNotEmpty()
  client_id: string;

  // TODO: trocar para string e adicionar verificação se é um UUID quando for refatorado
  @IsNotEmpty()
  product_id: number;

  @IsNotEmpty()
  product_type: $Enums.ProductType;

  @IsNotEmpty()
  @IsUUID()
  specialist_id: string;

  @IsOptional()
  notes: string;
}
