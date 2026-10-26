import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RemoveProcessDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da exclusão.' })
  @MaxLength(1000, { message: 'O motivo deve ter no máximo 1000 caracteres.' })
  reason: string;
}
