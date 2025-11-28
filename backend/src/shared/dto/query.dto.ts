import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsObject } from 'class-validator';

export class QueryDto<T = unknown> {

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  perPage?: number;

  @IsOptional()
  @IsObject()
  appliedFilters?: T;
}
