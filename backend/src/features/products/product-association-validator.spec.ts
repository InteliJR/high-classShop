import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProductType, UserRole } from '@prisma/client';
import { validateSpecialistProductAssociation } from './product-association-validator';

function db(overrides: Record<string, unknown> = {}) {
  const product = {
    id: 'product-1',
    specialist_id: 'specialist-1',
    is_active: true,
  };
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'specialist-1',
        role: UserRole.SPECIALIST,
        speciality: ProductType.CAR,
      }),
    },
    car: { findUnique: jest.fn().mockResolvedValue(product) },
    boat: { findUnique: jest.fn().mockResolvedValue(product) },
    aircraft: { findUnique: jest.fn().mockResolvedValue(product) },
    ...overrides,
  } as any;
}

describe('validateSpecialistProductAssociation', () => {
  it('rejects a non-specialist user', async () => {
    const client = db({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'specialist-1',
          role: UserRole.CUSTOMER,
          speciality: null,
        }),
      },
    });

    await expect(
      validateSpecialistProductAssociation(client, {
        specialistId: 'specialist-1',
        productType: null,
        productId: null,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an inactive product', async () => {
    const client = db({
      car: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'product-1',
          specialist_id: 'specialist-1',
          is_active: false,
        }),
      },
    });

    await expect(
      validateSpecialistProductAssociation(client, {
        specialistId: 'specialist-1',
        productType: ProductType.CAR,
        productId: 'product-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a product owned by another specialist', async () => {
    const client = db({
      car: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'product-1',
          specialist_id: 'other-specialist',
          is_active: true,
        }),
      },
    });

    await expect(
      validateSpecialistProductAssociation(client, {
        specialistId: 'specialist-1',
        productType: ProductType.CAR,
        productId: 'product-1',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a missing product', async () => {
    const client = db({ car: { findUnique: jest.fn().mockResolvedValue(null) } });

    await expect(
      validateSpecialistProductAssociation(client, {
        specialistId: 'specialist-1',
        productType: ProductType.CAR,
        productId: 'product-1',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it.each([ProductType.CAR, ProductType.BOAT, ProductType.AIRCRAFT])(
    'accepts an active %s owned by the specialist',
    async (productType) => {
      const client = db({
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'specialist-1',
            role: UserRole.SPECIALIST,
            speciality: productType,
          }),
        },
      });

      await expect(
        validateSpecialistProductAssociation(client, {
          specialistId: 'specialist-1',
          productType,
          productId: 'product-1',
        }),
      ).resolves.toMatchObject({ id: 'product-1' });
    },
  );
});
