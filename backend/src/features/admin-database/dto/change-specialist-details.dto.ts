import { ProductType } from '@prisma/client';
import { IsEnum, IsNumber, Max, Min } from 'class-validator';

export class ChangeSpecialistDetailsDto {
  @IsEnum(ProductType, {
    message: 'A especialidade deve ser Carros, Embarcações ou Aeronaves.',
  })
  speciality: ProductType;

  @IsNumber({}, { message: 'A taxa de comissão deve ser um número.' })
  @Min(0, { message: 'A taxa de comissão deve ser maior ou igual a 0.' })
  @Max(100, { message: 'A taxa de comissão deve ser menor ou igual a 100.' })
  commission_rate: number;
}
