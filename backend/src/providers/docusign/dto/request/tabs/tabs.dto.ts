import { Type } from 'class-transformer';
import { ValidateNested, IsOptional, IsArray } from 'class-validator';
import { SignHereTabDto } from './sign-here-tab.dto';
import { DateSignedTabDto } from './date-signed-tab.dto';
import { FullNameTabDto } from './full-name-tab.dto';

export class TabsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SignHereTabDto)
  signHereTabs?: SignHereTabDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DateSignedTabDto)
  dateSignedTabs?: DateSignedTabDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FullNameTabDto)
  fullNameTabs?: FullNameTabDto[];
}
