import { Exclude, Expose } from 'class-transformer';
import { $Enums, User as PrismaUser, UserRole } from '@prisma/client';

/**
 * User Entity com exclusão automática de campos sensíveis
 * Usa class-transformer para omitir password_hash automaticamente
 */
export class UserEntity
  implements Omit<PrismaUser, 'password_hash' | 'updated_at' >
{
  @Expose()
  id: string;

  @Expose()
  role: UserRole;

  @Expose()
  name: string;

  @Expose()
  email: string;

  @Exclude()
  password_hash?: string;
  
  @Expose()
  created_at: Date;
  
  @Exclude()
  updated_at: Date;

  address_id: string | null;
  civil_state: $Enums.CivilState | null;
  company_id: string | null;
  consultant_id: string | null;
  cpf: string;
  identification_number: string | null;
  rg: string;
  speciality: $Enums.ProductType | null;
  surname: string;
  
  constructor(partial: Partial<PrismaUser>) {
    Object.assign(this, partial);
  }

  /**
   * Converte User do Prisma para UserEntity (omitindo campos sensíveis)
   */
  static fromPrisma(user: PrismaUser): UserEntity {
    return new UserEntity(user);
  }

  /**
   * Converte array de Users do Prisma para UserEntity[]
   */
  static fromPrismaArray(users: PrismaUser[]): UserEntity[] {
    return users.map((user) => new UserEntity(user));
  }
}
