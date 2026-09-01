import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, ProductCurrency, ProductType } from '@prisma/client';

type MonetaryProduct = {
  valor: Prisma.Decimal;
  currency: ProductCurrency;
};

export type NegotiationSnapshotSource = {
  product_type: ProductType | null;
  negotiation_currency: ProductCurrency | null;
  negotiation_product_value: Prisma.Decimal | null;
  car?: MonetaryProduct | null;
  boat?: MonetaryProduct | null;
  aircraft?: MonetaryProduct | null;
};

function snapshotError(code: string, message: string) {
  return { success: false, error: { code, message } };
}

function selectedProduct(source: NegotiationSnapshotSource): MonetaryProduct | null {
  if (source.product_type === ProductType.CAR) return source.car ?? null;
  if (source.product_type === ProductType.BOAT) return source.boat ?? null;
  if (source.product_type === ProductType.AIRCRAFT) return source.aircraft ?? null;
  return null;
}

export function buildNegotiationSnapshotUpdate(
  source: NegotiationSnapshotSource,
): Prisma.ProcessUpdateInput {
  const hasCurrency = source.negotiation_currency !== null;
  const hasValue = source.negotiation_product_value !== null;
  if (hasCurrency !== hasValue) {
    throw new ConflictException(snapshotError(
      'PROCESS_NEGOTIATION_SNAPSHOT_INCONSISTENT',
      'O snapshot monetário do processo está inconsistente.',
    ));
  }
  if (hasCurrency && hasValue) return {};

  const product = selectedProduct(source);
  if (!product) return {};
  return {
    negotiation_currency: product.currency,
    negotiation_product_value: product.valor,
  };
}

export function requireNegotiationSnapshot(
  source: Pick<NegotiationSnapshotSource, 'negotiation_currency' | 'negotiation_product_value'>,
): { currency: ProductCurrency; productValue: Prisma.Decimal } {
  if (!source.negotiation_currency || source.negotiation_product_value === null) {
    throw new BadRequestException(snapshotError(
      'PROCESS_NEGOTIATION_SNAPSHOT_MISSING',
      'A negociação não possui valor e moeda congelados.',
    ));
  }
  return {
    currency: source.negotiation_currency,
    productValue: source.negotiation_product_value,
  };
}
