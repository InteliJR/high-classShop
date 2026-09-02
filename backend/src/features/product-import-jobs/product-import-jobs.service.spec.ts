import { ProductImportJobsService } from './product-import-jobs.service';
import { Prisma, ProductCurrency, ProductType } from '@prisma/client';

describe('ProductImportJobsService', () => {
  it('lanca erro quando identificador vem vazio', async () => {
    const prisma = { car: { findFirst: jest.fn(), create: jest.fn() } } as any;
    const service = new ProductImportJobsService(prisma, {} as any, {} as any);

    await expect(
      (service as any).upsertProductFromRow(
        'CAR',
        {
          marca: 'Ferrari',
          modelo: 'X',
          identificador: '  ',
          valor: '100',
          estado: 'SP',
          ano: '2020',
        },
        'spec-1',
      ),
    ).rejects.toThrow(/identificador/i);
    expect(prisma.car.create).not.toHaveBeenCalled();
  });

  it('busca produto existente por (specialist_id, identificador), nao por modelo', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockResolvedValue({ id: 'uuid-1' });
    const prisma = { car: { findFirst, create } } as any;
    const service = new ProductImportJobsService(prisma, {} as any, {} as any);

    await (service as any).upsertProductFromRow(
      'CAR',
      {
        marca: 'Ferrari',
        modelo: 'X',
        identificador: 'FERRARI-X-2',
        valor: '100',
        estado: 'SP',
        ano: '2020',
      },
      '00000000-0000-4000-8000-000000000001',
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        specialist_id: '00000000-0000-4000-8000-000000000001',
        identificador: 'FERRARI-X-2',
      },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ identificador: 'FERRARI-X-2' }),
    });
  });

  it.each([
    [ProductType.CAR, 'car'],
    [ProductType.BOAT, 'boat'],
    [ProductType.AIRCRAFT, 'aircraft'],
  ] as const)(
    'protege update CSV de %s com a mesma transação monetária',
    async (productType, delegateName) => {
      const existing = {
        id: '11111111-1111-4111-8111-111111111111',
        specialist_id: '00000000-0000-4000-8000-000000000001',
        identificador: 'PRODUTO-1',
        valor: new Prisma.Decimal('100.00'),
        currency: ProductCurrency.BRL,
        is_active: true,
      };
      const rootUpdate = jest.fn().mockResolvedValue(existing);
      const txUpdate = jest.fn().mockResolvedValue(existing);
      const txLock = jest.fn().mockResolvedValue([{ locked: null }]);
      const tx = {
        $queryRaw: txLock,
        process: { findFirst: jest.fn().mockResolvedValue(null) },
        [delegateName]: {
          findUnique: jest.fn().mockResolvedValue(existing),
          update: txUpdate,
        },
      };
      const prisma = {
        [delegateName]: {
          findFirst: jest.fn().mockResolvedValue(existing),
          update: rootUpdate,
          create: jest.fn(),
        },
        $transaction: jest.fn(async (callback) => callback(tx)),
      } as any;
      const service = new ProductImportJobsService(
        prisma,
        {} as any,
        {} as any,
      );

      await (service as any).upsertProductFromRow(
        productType,
        {
          marca: 'Marca',
          modelo: 'Modelo',
          identificador: 'PRODUTO-1',
          valor: '110',
          currency: 'USD',
          estado: 'SP',
          ano: '2020',
        },
        existing.specialist_id,
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txLock.mock.calls[0][1]).toBe(
        `product-money:${productType}:${existing.id}`,
      );
      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: expect.objectContaining({
          valor: 110,
          currency: ProductCurrency.USD,
        }),
      });
      expect(rootUpdate).not.toHaveBeenCalled();
    },
  );

  it.each([
    [ProductType.CAR, 'car'],
    [ProductType.BOAT, 'boat'],
    [ProductType.AIRCRAFT, 'aircraft'],
  ] as const)(
    'bloqueia update CSV monetário de %s durante negociação',
    async (productType, delegateName) => {
      const existing = {
        id: '11111111-1111-4111-8111-111111111111',
        specialist_id: '00000000-0000-4000-8000-000000000001',
        identificador: 'PRODUTO-1',
        valor: new Prisma.Decimal('100.00'),
        currency: ProductCurrency.BRL,
        is_active: true,
      };
      const txUpdate = jest.fn();
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ locked: null }]),
        process: {
          findFirst: jest.fn().mockResolvedValue({ id: 'process-1' }),
        },
        [delegateName]: {
          findUnique: jest.fn().mockResolvedValue(existing),
          update: txUpdate,
        },
      };
      const rootUpdate = jest.fn().mockResolvedValue(existing);
      const prisma = {
        [delegateName]: {
          findFirst: jest.fn().mockResolvedValue(existing),
          update: rootUpdate,
          create: jest.fn(),
        },
        $transaction: jest.fn(async (callback) => callback(tx)),
      } as any;
      const service = new ProductImportJobsService(
        prisma,
        {} as any,
        {} as any,
      );

      await expect(
        (service as any).upsertProductFromRow(
          productType,
          {
            marca: 'Marca',
            modelo: 'Modelo',
            identificador: 'PRODUTO-1',
            valor: '110',
            currency: 'USD',
            estado: 'SP',
            ano: '2020',
          },
          existing.specialist_id,
        ),
      ).rejects.toMatchObject({
        response: { code: 'PRODUCT_MONETARY_FIELDS_LOCKED' },
      });
      expect(txUpdate).not.toHaveBeenCalled();
      expect(rootUpdate).not.toHaveBeenCalled();
    },
  );
});
