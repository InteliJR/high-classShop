import { ProductType } from '@prisma/client';
import { IsEnum, IsNumber, Max, Min } from 'class-validator';
import { HasValidCommissionRatePrecision } from 'src/shared/validators/commission-rate.validator';

export class ChangeSpecialistDetailsDto {
  @IsEnum(ProductType, {
    message: 'A especialidade deve ser Carros, Embarcações ou Aeronaves.',
  })
  speciality: ProductType;

  @IsNumber({}, { message: 'A taxa de comissão deve ser um número.' })
  @HasValidCommissionRatePrecision({
    message: 'A comissão deve ter no máximo duas casas decimais.',
  })
  @Min(0, { message: 'A taxa de comissão deve ser maior ou igual a 0.' })
  @Max(100, { message: 'A taxa de comissão deve ser menor ou igual a 100.' })
  commission_rate: number;
}
