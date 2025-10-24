export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  CONSULTANT = 'CONSULTANT',
  SPECIALIST = 'SPECIALIST',
  ADMIN = 'ADMIN',
}

// Enums inferidos do schema (você precisará defini-los)
// Exemplo de como eles poderiam ser:
export enum CivilState {
  SINGLE = "SINGLE",
  MARRIED = "MARRIED",
  DIVORCED = "DIVORCED",
  WIDOWED = "WIDOWED",
  SEPARATED = "SEPARATED",
  STABLE_UNION = "STABLE_UNION",
}

enum SpecialityType {
  CAR = "CAR",
  BOAT = "BOAT",
  AIRCRAFT = "AIRCRAFT",
}

export class RegisterDto {
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

export class LoginDto {
  email: string;
  password: string;
}

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
