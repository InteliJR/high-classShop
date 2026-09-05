import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  ProcessStatus,
  ProductCurrency,
  ProductType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type MonetaryLockInput = {
  productType: ProductType;
  productId: string;
  currentValue: Prisma.Decimal;
  currentCurrency: ProductCurrency;
  nextValue?: number;
  nextCurrency?: ProductCurrency;
};

type ProductMonetaryReference = {
  productType: ProductType;
  productId: string;
};

type NegotiationProductReferenceSource = {
  product_type: ProductType | null;
  car_id?: string | null;
  boat_id?: string | null;
  aircraft_id?: string | null;
};

type ProductMonetaryUpdateInput = ProductMonetaryReference & {
  nextValue?: number;
  nextCurrency?: ProductCurrency;
  data: unknown;
  notFoundMessage?: string;
};

type ProcessLookupClient = {
  process: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
  };
};

type TransactionLockClient = {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
};

const PRODUCT_DELEGATE_BY_TYPE = {
  [ProductType.CAR]: 'car',
  [ProductType.BOAT]: 'boat',
  [ProductType.AIRCRAFT]: 'aircraft',
} as const;

const PROCESS_FOREIGN_KEY_BY_TYPE = {
  [ProductType.CAR]: 'car_id',
  [ProductType.BOAT]: 'boat_id',
  [ProductType.AIRCRAFT]: 'aircraft_id',
} as const;

export async function acquireProductMonetaryLock(
  prisma: TransactionLockClient,
  input: ProductMonetaryReference,
): Promise<void> {
  const lockKey = `product-money:${input.productType}:${input.productId}`;
  await prisma.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS locked
  `;
}

export async function lockNegotiationProductMoney(
  prisma: TransactionLockClient,
  source: NegotiationProductReferenceSource,
): Promise<void> {
  const productId =
    source.product_type === ProductType.CAR
      ? source.car_id
      : source.product_type === ProductType.BOAT
        ? source.boat_id
        : source.product_type === ProductType.AIRCRAFT
          ? source.aircraft_id
          : null;

  if (!source.product_type || !productId) return;

  await acquireProductMonetaryLock(prisma, {
    productType: source.product_type,
    productId,
  });
}

export async function assertProductMonetaryFieldsUnlocked(
  prisma: ProcessLookupClient,
  input: MonetaryLockInput,
): Promise<void> {
  const changesValue =
    input.nextValue !== undefined &&
    !input.currentValue.equals(new Prisma.Decimal(input.nextValue));
  const changesCurrency =
    input.nextCurrency !== undefined &&
    input.nextCurrency !== input.currentCurrency;

  if (!changesValue && !changesCurrency) return;

  const foreignKey = PROCESS_FOREIGN_KEY_BY_TYPE[input.productType];
  const activeProcess = await prisma.process.findFirst({
    where: { [foreignKey]: input.productId, status: ProcessStatus.NEGOTIATION },
    select: { id: true },
  });

  if (activeProcess) {
    throw new ConflictException({
      code: 'PRODUCT_MONETARY_FIELDS_LOCKED',
      message:
        'Valor e moeda não podem ser alterados enquanto o produto estiver em negociação.',
    });
  }
}

export async function updateProductWithMonetaryLock(
  prisma: PrismaService,
  input: ProductMonetaryUpdateInput,
): Promise<unknown> {
  return prisma.$transaction(async (tx) => {
    await acquireProductMonetaryLock(tx, input);

    const delegateName = PRODUCT_DELEGATE_BY_TYPE[input.productType];
    const delegate = (tx as any)[delegateName];
    const currentProduct = await delegate.findUnique({
      where: { id: input.productId },
      select: { id: true, valor: true, currency: true },
    });

    if (!currentProduct) {
      throw new NotFoundException(
        input.notFoundMessage ?? 'Produto não encontrado',
      );
    }

    await assertProductMonetaryFieldsUnlocked(tx as any, {
      productType: input.productType,
      productId: input.productId,
      currentValue: currentProduct.valor,
      currentCurrency: currentProduct.currency,
      nextValue: input.nextValue,
      nextCurrency: input.nextCurrency,
    });

    return delegate.update({
      where: { id: input.productId },
      data: input.data,
    });
  });
}
