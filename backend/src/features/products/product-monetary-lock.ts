import { ConflictException } from '@nestjs/common';
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

export async function assertProductMonetaryFieldsUnlocked(
  prisma: PrismaService,
  input: MonetaryLockInput,
): Promise<void> {
  const changesValue =
    input.nextValue !== undefined &&
    !input.currentValue.equals(new Prisma.Decimal(input.nextValue));
  const changesCurrency =
    input.nextCurrency !== undefined &&
    input.nextCurrency !== input.currentCurrency;

  if (!changesValue && !changesCurrency) return;

  const foreignKey = {
    [ProductType.CAR]: 'car_id',
    [ProductType.BOAT]: 'boat_id',
    [ProductType.AIRCRAFT]: 'aircraft_id',
  }[input.productType];
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
