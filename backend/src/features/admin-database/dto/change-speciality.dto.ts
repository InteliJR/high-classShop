import { ProductType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeSpecialityDto {
  @IsEnum(ProductType, {
    message: 'A especialidade deve ser Carros, Embarcações ou Aeronaves.',
  })
  speciality: ProductType;
}
