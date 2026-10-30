import { IsUUID } from 'class-validator';

export class TransferProductDto {
  @IsUUID()
  specialist_id: string;
}
