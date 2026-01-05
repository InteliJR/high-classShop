import { UserRole, ProductType, CivilState } from '@prisma/client';

export class UserResponse {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: UserRole;
  cpf: string;
  civil_state: CivilState | null;
  speciality: ProductType | null;
  created_at: Date;
}
