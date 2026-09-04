import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProductType, UserRole } from '@prisma/client';
import { acquireProductMonetaryLock } from './product-monetary-lock';

type ProductAssociationClient = {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
  user: { findUnique(args: unknown): Promise<any> };
  car: { findUnique(args: unknown): Promise<any> };
  boat: { findUnique(args: unknown): Promise<any> };
  aircraft: { findUnique(args: unknown): Promise<any> };
};

export async function validateSpecialistProductAssociation(
  client: ProductAssociationClient,
  input: {
    specialistId: string;
    productType: ProductType | null | undefined;
    productId: string | null | undefined;
  },
): Promise<any | null> {
  const hasType = input.productType != null;
  const hasId = input.productId != null;
  if (hasType !== hasId) {
    throw new BadRequestException(
      'product_type e product_id devem ser informados juntos.',
    );
  }

  const specialist = await client.user.findUnique({
    where: { id: input.specialistId },
    select: { id: true, role: true, speciality: true },
  });
  if (!specialist) {
    throw new NotFoundException('Especialista não encontrado');
  }
  if (specialist.role !== UserRole.SPECIALIST) {
    throw new BadRequestException('Usuário informado não é especialista');
  }
  if (
    input.productType &&
    specialist.speciality &&
    specialist.speciality !== input.productType
  ) {
    throw new BadRequestException(
      'Especialista não trabalha com este tipo de produto',
    );
  }
  if (!input.productType || !input.productId) return null;

  // The same advisory key is used by catalog mutations. Holding it through
  // the caller's transaction closes the read/insert TOCTOU window.
  await acquireProductMonetaryLock(client, {
    productType: input.productType,
    productId: input.productId,
  });

  const delegate =
    input.productType === ProductType.CAR
      ? client.car
      : input.productType === ProductType.BOAT
        ? client.boat
        : client.aircraft;
  const product = await delegate.findUnique({
    where: { id: input.productId },
  });
  if (!product) throw new NotFoundException('Produto não encontrado');
  if (product.is_active === false) {
    throw new BadRequestException('Produto inativo no catálogo');
  }
  if (product.specialist_id !== input.specialistId) {
    throw new ForbiddenException(
      'O produto deve pertencer ao especialista do processo',
    );
  }
  return product;
}
