import { ProductType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeSpecialityDto {
  @IsEnum(ProductType)
  speciality: ProductType;
}
