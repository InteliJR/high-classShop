import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ProductCsvImportDto {
  @IsOptional()
  @IsUUID()
  specialist_id?: string;

  @IsOptional()
  @IsIn(['ADDITIVE', 'SYNCHRONIZE'])
  mode: 'ADDITIVE' | 'SYNCHRONIZE' = 'ADDITIVE';

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  confirm_synchronize = false;

  @IsOptional()
  @IsString()
  synchronize_preview_token?: string;
}
