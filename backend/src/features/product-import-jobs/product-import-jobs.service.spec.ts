import { ProductImportJobsService } from './product-import-jobs.service';
import { Prisma, ProductCurrency, ProductType } from '@prisma/client';

describe('ProductImportJobsService', () => {
  const validCarRow = {
    marca: 'Ferrari',
    modelo: 'Roma',
    identificador: 'FERRARI-ROMA-1',
    valor: '1000000',
    estado: 'SP',
    ano: '2024',
  };

  it.each([
    ['identificador', '-', 'Identificador do veículo faltando'],
    ['marca', ' - ', 'Marca do veículo faltando'],
    ['modelo', '-', 'Nome do veículo faltando'],
    ['valor', '   ', 'Valor do veículo faltando'],
    ['estado', '-', 'Estado do veículo faltando'],
    ['ano', ' - ', 'Ano do veículo faltando'],
  ])(
    'trata %s com marcador de ausência como erro natural da linha',
    async (field, emptyValue, expectedMessage) => {
      const prisma = {
        car: { findFirst: jest.fn(), create: jest.fn() },
      } as any;
      const service = new ProductImportJobsService(
        prisma,
        {} as any,
        {} as any,
      );

      await expect(
        (service as any).upsertProductFromRow(
          ProductType.CAR,
          { ...validCarRow, [field]: emptyValue },
          '00000000-0000-4000-8000-000000000001',
        ),
      ).rejects.toThrow(expectedMessage);
      expect(prisma.car.create).not.toHaveBeenCalled();
    },
  );

  it('trata hífen em campos opcionais como célula não preenchida', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'uuid-1' });
    const prisma = {
      car: { findFirst: jest.fn().mockResolvedValue(null), create },
    } as any;
    const service = new ProductImportJobsService(prisma, {} as any, {} as any);

    await expect(
      (service as any).upsertProductFromRow(
        ProductType.CAR,
        {
          ...validCarRow,
          currency: '-',
          cor: ' - ',
          km: '-',
          cambio: '   ',
        },
        '00000000-0000-4000-8000-000000000001',
      ),
    ).resolves.toEqual({ productId: 'uuid-1', action: 'CREATED' });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        currency: undefined,
        cor: undefined,
        km: undefined,
        cambio: undefined,
      }),
    });
  });

  it('não inativa produtos ausentes quando alguma linha falha', async () => {
    const prisma = {
      productImportJob: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job-1',
          product_type: ProductType.CAR,
          specialist_id: '00000000-0000-4000-8000-000000000001',
          status: 'PENDING',
          started_at: null,
          items: [
            {
              id: 'item-1',
              status: 'PENDING',
              payload: validCarRow,
              folder_url: null,
            },
            {
              id: 'item-2',
              status: 'PENDING',
              payload: { ...validCarRow, modelo: '-' },
              folder_url: null,
            },
          ],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      productImportJobItem: {
        update: jest.fn().mockResolvedValue({}),
      },
      car: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'product-1' }),
      },
    } as any;
    const service = new ProductImportJobsService(prisma, {} as any, {} as any);
    const deactivateMissingProducts = jest
      .spyOn(service as any, 'deactivateMissingProducts')
      .mockResolvedValue(['stale-product']);
    const refreshJobCounters = jest
      .spyOn(service as any, 'refreshJobCounters')
      .mockResolvedValue(undefined);

    await (service as any).processJob('job-1');

    expect(deactivateMissingProducts).not.toHaveBeenCalled();
    expect(refreshJobCounters).toHaveBeenCalledWith('job-1', {
      deactivatedIds: [],
      reactivatedCount: 0,
    });
    expect(prisma.productImportJobItem.update).toHaveBeenCalledWith({
      where: { id: 'item-2' },
      data: expect.objectContaining({
        status: 'FAILED',
        error_message: 'Nome do veículo faltando',
      }),
    });
  });

  it('relata a linha não importada com erro em linguagem natural', () => {
    const service = new ProductImportJobsService(
      {} as any,
      {} as any,
      {} as any,
    );

    const result = (service as any).buildImportResponse([
      {
        row_number: 7,
        status: 'FAILED',
        payload: { ...validCarRow, modelo: '-' },
        action: null,
        product_id: null,
        error_message: 'Nome do veículo faltando',
        warnings: null,
      },
    ]);

    expect(result).toMatchObject({
      success: false,
      errorCount: 1,
      errorRows: [
        {
          row: 7,
          reason: 'Nome do veículo faltando',
        },
      ],
    });
  });

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
