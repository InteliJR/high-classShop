import { Exclude, Expose } from 'class-transformer';
import { $Enums, User as PrismaUser, UserRole } from '@prisma/client';

/**
 * User Entity com exclusão automática de campos sensíveis
 * Usa class-transformer para omitir password_hash automaticamente
 */
export class UserEntity
  implements Omit<PrismaUser, 'password_hash' | 'updated_at'>
{
  @Expose()
  id: string;

  @Expose()
  role: UserRole;

  @Expose()
  name: string;

  @Expose()
  surname: string;

  @Expose()
  email: string;

  @Expose()
  cpf: string;

  @Expose()
  rg: string;

  @Expose()
  profile_image_url: string | null;

  @Expose()
  civil_state: $Enums.CivilState | null;

  @Expose()
  speciality: $Enums.ProductType | null;

  @Expose()
  address_id: string | null;

  @Expose()
  company_id: string | null;

  @Expose()
  consultant_id: string | null;

  @Expose()
  identification_number: string | null;

  @Exclude()
  password_hash: string;

  @Expose()
  created_at: Date;

  @Exclude()
  updated_at: Date;

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
