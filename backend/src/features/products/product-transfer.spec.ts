import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProductType, UserRole } from '@prisma/client';
import {
  transferProductAsAdmin,
  transferProductSpecialist,
} from './product-transfer';

function db(overrides: Record<string, unknown> = {}) {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
    car: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'car-1', specialist_id: 'old' }),
      update: jest.fn().mockResolvedValue({}),
    },
    process: { findFirst: jest.fn().mockResolvedValue(null) },
    appointment: { findFirst: jest.fn().mockResolvedValue(null) },
    ...overrides,
  } as any;
}

const input = {
  productType: ProductType.CAR,
  productId: 'car-1',
  toSpecialistId: 'new',
};

describe('transferProductSpecialist', () => {
  it('locks the product, then moves it to the new specialist', async () => {
    const tx = db();

    await expect(transferProductSpecialist(tx, input)).resolves.toEqual({
      fromSpecialistId: 'old',
      toSpecialistId: 'new',
    });

    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      'product-money:CAR:car-1',
    );
    expect(tx.car.update).toHaveBeenCalledWith({
      where: { id: 'car-1' },
      data: { specialist_id: 'new' },
    });
  });

  it('only counts non-terminal, non-removed processes as open', async () => {
    const tx = db();

    await transferProductSpecialist(tx, input);

    expect(tx.process.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          car_id: 'car-1',
          status: { notIn: ['COMPLETED', 'REJECTED'] },
          removed_at: null,
        },
      }),
    );
  });

  it('blocks when a process is in progress', async () => {
    const tx = db({
      process: { findFirst: jest.fn().mockResolvedValue({ id: 'p-1' }) },
    });

    await expect(transferProductSpecialist(tx, input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.car.update).not.toHaveBeenCalled();
  });

  it('blocks when an appointment is pending or scheduled', async () => {
    const tx = db({
      appointment: { findFirst: jest.fn().mockResolvedValue({ id: 'a-1' }) },
    });

    await expect(transferProductSpecialist(tx, input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.car.update).not.toHaveBeenCalled();
  });

  it('rejects missing products and no-op transfers', async () => {
    const missing = db({
      car: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    });
    await expect(
      transferProductSpecialist(missing, input),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      transferProductSpecialist(db(), { ...input, toSpecialistId: 'old' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('transferProductAsAdmin', () => {
  it('validates the target before touching the product and audits the change', async () => {
    const tx = db();
    const context = { specialistId: 'new' };
    const deps = {
      prisma: { $transaction: jest.fn((fn) => fn(tx)) },
      actorContextService: { resolve: jest.fn().mockResolvedValue(context) },
      delegatedAudit: { record: jest.fn() },
    } as any;
    const admin = { id: 'admin', role: UserRole.ADMIN } as any;

    await transferProductAsAdmin(deps, admin, ProductType.CAR, 'car-1', 'new');

    expect(deps.actorContextService.resolve).toHaveBeenCalledWith(
      admin,
      'new',
      ProductType.CAR,
    );
    expect(deps.delegatedAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        context,
        action: 'PRODUCT_TRANSFER',
        resourceId: 'car-1',
        metadata: { fromSpecialistId: 'old', toSpecialistId: 'new' },
      }),
      tx,
    );
  });

  it('does not open a transaction when the target is rejected', async () => {
    const deps = {
      prisma: { $transaction: jest.fn() },
      actorContextService: {
        resolve: jest.fn().mockRejectedValue(new ForbiddenException()),
      },
      delegatedAudit: { record: jest.fn() },
    } as any;

    await expect(
      transferProductAsAdmin(
        deps,
        { id: 's', role: UserRole.SPECIALIST } as any,
        ProductType.CAR,
        'car-1',
        'other',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(deps.prisma.$transaction).not.toHaveBeenCalled();
  });
});
