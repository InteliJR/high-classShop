import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO para atualização de configuração
 */
export class UpdateSettingDto {
  @IsString({ message: 'value deve ser uma string' })
  @IsNotEmpty({ message: 'value não pode ser vazio' })
  value: string;
}
