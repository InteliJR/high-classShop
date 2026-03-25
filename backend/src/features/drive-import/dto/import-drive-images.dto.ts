import { ProductType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ImportDriveImagesDto {
  @IsString()
  @IsUrl()
  folder_url: string;

  @IsEnum(ProductType)
  product_type: ProductType;

  @IsOptional()
  @IsUUID('4')
  specialist_id?: string;

  @IsOptional()
  @IsBoolean()
  dry_run?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  max_files?: number;
}
