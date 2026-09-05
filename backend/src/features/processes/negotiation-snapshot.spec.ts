import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, ProductCurrency, ProductType } from '@prisma/client';
import {
  buildNegotiationSnapshotUpdate,
  requireNegotiationSnapshot,
} from './negotiation-snapshot';

const usdCar = {
  product_type: ProductType.CAR,
  negotiation_currency: null,
  negotiation_product_value: null,
  car: {
    valor: new Prisma.Decimal('120000.00'),
    currency: ProductCurrency.USD,
  },
  boat: null,
  aircraft: null,
};

describe('negotiation snapshot', () => {
  it('creates a USD snapshot from the associated car', () => {
    expect(buildNegotiationSnapshotUpdate(usdCar)).toEqual({
      negotiation_currency: ProductCurrency.USD,
      negotiation_product_value: new Prisma.Decimal('120000.00'),
    });
  });

  it.each([
    [ProductType.BOAT, 'boat'],
    [ProductType.AIRCRAFT, 'aircraft'],
  ] as const)(
    'creates a USD snapshot from an associated %s',
    (productType, relation) => {
      expect(
        buildNegotiationSnapshotUpdate({
          ...usdCar,
          product_type: productType,
          car: null,
          [relation]: usdCar.car,
        }),
      ).toEqual({
        negotiation_currency: ProductCurrency.USD,
        negotiation_product_value: new Prisma.Decimal('120000.00'),
      });
    },
  );

  it('does not overwrite an existing snapshot', () => {
    expect(
      buildNegotiationSnapshotUpdate({
        ...usdCar,
        negotiation_currency: ProductCurrency.BRL,
        negotiation_product_value: new Prisma.Decimal('90000.00'),
      }),
    ).toEqual({});
  });

  it('rejects a half-filled snapshot', () => {
    expect(() =>
      buildNegotiationSnapshotUpdate({
        ...usdCar,
        negotiation_currency: ProductCurrency.USD,
      }),
    ).toThrow(ConflictException);
  });

  it('fails closed when a product type has no matching relation', () => {
    expect(() =>
      buildNegotiationSnapshotUpdate({
        ...usdCar,
        car: null,
      }),
    ).toThrow(ConflictException);
  });

  it('requires both fields before monetary operations', () => {
    expect(() => requireNegotiationSnapshot(usdCar)).toThrow(
      BadRequestException,
    );
  });
});
