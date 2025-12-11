import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { TabsDto } from './tabs/tabs.dto';

export class SignerDto {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @IsString()
  @IsNotEmpty()
  routingOrder: string;

  @ValidateNested()
  @Type(() => TabsDto)
  tabs: TabsDto;
}
