import { ProductImportJobsService } from './product-import-jobs.service';
import { Prisma, ProductCurrency, ProductType } from '@prisma/client';
import { XlsxImportService } from 'src/shared/services/xlsx-import.service';

describe('ProductImportJobsService', () => {
  beforeEach(() => {
    jest
      .spyOn(ProductImportJobsService.prototype as any, 'claimJob')
      .mockResolvedValue('unit-test-lease');
    jest
      .spyOn(ProductImportJobsService.prototype as any, 'releaseJobLease')
      .mockResolvedValue(undefined);
    jest
      .spyOn(ProductImportJobsService.prototype as any, 'pauseIneligibleJob')
      .mockResolvedValue(undefined);
    jest
      .spyOn(ProductImportJobsService.prototype as any, 'checkpointProductUpsert')
      .mockImplementation(function (job: any, _item: any, payload: any) {
        return (this as any).upsertProductFromRow(
          job.product_type,
          payload,
          job.specialist_id,
        );
      });
    jest
      .spyOn(ProductImportJobsService.prototype as any, 'finalizeUnsynchronizedJob')
      .mockImplementation(function (jobId: string, summary: any) {
        return (this as any).refreshJobCounters(jobId, summary);
      });
    jest
      .spyOn(ProductImportJobsService.prototype as any, 'updateImportItemWithLease')
      .mockImplementation(function (
        _jobId: string,
        _leaseToken: string,
        itemId: string,
        data: any,
      ) {
        return (this as any).prisma.productImportJobItem.update({
          where: { id: itemId },
          data,
        });
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const validCarRow = {
    marca: 'Ferrari',
    modelo: 'Roma',
    identificador: 'FERRARI-ROMA-1',
    valor: '1000000',
    currency: 'BRL',
    estado: 'SP',
    ano: '2024',
  };

  it('repete uma transação serializável abortada por P2034', async () => {
    const transaction = jest
      .fn()
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (callback: any) => callback({ ok: true }));
    const service = new ProductImportJobsService(
      { $transaction: transaction } as any,
      {} as any,
      {} as any,
    );
    const operation = jest.fn().mockResolvedValue('done');

    await expect(
      (service as any).runSerializableWithRetry(operation),
    ).resolves.toBe('done');
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenCalledWith({ ok: true });
  });

  it.each([
    ['identificador', '-', 'Identificador faltando'],
    ['valor', '   ', 'Valor do produto faltando'],
    ['currency', ' - ', 'Moeda (use BRL ou USD) faltando'],
    ['currency', 'EUR', 'Moeda inválida "EUR": use BRL ou USD.'],
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
          cor: ' - ',
          km: '-',
          cambio: '   ',
        },
        '00000000-0000-4000-8000-000000000001',
      ),
    ).resolves.toEqual({ productId: 'uuid-1', action: 'CREATED' });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        currency: ProductCurrency.BRL,
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
              payload: { ...validCarRow, valor: '-' },
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
    jest
      .spyOn(service as any, 'assertSynchronizationSnapshotCurrent')
      .mockResolvedValue(undefined);
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
        error_message: 'Valor do produto faltando',
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
    jest
      .spyOn(service as any, 'assertSynchronizationSnapshotCurrent')
      .mockResolvedValue(undefined);
    jest.spyOn(service as any, 'upsertProductFromRow').mockResolvedValue({
      productId: productB,
      action: 'UPDATED',
    });
    const finalizeSynchronizedJob = jest
      .spyOn(service as any, 'finalizeSynchronizedJob')
      .mockResolvedValue(undefined);

    await (service as any).processJob('job-resume');

    expect(finalizeSynchronizedJob).toHaveBeenCalledWith(
      'job-resume',
      {
        productType: ProductType.CAR,
        specialistId,
        seenProductIds: new Set([productA, productB]),
        snapshot: { candidateIds: [], csvDigest: 'csv-digest' },
      },
      0,
      'unit-test-lease',
    );
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
    jest
      .spyOn(service as any, 'assertSynchronizationSnapshotCurrent')
      .mockResolvedValue(undefined);
    const finalizeSynchronizedJob = jest
      .spyOn(service as any, 'finalizeSynchronizedJob')
      .mockResolvedValue(undefined);

    await (service as any).processJob('job-snapshot');

    expect(finalizeSynchronizedJob).toHaveBeenCalledWith(
      'job-snapshot',
      {
        productType: ProductType.CAR,
        specialistId: '00000000-0000-4000-8000-000000000001',
        seenProductIds: new Set(['11111111-1111-4111-8111-111111111111']),
        snapshot,
      },
      0,
      'unit-test-lease',
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

    expect((service as any).pauseIneligibleJob).toHaveBeenCalledWith(
      'job-inactive',
      'unit-test-lease',
    );
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

  it('rejeita identificadores duplicados no mesmo CSV', async () => {
    const xlsxImportService = {
      parseCsv: jest.fn().mockReturnValue({
        rows: [validCarRow, { ...validCarRow, modelo: 'Duplicado' }],
      }),
      validateStructure: jest.fn().mockReturnValue({ valid: true }),
    } as any;
    const service = new ProductImportJobsService(
      {} as any,
      xlsxImportService,
      {} as any,
    );

    await expect(
      service.previewCsvImport(
        Buffer.from('csv-duplicado'),
        ProductType.CAR,
        '00000000-0000-4000-8000-000000000001',
        'SYNCHRONIZE',
      ),
    ).rejects.toThrow('identificadores duplicados');
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

  it('deriva impacto e token da mesma leitura do catálogo', async () => {
    const specialistId = '00000000-0000-4000-8000-000000000001';
    const productA = {
      id: '11111111-1111-4111-8111-111111111111',
      identificador: validCarRow.identificador,
    };
    const productC = {
      id: '33333333-3333-4333-8333-333333333333',
      identificador: 'NEW-C',
    };
    const catalogReads = [[productA], [productA, productC], [productA, productC]];
    const findMany = jest
      .fn()
      .mockImplementation(async () =>
        catalogReads.shift() ?? [productA, productC],
      );
    const xlsxImportService = {
      parseCsv: jest.fn().mockReturnValue({ rows: [validCarRow] }),
      validateStructure: jest.fn().mockReturnValue({ valid: true }),
    } as any;
    const prisma = {
      car: {
        findMany,
      },
      $transaction: jest.fn(async (callback) =>
        callback({
          car: { findMany },
          productImportJob: {
            create: jest.fn().mockResolvedValue({
              id: 'job-unsafe-preview',
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
    const file = Buffer.from('preview-race-csv');

    const preview = await service.previewCsvImport(
      file,
      ProductType.CAR,
      specialistId,
      'SYNCHRONIZE',
    );

    expect(preview.impact.deactivationCandidates).toBe(0);
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
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
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
    const findMany = jest.fn().mockImplementation(async () => [...activeProducts]);
    const prisma = {
      car: {
        findMany,
      },
      $transaction: jest.fn(async (callback) =>
        callback({
          car: { findMany },
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
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
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

  it('produto só com valor e moeda é criado com valores padrão', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'uuid-1' });
    const prisma = {
      car: { findFirst: jest.fn().mockResolvedValue(null), create },
    } as any;
    const service = new ProductImportJobsService(prisma, {} as any, {} as any);

    await (service as any).upsertProductFromRow(
      ProductType.CAR,
      { identificador: 'auto-abc', valor: '450000', currency: 'usd' },
      '00000000-0000-4000-8000-000000000001',
    );

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        identificador: 'auto-abc',
        marca: 'Carro',
        modelo: 'auto-abc',
        estado: 'não informado',
        ano: undefined,
        valor: 450000,
        currency: ProductCurrency.USD,
      }),
    });
  });

  it('reimport não sobrescreve com valores padrão o que foi editado à mão', async () => {
    const existing = { id: 'product-1', is_active: true };
    const update = jest.fn().mockResolvedValue({ updated_at: new Date() });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      car: {
        findFirst: jest.fn().mockResolvedValue(existing),
        findUnique: jest.fn().mockResolvedValue({
          id: 'product-1',
          valor: new Prisma.Decimal(450000),
          currency: ProductCurrency.BRL,
        }),
        update,
        create: jest.fn(),
      },
      process: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const service = new ProductImportJobsService(tx, {} as any, {} as any);

    await (service as any).upsertProductFromRow(
      ProductType.CAR,
      { identificador: 'auto-abc', valor: '450000', currency: 'BRL' },
      '00000000-0000-4000-8000-000000000001',
      tx,
    );

    const data = update.mock.calls[0][0].data;
    expect(data).toMatchObject({ identificador: 'auto-abc', valor: 450000 });
    expect(data.marca).toBeUndefined();
    expect(data.modelo).toBeUndefined();
    expect(data.estado).toBeUndefined();
    expect(tx.car.create).not.toHaveBeenCalled();
  });

  describe('identificador automático', () => {
    const parse = async (lines: string[]) => {
      const service = new ProductImportJobsService(
        {} as any,
        new XlsxImportService(),
        {} as any,
      );
      return (service as any).parseImportRows(
        Buffer.from(lines.join('\n'), 'utf-8'),
        ProductType.CAR,
      );
    };

    it('a mesma linha gera o mesmo identificador, mesmo com outro preço', async () => {
      const [first] = await parse(['marca;modelo;valor;currency', 'BMW;X5;450000;BRL']);
      const [repriced] = await parse(['marca;modelo;valor;currency', 'bmw;X5;399000;USD']);
      const [other] = await parse(['marca;modelo;valor;currency', 'BMW;X6;450000;BRL']);

      expect(first.identificador).toMatch(/^auto-[0-9a-f]{12}$/);
      expect(repriced.identificador).toBe(first.identificador);
      expect(other.identificador).not.toBe(first.identificador);
    });

    it('linhas só com valor e moeda se distinguem pelo preço', async () => {
      const rows = await parse(['valor;currency', '100;BRL', '200;BRL']);

      expect(rows[0].identificador).not.toBe(rows[1].identificador);
    });

    it('identificador informado é mantido', async () => {
      const [row] = await parse(['identificador;valor;currency', 'BMW-1;100;BRL']);

      expect(row.identificador).toBe('BMW-1');
    });

    it('rejeita linhas sem identificador com os mesmos dados', async () => {
      await expect(
        parse(['marca;valor;currency', 'BMW;100;BRL', 'BMW;200;BRL']),
      ).rejects.toThrow(/sem identificador com os mesmos dados/);
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
          currency: 'BRL',
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
        currency: 'BRL',
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
