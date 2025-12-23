import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UserEntity } from 'src/auth/entities/user.entity';
import { SpecialityType } from 'src/auth/dto/auth';

export type ProductType = 'CAR' | 'BOAT' | 'AIRCRAFT';

/**
 * Valida se o usuário pode criar/modificar um produto do tipo especificado.
 * - ADMIN pode criar qualquer tipo de produto
 * - SPECIALIST só pode criar do produto que ele é especialista
 * 
 * @throws ForbiddenException se o usuário não tiver permissão
 */
export function assertSpecialistCanCreate(productType: ProductType, user: UserEntity): void {
  // ADMIN pode criar qualquer tipo
  if (user.role === UserRole.ADMIN) {
    return;
  }

  // SPECIALIST só pode criar do seu tipo
  if (user.role === UserRole.SPECIALIST) {
    const specialityMap: Record<ProductType, SpecialityType> = {
      CAR: SpecialityType.CAR,
      BOAT: SpecialityType.BOAT,
      AIRCRAFT: SpecialityType.AIRCRAFT,
    };

    const requiredSpeciality = specialityMap[productType];

    if (user.speciality !== requiredSpeciality) {
      const productNames: Record<ProductType, string> = {
        CAR: 'carros',
        BOAT: 'barcos',
        AIRCRAFT: 'aeronaves',
      };
      throw new ForbiddenException(
        `Usuário não autorizado a cadastrar ${productNames[productType]}. ` +
        `Sua especialidade é ${user.speciality}, mas o produto requer ${requiredSpeciality}.`
      );
    }
    return;
  }

  // Outros roles não podem criar produtos
  throw new ForbiddenException('Apenas ADMIN e SPECIALIST podem criar produtos.');
}

/**
 * Valida se o usuário pode modificar/deletar um produto do tipo especificado.
 * Mesma lógica de assertSpecialistCanCreate.
 */
export function assertSpecialistCanModify(productType: ProductType, user: UserEntity): void {
  assertSpecialistCanCreate(productType, user);
}
