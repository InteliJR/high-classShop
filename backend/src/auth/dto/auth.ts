import { Request } from 'express';
import { 
  IsEmail, 
  IsString, 
  MinLength, 
  IsEnum, 
  IsOptional, 
  IsUUID,
  Length,
  Matches
} from 'class-validator';
import { UserEntity } from '../entities/user.entity';
import { $Enums } from '@prisma/client';

// Tipos para login e registro de usuários
export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  CONSULTANT = 'CONSULTANT',
  SPECIALIST = 'SPECIALIST',
  ADMIN = 'ADMIN',
}
export enum CivilState {
  SINGLE = 'SINGLE',
  MARRIED = 'MARRIED',
  DIVORCED = 'DIVORCED',
  WIDOWED = 'WIDOWED',
  SEPARATED = 'SEPARATED',
  STABLE_UNION = 'STABLE_UNION',
}

export enum SpecialityType {
  CAR = 'CAR',
  BOAT = 'BOAT',
  AIRCRAFT = 'AIRCRAFT',
}

export class UserRegisterDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  surname: string;

  @IsEmail()
  email: string;

  @IsString()
  @Length(11, 11)
  @Matches(/^\d{11}$/, { message: 'CPF must be 11 digits' })
  cpf: string;

  @IsString()
  @Length(10, 10)
  @Matches(/^\d{10}$/, { message: 'RG must be 10 digits' })
  rg: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsEnum(CivilState)
  civil_state?: CivilState;

  @IsOptional()
  @IsEnum(SpecialityType)
  speciality?: SpecialityType;

  @IsOptional()
  @IsUUID()
  address_id?: string;

  @IsOptional()
  @IsUUID()
  consultant_id?: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

// Resposta da API
export class ApiResponseDto<D, M, ED> {
  sucess: boolean;
  message?: string;
  data?: D;
  meta?: M;
  error?: {
    code: number;
    message: string;
    details?: ED[];
  };
}

// Retorno do AuthGuard
export interface RequestWithUser extends Request {
  user: UserEntity;
}
