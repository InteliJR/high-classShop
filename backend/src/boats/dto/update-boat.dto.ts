import { PartialType } from '@nestjs/mapped-types';
import { CreateBoatDto } from './create-boat.dto';

export class UpdateBoatDto extends PartialType(CreateBoatDto) {}
