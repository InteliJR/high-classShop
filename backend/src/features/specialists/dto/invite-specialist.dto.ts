import { Transform } from 'class-transformer';
import { ProductType } from '@prisma/client';
import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsNumber,
  Max,
  Min,
} from 'class-validator';

export class InviteSpecialistDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @IsEnum(ProductType, {
    message: 'Especialidade deve ser CAR, BOAT ou AIRCRAFT.',
  })
  speciality: ProductType;

  @IsDefined({ message: 'Informe a comissão do especialista.' })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'A comissão deve ser um número com no máximo duas casas decimais.',
    },
  )
  @Min(0, { message: 'A comissão deve estar entre 0% e 100%.' })
  @Max(100, { message: 'A comissão deve estar entre 0% e 100%.' })
  commission_rate: number;
}
