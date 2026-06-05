import { Exclude, Expose } from 'class-transformer';
import { $Enums, User as PrismaUser, UserRole } from '@prisma/client';

type CompanyBranding = {
  id: string;
  name: string;
  logo: string | null;
  logoUrl?: string | null;
  color_identity?: string[];
  primary_color?: string | null;
  secondary_color?: string | null;
};

type ConsultantBranding = {
  id: string;
  company: CompanyBranding | null;
};

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

  // @Expose()
  // profile_image_url: string | null;

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
  is_active: boolean;

  @Expose()
  deactivated_at: Date | null;

  @Expose()
  deactivated_by: string | null;

  @Expose()
  identification_number: string | null;

  @Expose()
  calendly_url: string | null;

  @Expose()
  calendly_user_uri: string | null;

  @Expose()
  calendly_organization_uri: string | null;

  @Expose()
  commission_rate: any | null;

  // Dados bancários do especialista para comissão
  @Expose()
  bank: string | null;

  @Expose()
  agency: string | null;

  @Expose()
  checking_account: string | null;

  @Expose()
  company?: CompanyBranding | null;

  @Expose()
  consultant?: ConsultantBranding | null;

  @Exclude()
  password_hash: string;

  @Expose()
  created_at: Date;

  @Exclude()
  updated_at: Date;

  constructor(
    partial: Partial<PrismaUser> & {
      company?: CompanyBranding | null;
      consultant?: ConsultantBranding | null;
    },
  ) {
    Object.assign(this, partial);
  }

  /**
   * Converte User do Prisma para UserEntity (omitindo campos sensíveis)
   */
  static fromPrisma(
    user: PrismaUser & {
      company?: CompanyBranding | null;
      consultant?: ConsultantBranding | null;
    },
  ): UserEntity {
    return new UserEntity({
      ...user,
      company: UserEntity.withBrandingColors(user.company),
      consultant: user.consultant
        ? {
            ...user.consultant,
            company:
              UserEntity.withBrandingColors(user.consultant.company) ?? null,
          }
        : user.consultant,
    });
  }

  /**
   * Converte array de Users do Prisma para UserEntity[]
   */
  static fromPrismaArray(users: PrismaUser[]): UserEntity[] {
    return users.map((user) => new UserEntity(user));
  }

  private static withBrandingColors(
    company?: CompanyBranding | null,
  ): CompanyBranding | null | undefined {
    if (!company) return company;

    return {
      ...company,
      logoUrl: company.logoUrl ?? null,
      primary_color:
        company.primary_color ?? company.color_identity?.[0] ?? null,
      secondary_color:
        company.secondary_color ?? company.color_identity?.[1] ?? null,
    };
  }
}
