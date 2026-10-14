import { ProductType } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class CheckExistingAppointmentDto {
  @IsUUID()
  specialist_id: string;

  @IsEnum(ProductType)
  product_type: ProductType;

  @IsUUID()
  product_id: string;
}
