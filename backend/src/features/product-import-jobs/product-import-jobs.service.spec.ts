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
    jest.spyOn(service as any, 'getJobExecutionContext').mockResolvedValue({
      mode: 'SYNCHRONIZE',
      syncConfirmed: true,
      syncPreviewSnapshot: { candidateIds: [], csvDigest: 'csv-digest' },
      specialistIsEligible: true,
    });
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

  it('reconstrói produtos vistos ao retomar sincronização parcialmente concluída', async () => {
    const specialistId = '00000000-0000-4000-8000-000000000001';
    const productA = '11111111-1111-4111-8111-111111111111';
    const productB = '22222222-2222-4222-8222-222222222222';
    const prisma = {
      productImportJob: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job-resume',
          product_type: ProductType.CAR,
          specialist_id: specialistId,
          status: 'PROCESSING',
          started_at: new Date('2026-10-23T12:00:00.000Z'),
          items: [
            {
              id: 'item-a',
              status: 'COMPLETED',
              product_id: productA,
              payload: validCarRow,
              folder_url: null,
            },
            {
              id: 'item-b',
              status: 'PENDING',
              product_id: null,
              payload: {
                ...validCarRow,
                identificador: 'FERRARI-ROMA-2',
              },
              folder_url: null,
            },
          ],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      productImportJobItem: {
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const service = new ProductImportJobsService(prisma, {} as any, {} as any);
    jest.spyOn(service as any, 'getJobExecutionContext').mockResolvedValue({
      mode: 'SYNCHRONIZE',
      syncConfirmed: true,
      syncPreviewSnapshot: { candidateIds: [], csvDigest: 'csv-digest' },
      specialistIsEligible: true,
    });
    jest.spyOn(service as any, 'upsertProductFromRow').mockResolvedValue({
      productId: productB,
      action: 'UPDATED',
    });
    const deactivateMissingProducts = jest
      .spyOn(service as any, 'deactivateMissingProducts')
      .mockImplementation(async (_type, _specialist, seen: Set<string>) =>
        seen.has(productA) && seen.has(productB) ? [] : [productA],
      );
    const refreshJobCounters = jest
      .spyOn(service as any, 'refreshJobCounters')
      .mockResolvedValue(undefined);

    await (service as any).processJob('job-resume');

    expect(deactivateMissingProducts).toHaveBeenCalledWith(
      ProductType.CAR,
      specialistId,
      new Set([productA, productB]),
      'job-resume',
      { candidateIds: [], csvDigest: 'csv-digest' },
    );
    expect(refreshJobCounters).toHaveBeenCalledWith('job-resume', {
      deactivatedIds: [],
      reactivatedCount: 0,
    });
  });

  it('leva o snapshot confirmado para a revalidação transacional antes de desativar', async () => {
    const snapshot = {
      candidateIds: ['22222222-2222-4222-8222-222222222222'],
      csvDigest: 'csv-digest',
    };
    const prisma = {
      productImportJob: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job-snapshot',
          product_type: ProductType.CAR,
          specialist_id: '00000000-0000-4000-8000-000000000001',
          status: 'PROCESSING',
          started_at: new Date(),
          items: [
            {
              id: 'item-seen',
              status: 'COMPLETED',
              product_id: '11111111-1111-4111-8111-111111111111',
              payload: validCarRow,
              folder_url: null,
            },
          ],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const service = new ProductImportJobsService(prisma, {} as any, {} as any);
    jest.spyOn(service as any, 'getJobExecutionContext').mockResolvedValue({
      mode: 'SYNCHRONIZE',
      syncConfirmed: true,
      syncPreviewSnapshot: snapshot,
      specialistIsEligible: true,
    });
    const deactivateMissingProducts = jest
      .spyOn(service as any, 'deactivateMissingProducts')
      .mockResolvedValue([]);
    jest
      .spyOn(service as any, 'refreshJobCounters')
      .mockResolvedValue(undefined);

    await (service as any).processJob('job-snapshot');

    expect(deactivateMissingProducts).toHaveBeenCalledWith(
      ProductType.CAR,
      '00000000-0000-4000-8000-000000000001',
      new Set(['11111111-1111-4111-8111-111111111111']),
      'job-snapshot',
      snapshot,
    );
  });

  it('reprocessa item PROCESSING de forma idempotente após upsert sem checkpoint', async () => {
    const existingProductId = '11111111-1111-4111-8111-111111111111';
    const itemUpdate = jest.fn().mockResolvedValue({});
    const prisma = {
      productImportJob: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job-interrupted',
          product_type: ProductType.CAR,
          specialist_id: '00000000-0000-4000-8000-000000000001',
          status: 'PROCESSING',
          started_at: new Date(),
          items: [
            {
              id: 'item-processing',
              status: 'PROCESSING',
              product_id: null,
              payload: validCarRow,
              folder_url: null,
            },
          ],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      productImportJobItem: { update: itemUpdate },
    } as any;
    const service = new ProductImportJobsService(prisma, {} as any, {} as any);
    jest.spyOn(service as any, 'getJobExecutionContext').mockResolvedValue({
      mode: 'ADDITIVE',
      syncConfirmed: false,
      syncPreviewSnapshot: null,
      specialistIsEligible: true,
    });
    const upsert = jest
      .spyOn(service as any, 'upsertProductFromRow')
      .mockResolvedValue({
        productId: existingProductId,
        action: 'UPDATED',
      });
    jest
      .spyOn(service as any, 'refreshJobCounters')
      .mockResolvedValue(undefined);

    await (service as any).processJob('job-interrupted');

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(itemUpdate).toHaveBeenLastCalledWith({
      where: { id: 'item-processing' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        product_id: existingProductId,
        action: 'UPDATED',
      }),
    });
  });

  it('não inativa produtos ausentes no modo aditivo', async () => {
    const prisma = {
      productImportJob: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job-additive',
          product_type: ProductType.CAR,
          specialist_id: '00000000-0000-4000-8000-000000000001',
          status: 'PENDING',
          started_at: null,
          items: [],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const service = new ProductImportJobsService(prisma, {} as any, {} as any);
    jest.spyOn(service as any, 'getJobExecutionContext').mockResolvedValue({
      mode: 'ADDITIVE',
      syncConfirmed: false,
      specialistIsEligible: true,
    });
    const deactivateMissingProducts = jest
      .spyOn(service as any, 'deactivateMissingProducts')
      .mockResolvedValue(['stale-product']);
    const refreshJobCounters = jest
      .spyOn(service as any, 'refreshJobCounters')
      .mockResolvedValue(undefined);

    await (service as any).processJob('job-additive');

    expect(deactivateMissingProducts).not.toHaveBeenCalled();
    expect(refreshJobCounters).toHaveBeenCalledWith('job-additive', {
      deactivatedIds: [],
      reactivatedCount: 0,
    });
  });

  it('mantém o job pendente quando o especialista-alvo foi desativado', async () => {
    const prisma = {
      productImportJob: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job-inactive',
          product_type: ProductType.CAR,
          specialist_id: '00000000-0000-4000-8000-000000000001',
          status: 'PENDING',
          started_at: null,
          items: [],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const service = new ProductImportJobsService(prisma, {} as any, {} as any);
    jest.spyOn(service as any, 'getJobExecutionContext').mockResolvedValue({
      mode: 'ADDITIVE',
      syncConfirmed: false,
      specialistIsEligible: false,
    });

    await (service as any).processJob('job-inactive');

    expect(prisma.productImportJob.update).toHaveBeenCalledTimes(1);
    expect(prisma.productImportJob.update).toHaveBeenCalledWith({
      where: { id: 'job-inactive' },
      data: expect.objectContaining({
        status: 'PENDING',
        error_message: expect.stringContaining('inativo'),
      }),
    });
  });

  it('exige confirmação explícita para sincronizar', async () => {
    const xlsxImportService = {
      parseCsv: jest.fn().mockReturnValue({ rows: [validCarRow] }),
      validateStructure: jest.fn().mockReturnValue({ valid: true }),
    } as any;
    const service = new ProductImportJobsService(
      {} as any,
      xlsxImportService,
      {} as any,
    );

    await expect(
      service.createJobFromCsv(
        Buffer.from('csv'),
        { id: 'admin-1', role: 'ADMIN' } as any,
        ProductType.CAR,
        {
          mode: 'SYNCHRONIZE',
          confirmSynchronize: false,
          context: {
            actorId: 'admin-1',
            actorRole: 'ADMIN',
            specialistId: '00000000-0000-4000-8000-000000000001',
            specialist: {} as any,
            delegated: true,
          },
        },
      ),
    ).rejects.toThrow('confirmação explícita');
  });

  it('exige token da prévia mesmo quando a sincronização foi confirmada', async () => {
    const xlsxImportService = {
      parseCsv: jest.fn().mockReturnValue({ rows: [validCarRow] }),
      validateStructure: jest.fn().mockReturnValue({ valid: true }),
    } as any;
    const prisma = {
      car: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (callback) =>
        callback({
          productImportJob: {
            create: jest.fn().mockResolvedValue({
              id: 'job-unsafe',
              status: 'PENDING',
              total_items: 1,
              product_type: ProductType.CAR,
            }),
          },
          $executeRaw: jest.fn(),
        }),
      ),
    } as any;
    const service = new ProductImportJobsService(
      prisma,
      xlsxImportService,
      {} as any,
    );
    jest.spyOn(service as any, 'scheduleJob').mockImplementation(() => {});

    await expect(
      service.createJobFromCsv(
        Buffer.from('csv'),
        { id: 'admin-1', role: 'ADMIN' } as any,
        ProductType.CAR,
        {
          mode: 'SYNCHRONIZE',
          confirmSynchronize: true,
          context: {
            actorId: 'admin-1',
            actorRole: 'ADMIN',
            specialistId: '00000000-0000-4000-8000-000000000001',
            specialist: {} as any,
            delegated: true,
          },
        },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'SYNCHRONIZE_PREVIEW_REQUIRED',
      }),
    });
  });

  it('calcula o impacto da sincronização antes de criar o job', async () => {
    const xlsxImportService = {
      parseCsv: jest.fn().mockReturnValue({ rows: [validCarRow] }),
      validateStructure: jest.fn().mockReturnValue({ valid: true }),
    } as any;
    const prisma = {
      car: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'keep', identificador: 'FERRARI-ROMA-1' },
          { id: 'stale', identificador: 'FERRARI-OLD-1' },
        ]),
      },
    } as any;
    const service = new ProductImportJobsService(
      prisma,
      xlsxImportService,
      {} as any,
    );

    const preview = await service.previewCsvImport(
        Buffer.from('csv'),
        ProductType.CAR,
        '00000000-0000-4000-8000-000000000001',
        'SYNCHRONIZE',
      );

    expect(preview).toMatchObject({
      mode: 'SYNCHRONIZE',
      targetSpecialistId: '00000000-0000-4000-8000-000000000001',
      requiresExplicitConfirmation: true,
      impact: {
        incomingItems: 1,
        activeItemsBefore: 2,
        matchingItems: 1,
        deactivationCandidates: 1,
      },
    });
    expect(preview).toEqual(
      expect.objectContaining({ synchronizePreviewToken: expect.any(String) }),
    );
  });

  it('rejeita confirmação quando os candidatos mudam antes do POST', async () => {
    const specialistId = '00000000-0000-4000-8000-000000000001';
    const activeProducts = [
      { id: '11111111-1111-4111-8111-111111111111', identificador: 'FERRARI-ROMA-1' },
      { id: '22222222-2222-4222-8222-222222222222', identificador: 'STALE-B' },
    ];
    const xlsxImportService = {
      parseCsv: jest.fn().mockReturnValue({ rows: [validCarRow] }),
      validateStructure: jest.fn().mockReturnValue({ valid: true }),
    } as any;
    const prisma = {
      car: {
        findMany: jest.fn().mockImplementation(async () => [...activeProducts]),
      },
      $transaction: jest.fn(async (callback) =>
        callback({
          productImportJob: {
            create: jest.fn().mockResolvedValue({
              id: 'job-stale',
              status: 'PENDING',
              total_items: 1,
              product_type: ProductType.CAR,
            }),
          },
          $executeRaw: jest.fn(),
        }),
      ),
    } as any;
    const service = new ProductImportJobsService(
      prisma,
      xlsxImportService,
      {} as any,
    );
    jest.spyOn(service as any, 'scheduleJob').mockImplementation(() => {});
    const file = Buffer.from('csv-stable');
    const preview = await service.previewCsvImport(
      file,
      ProductType.CAR,
      specialistId,
      'SYNCHRONIZE',
    );
    activeProducts.push({
      id: '33333333-3333-4333-8333-333333333333',
      identificador: 'NEW-C',
    });

    await expect(
      service.createJobFromCsv(
        file,
        { id: 'admin-1', role: 'ADMIN' } as any,
        ProductType.CAR,
        {
          mode: 'SYNCHRONIZE',
          confirmSynchronize: true,
          synchronizePreviewToken: preview.synchronizePreviewToken,
          context: {
            actorId: 'admin-1',
            actorRole: 'ADMIN',
            specialistId,
            specialist: {} as any,
            delegated: true,
          },
        },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SYNCHRONIZE_PREVIEW_STALE' }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
