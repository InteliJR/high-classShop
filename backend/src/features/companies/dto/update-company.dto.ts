import { PartialType } from '@nestjs/mapped-types';
import { CreateCompanyDto } from './create-company.dto'; // importa create-company.dto para herdar suas validações

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {} // PartialType permite que os campos sejam opcionais, para poder atualizar apenas alguns campos
