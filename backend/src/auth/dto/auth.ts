import { Request } from 'express';

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
  name: string;
  surname: string;
  email: string;
  cpf: string;
  rg: string;
  role: UserRole;
  password: string;
  civil_state?: CivilState;
  speciality?: SpecialityType;
  identification_number?: string;
  address_id?: string;
  consultant_id?: string;
  company_id?: string;
}

export class User {
  password_hash: string;
  name: string;
  surname: string;
  email: string;
  cpf: string;
  rg: string;
  role: UserRole;
  civil_state?: CivilState;
  speciality?: SpecialityType;
  identification_number?: string;
  address_id?: string;
  consultant_id?: string;
  company_id?: string;
}

export class LoginDto {
  email: string;
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
  user: UserRegisterDto;
}
