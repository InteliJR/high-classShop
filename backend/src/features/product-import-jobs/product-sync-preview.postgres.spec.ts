import { randomUUID } from 'node:crypto';
import {
  PrismaClient,
  ProductImportJobStatus,
  ProductType,
  UserRole,
} from '@prisma/client';
import { ProductImportJobsService } from './product-import-jobs.service';
import { acquireProductMonetaryLock } from '../products/product-monetary-lock';

const databaseUrl = process.env.POSTGRES_CONCURRENCY_TEST_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres('product synchronization preview — PostgreSQL', () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl! } },
  });
  const specialistId = randomUUID();
  const adminId = randomUUID();
  const suffix = randomUUID().replaceAll('-', '');
  const row = {
    marca: 'Ferrari',
    modelo: 'Roma',
    identificador: `KEEP-${suffix}`,
    valor: '1000000',
    estado: 'SP',
    ano: '2024',
  };
  const xlsx = {
    parseCsv: jest.fn().mockReturnValue({ rows: [row] }),
    validateStructure: jest.fn().mockReturnValue({ valid: true }),
  } as any;

  beforeAll(async () => {
    process.env.PRODUCT_IMPORT_PREVIEW_SECRET = 'postgres-preview-secret';
    await prisma.user.create({
      data: {
        id: specialistId,
        name: 'Sync',
        surname: 'Specialist',
        email: `sync-${suffix}@example.test`,
        rg: suffix.slice(0, 11),
        role: UserRole.SPECIALIST,
        speciality: ProductType.CAR,
        password_hash: 'not-used',
      },
    });
  });

  beforeEach(async () => {
    xlsx.parseCsv.mockReturnValue({ rows: [row] });
    await prisma.productImportJob.deleteMany({
      where: { specialist_id: specialistId },
    });
    await prisma.car.deleteMany({ where: { specialist_id: specialistId } });
    await prisma.car.createMany({
      data: [
        {
          specialist_id: specialistId,
          identificador: row.identificador,
          marca: row.marca,
          modelo: row.modelo,
          valor: Number(row.valor),
          estado: row.estado,
          ano: Number(row.ano),
        },
        {
          specialist_id: specialistId,
          identificador: `STALE-B-${suffix}`,
          marca: 'Legacy',
          modelo: 'B',
          valor: 500000,
          estado: 'SP',
          ano: 2020,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.productImportJob.deleteMany({
      where: { specialist_id: specialistId },
    });
    await prisma.car.deleteMany({ where: { specialist_id: specialistId } });
    await prisma.user.delete({ where: { id: specialistId } });
    await prisma.$disconnect();
    delete process.env.PRODUCT_IMPORT_PREVIEW_SECRET;
  });

  function createService(
    drive = { importImagesForProductFromFolder: jest.fn() } as any,
  ) {
    const service = new ProductImportJobsService(
      prisma as any,
      xlsx,
      drive,
    );
    jest.spyOn(service as any, 'scheduleJob').mockImplementation(() => {});
    return service;
  }

  function options(token: string) {
    return {
      mode: 'SYNCHRONIZE' as const,
      confirmSynchronize: true,
      synchronizePreviewToken: token,
      context: {
        actorId: adminId,
        actorRole: UserRole.ADMIN,
        actor: { id: adminId, role: UserRole.ADMIN, name: 'Admin', surname: '' },
        specialistId,
        specialist: {} as any,
        delegated: true,
      },
    };
  }

  it('rejeita o POST se um novo candidato surgiu depois da prévia', async () => {
    const service = createService();
    const file = Buffer.from('same-csv');
    const preview = await service.previewCsvImport(
      file,
      ProductType.CAR,
      specialistId,
      'SYNCHRONIZE',
    );
    await prisma.car.create({
      data: {
        specialist_id: specialistId,
        identificador: `NEW-C-BEFORE-${suffix}`,
        marca: 'New',
        modelo: 'C',
        valor: 600000,
        estado: 'RJ',
        ano: 2025,
      },
    });

    await expect(
      service.createJobFromCsv(
        file,
        { id: adminId, role: UserRole.ADMIN } as any,
        ProductType.CAR,
        options(preview.synchronizePreviewToken!),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SYNCHRONIZE_PREVIEW_STALE' }),
    });
    await expect(
      prisma.productImportJob.count({ where: { specialist_id: specialistId } }),
    ).resolves.toBe(0);
  });

  it('rejeita o POST se um produto do CSV saiu do catálogo sem mudar candidatos', async () => {
    const service = createService();
    const file = Buffer.from('same-csv');
    const preview = await service.previewCsvImport(
      file,
      ProductType.CAR,
      specialistId,
      'SYNCHRONIZE',
    );
    await prisma.car.updateMany({
      where: {
        specialist_id: specialistId,
        identificador: row.identificador,
      },
      data: { is_active: false, deactivated_at: new Date() },
    });

    await expect(
      service.createJobFromCsv(
        file,
        { id: adminId, role: UserRole.ADMIN } as any,
        ProductType.CAR,
        options(preview.synchronizePreviewToken!),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SYNCHRONIZE_PREVIEW_STALE' }),
    });
    await expect(
      prisma.productImportJob.count({ where: { specialist_id: specialistId } }),
    ).resolves.toBe(0);
  });

  it('não desativa nada se o catálogo mudar entre o POST e a execução', async () => {
    const service = createService();
    const file = Buffer.from('same-csv');
    const preview = await service.previewCsvImport(
      file,
      ProductType.CAR,
      specialistId,
      'SYNCHRONIZE',
    );
    const accepted = await service.createJobFromCsv(
      file,
      { id: adminId, role: UserRole.ADMIN } as any,
      ProductType.CAR,
      options(preview.synchronizePreviewToken!),
    );
    await prisma.car.updateMany({
      where: {
        specialist_id: specialistId,
        identificador: row.identificador,
      },
      data: { modelo: 'Antes do worker', valor: 123456 },
    });
    const productC = await prisma.car.create({
      data: {
        specialist_id: specialistId,
        identificador: `NEW-C-AFTER-${suffix}`,
        marca: 'New',
        modelo: 'C',
        valor: 600000,
        estado: 'RJ',
        ano: 2025,
      },
    });

    await (service as any).processJob(accepted.jobId);

    const products = await prisma.car.findMany({
      where: { specialist_id: specialistId },
      select: {
        id: true,
        identificador: true,
        modelo: true,
        valor: true,
        is_active: true,
      },
    });
    expect(products).toHaveLength(3);
    expect(products.every((product) => product.is_active)).toBe(true);
    expect(products.find((product) => product.id === productC.id)?.is_active).toBe(
      true,
    );
    const kept = products.find(
      (product) => product.identificador === row.identificador,
    );
    expect(kept?.modelo).toBe('Antes do worker');
    expect(Number(kept?.valor)).toBe(123456);
    await expect(
      prisma.productImportJob.findUniqueOrThrow({
        where: { id: accepted.jobId },
        select: {
          status: true,
          deactivated_items: true,
          error_message: true,
        },
      }),
    ).resolves.toMatchObject({
      status: ProductImportJobStatus.FAILED,
      deactivated_items: 0,
      error_message: expect.stringContaining('catálogo mudou'),
    });
  });

  it('não processa linhas se produto do CSV sair do catálogo antes do worker', async () => {
    const service = createService();
    const file = Buffer.from('same-csv');
    const preview = await service.previewCsvImport(
      file,
      ProductType.CAR,
      specialistId,
      'SYNCHRONIZE',
    );
    const accepted = await service.createJobFromCsv(
      file,
      { id: adminId, role: UserRole.ADMIN } as any,
      ProductType.CAR,
      options(preview.synchronizePreviewToken!),
    );
    const matching = await prisma.car.findFirstOrThrow({
      where: {
        specialist_id: specialistId,
        identificador: row.identificador,
      },
    });
    await prisma.car.update({
      where: { id: matching.id },
      data: {
        is_active: false,
        deactivated_at: new Date(),
        modelo: 'External change',
        valor: 321654,
      },
    });

    await (service as any).processJob(accepted.jobId);

    const unchanged = await prisma.car.findUniqueOrThrow({
      where: { id: matching.id },
    });
    expect(unchanged).toMatchObject({
      is_active: false,
      modelo: 'External change',
    });
    expect(Number(unchanged.valor)).toBe(321654);
    await expect(
      prisma.productImportJob.findUniqueOrThrow({
        where: { id: accepted.jobId },
        select: { status: true, success_items: true },
      }),
    ).resolves.toEqual({
      status: ProductImportJobStatus.FAILED,
      success_items: 0,
    });
  });

  it('desativa somente o candidato consentido quando o snapshot permanece igual', async () => {
    const service = createService();
    const file = Buffer.from('same-csv');
    const preview = await service.previewCsvImport(
      file,
      ProductType.CAR,
      specialistId,
      'SYNCHRONIZE',
    );
    const accepted = await service.createJobFromCsv(
      file,
      { id: adminId, role: UserRole.ADMIN } as any,
      ProductType.CAR,
      options(preview.synchronizePreviewToken!),
    );

    await (service as any).processJob(accepted.jobId);

    const products = await prisma.car.findMany({
      where: { specialist_id: specialistId },
      select: { identificador: true, is_active: true },
    });
    expect(
      products.find((product) => product.identificador === row.identificador),
    ).toMatchObject({ is_active: true });
    expect(
      products.find((product) => product.identificador.startsWith('STALE-B-')),
    ).toMatchObject({ is_active: false });
    await expect(
      prisma.productImportJob.findUniqueOrThrow({
        where: { id: accepted.jobId },
        select: { status: true, deactivated_items: true },
      }),
    ).resolves.toEqual({
      status: ProductImportJobStatus.COMPLETED,
      deactivated_items: 1,
    });
  });

  it('relata alterações parciais se D surgir durante o processamento', async () => {
    const service = createService();
    const file = Buffer.from('same-csv');
    const preview = await service.previewCsvImport(
      file,
      ProductType.CAR,
      specialistId,
      'SYNCHRONIZE',
    );
    const accepted = await service.createJobFromCsv(
      file,
      { id: adminId, role: UserRole.ADMIN } as any,
      ProductType.CAR,
      options(preview.synchronizePreviewToken!),
    );
    const realUpsert = (service as any).upsertProductFromRow.bind(service);
    let productDId: string | undefined;
    jest
      .spyOn(service as any, 'upsertProductFromRow')
      .mockImplementation(async (...args: unknown[]) => {
        const result = await realUpsert(...args);
        const productD = await prisma.car.create({
          data: {
            specialist_id: specialistId,
            identificador: `NEW-D-DURING-${suffix}`,
            marca: 'New',
            modelo: 'D',
            valor: 700000,
            estado: 'MG',
            ano: 2026,
          },
        });
        productDId = productD.id;
        return result;
      });

    await (service as any).processJob(accepted.jobId);

    const products = await prisma.car.findMany({
      where: { specialist_id: specialistId },
      select: { id: true, identificador: true, modelo: true, is_active: true },
    });
    const kept = products.find(
      (product) => product.identificador === row.identificador,
    );
    expect(kept).toMatchObject({ modelo: row.modelo, is_active: true });
    expect(products.find((product) => product.id === productDId)).toMatchObject({
      is_active: true,
    });
    expect(
      products.find((product) => product.identificador.startsWith('STALE-B-')),
    ).toMatchObject({ is_active: true });

    const status = await service.getJobStatus(
      accepted.jobId,
      { id: adminId, role: UserRole.ADMIN } as any,
      specialistId,
    );
    expect(status).toMatchObject({
      status: ProductImportJobStatus.COMPLETED_WITH_ERRORS,
      deactivatedItems: 0,
      errorMessage: expect.stringContaining('Importação parcial'),
      result: {
        message: expect.stringContaining('Importação parcial'),
        updatedIds: [kept!.id],
        deactivatedCount: 0,
      },
    });
  });

  it('detecta alteração externa de A depois do checkpoint e antes da finalização', async () => {
    let keptId = '';
    let leaseWasExtendedForDrive = false;
    const drive = {
      importImagesForProductFromFolder: jest.fn(async () => {
        const [lease] = await prisma.$queryRaw<
          Array<{ extended: boolean }>
        >`
          SELECT "processing_lease_expires_at" > NOW() + INTERVAL '20 minutes' AS "extended"
          FROM "ProductImportJob"
          WHERE "id" = ${acceptedJobId}::uuid
        `;
        leaseWasExtendedForDrive = lease?.extended === true;
        await prisma.car.update({
          where: { id: keptId },
          data: { modelo: 'External after checkpoint', valor: 654321 },
        });
        return { failed: 0, warnings: [] };
      }),
    } as any;
    const service = createService(drive);
    let acceptedJobId = '';
    const file = Buffer.from('same-csv');
    const preview = await service.previewCsvImport(
      file,
      ProductType.CAR,
      specialistId,
      'SYNCHRONIZE',
    );
    const accepted = await service.createJobFromCsv(
      file,
      { id: adminId, role: UserRole.ADMIN } as any,
      ProductType.CAR,
      options(preview.synchronizePreviewToken!),
    );
    acceptedJobId = accepted.jobId;
    const kept = await prisma.car.findFirstOrThrow({
      where: { specialist_id: specialistId, identificador: row.identificador },
    });
    keptId = kept.id;
    await prisma.productImportJobItem.updateMany({
      where: { job_id: accepted.jobId },
      data: { folder_url: 'https://drive.example/folder' },
    });

    await (service as any).processJob(accepted.jobId);

    expect(leaseWasExtendedForDrive).toBe(true);

    await expect(
      prisma.car.findUniqueOrThrow({ where: { id: kept.id } }),
    ).resolves.toMatchObject({
      modelo: 'External after checkpoint',
      is_active: true,
    });
    await expect(
      prisma.productImportJob.findUniqueOrThrow({
        where: { id: accepted.jobId },
        select: { status: true, deactivated_items: true, error_message: true },
      }),
    ).resolves.toMatchObject({
      status: ProductImportJobStatus.COMPLETED_WITH_ERRORS,
      deactivated_items: 0,
      error_message: expect.stringContaining('Importação parcial'),
    });
  });

  it('retoma efeito checkpointado atomicamente sem repetir o upsert', async () => {
    const service = createService();
    const file = Buffer.from('same-csv');
    const preview = await service.previewCsvImport(
      file,
      ProductType.CAR,
      specialistId,
      'SYNCHRONIZE',
    );
    const accepted = await service.createJobFromCsv(
      file,
      { id: adminId, role: UserRole.ADMIN } as any,
      ProductType.CAR,
      options(preview.synchronizePreviewToken!),
    );
    const kept = await prisma.car.findFirstOrThrow({
      where: { specialist_id: specialistId, identificador: row.identificador },
    });
    const updated = await prisma.car.update({
      where: { id: kept.id },
      data: { modelo: row.modelo, valor: Number(row.valor) },
    });
    const [version] = await prisma.$queryRaw<Array<{ rowVersion: string }>>`
      SELECT xmin::text AS "rowVersion"
      FROM "Car"
      WHERE "id" = ${kept.id}::uuid
    `;
    await prisma.productImportJobItem.updateMany({
      where: { job_id: accepted.jobId },
      data: {
        status: 'PROCESSING',
        product_id: kept.id,
        action: 'UPDATED',
        payload: {
          ...row,
          __productImportEffect: {
            productId: kept.id,
            action: 'UPDATED',
            rowVersion: version.rowVersion,
            updatedAt: updated.updated_at.toISOString(),
          },
        },
      },
    });
    const upsert = jest.spyOn(service as any, 'upsertProductFromRow');

    await (service as any).processJob(accepted.jobId);

    expect(upsert).not.toHaveBeenCalled();
    await expect(
      prisma.productImportJob.findUniqueOrThrow({
        where: { id: accepted.jobId },
        select: { status: true, deactivated_items: true },
      }),
    ).resolves.toEqual({
      status: ProductImportJobStatus.COMPLETED,
      deactivated_items: 1,
    });
  });

  it('concede o claim distribuído do job a apenas um worker', async () => {
    const first = createService();
    const second = createService();
    const file = Buffer.from('same-csv');
    const preview = await first.previewCsvImport(
      file,
      ProductType.CAR,
      specialistId,
      'SYNCHRONIZE',
    );
    const accepted = await first.createJobFromCsv(
      file,
      { id: adminId, role: UserRole.ADMIN } as any,
      ProductType.CAR,
      options(preview.synchronizePreviewToken!),
    );

    const claims = await Promise.all([
      (first as any).claimJob(accepted.jobId),
      (second as any).claimJob(accepted.jobId),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(claims.filter((claim) => claim === null)).toHaveLength(1);
  });

  it('impede worker antigo de gravar depois que outro assumiu o lease', async () => {
    const staleWorker = createService();
    const currentWorker = createService();
    const file = Buffer.from('same-csv');
    const preview = await staleWorker.previewCsvImport(
      file,
      ProductType.CAR,
      specialistId,
      'SYNCHRONIZE',
    );
    const accepted = await staleWorker.createJobFromCsv(
      file,
      { id: adminId, role: UserRole.ADMIN } as any,
      ProductType.CAR,
      options(preview.synchronizePreviewToken!),
    );
    const staleLease = await (staleWorker as any).claimJob(accepted.jobId);
    expect(staleLease).toEqual(expect.any(String));
    await prisma.$executeRaw`
      UPDATE "ProductImportJob"
      SET "processing_lease_expires_at" = NOW() - INTERVAL '1 second'
      WHERE "id" = ${accepted.jobId}::uuid
    `;
    const currentLease = await (currentWorker as any).claimJob(accepted.jobId);
    expect(currentLease).toEqual(expect.any(String));
    const job = await prisma.productImportJob.findUniqueOrThrow({
      where: { id: accepted.jobId },
      include: { items: true },
    });
    const item = job.items[0];

    await expect(
      (staleWorker as any).checkpointProductUpsert(
        job,
        item,
        { ...row, modelo: 'Stale worker mutation' },
        staleLease,
      ),
    ).rejects.toThrow(/lease/i);
    await (staleWorker as any).markJobFailedUnlessTerminal(
      accepted.jobId,
      'stale worker failure',
      staleLease,
    );

    await expect(
      prisma.car.findFirstOrThrow({
        where: { specialist_id: specialistId, identificador: row.identificador },
        select: { modelo: true },
      }),
    ).resolves.toEqual({ modelo: row.modelo });
    const leaseState = await prisma.$queryRaw<
      Array<{ status: ProductImportJobStatus; processing_lease_token: string }>
    >`
      SELECT "status", "processing_lease_token"::text
      FROM "ProductImportJob"
      WHERE "id" = ${accepted.jobId}::uuid
    `;
    expect(leaseState).toEqual([
      {
        status: ProductImportJobStatus.PROCESSING,
        processing_lease_token: currentLease,
      },
    ]);
  });

  it('detecta mudança externa mesmo quando updated_at coincide com o checkpoint', async () => {
    const service = createService();
    const file = Buffer.from('same-csv');
    const preview = await service.previewCsvImport(
      file,
      ProductType.CAR,
      specialistId,
      'SYNCHRONIZE',
    );
    const accepted = await service.createJobFromCsv(
      file,
      { id: adminId, role: UserRole.ADMIN } as any,
      ProductType.CAR,
      options(preview.synchronizePreviewToken!),
    );
    const lease = await (service as any).claimJob(accepted.jobId);
    const job = await prisma.productImportJob.findUniqueOrThrow({
      where: { id: accepted.jobId },
      include: { items: true },
    });
    const item = job.items[0];
    await (service as any).checkpointProductUpsert(
      job,
      item,
      item.payload,
      lease,
    );
    const checkpointed = await prisma.productImportJobItem.findUniqueOrThrow({
      where: { id: item.id },
    });
    const checkpointTimestamp = new Date(
      (checkpointed.payload as any).__productImportEffect.updatedAt,
    );
    await prisma.car.update({
      where: { id: checkpointed.product_id! },
      data: {
        modelo: 'External same timestamp',
        valor: 987654,
        updated_at: checkpointTimestamp,
      },
    });
    await (service as any).releaseJobLease(accepted.jobId, lease);

    await (service as any).processJob(accepted.jobId);

    await expect(
      prisma.car.findUniqueOrThrow({ where: { id: checkpointed.product_id! } }),
    ).resolves.toMatchObject({
      modelo: 'External same timestamp',
      is_active: true,
    });
    await expect(
      prisma.productImportJob.findUniqueOrThrow({
        where: { id: accepted.jobId },
        select: { status: true, deactivated_items: true, error_message: true },
      }),
    ).resolves.toMatchObject({
      status: ProductImportJobStatus.COMPLETED_WITH_ERRORS,
      deactivated_items: 0,
      error_message: expect.stringContaining('Importação parcial'),
    });
    await expect(
      prisma.productImportJobItem.findUniqueOrThrow({
        where: { id: item.id },
        select: { status: true, warnings: true },
      }),
    ).resolves.toMatchObject({
      status: 'COMPLETED_WITH_WARNINGS',
      warnings: expect.arrayContaining([
        expect.stringContaining('catálogo mudou'),
      ]),
    });
    const status = await service.getJobStatus(
      accepted.jobId,
      { id: adminId, role: UserRole.ADMIN } as any,
      specialistId,
    );
    expect(status.result.updatedIds).toContain(checkpointed.product_id);
  });

  it('não finaliza se produto criado pelo job for removido após o checkpoint', async () => {
    const createdRow = {
      ...row,
      identificador: `CREATED-THEN-DELETED-${suffix}`,
      modelo: 'Created then deleted',
    };
    xlsx.parseCsv.mockReturnValue({ rows: [createdRow] });
    let createdId = '';
    const drive = {
      importImagesForProductFromFolder: jest.fn(async ({ product_id }) => {
        createdId = product_id;
        await prisma.car.delete({ where: { id: product_id } });
        return { failed: 0, warnings: [] };
      }),
    } as any;
    const service = createService(drive);
    const file = Buffer.from('created-delete-csv');
    const preview = await service.previewCsvImport(
      file,
      ProductType.CAR,
      specialistId,
      'SYNCHRONIZE',
    );
    const accepted = await service.createJobFromCsv(
      file,
      { id: adminId, role: UserRole.ADMIN } as any,
      ProductType.CAR,
      options(preview.synchronizePreviewToken!),
    );
    await prisma.productImportJobItem.updateMany({
      where: { job_id: accepted.jobId },
      data: { folder_url: 'https://drive.example/folder' },
    });

    await (service as any).processJob(accepted.jobId);

    expect(createdId).toEqual(expect.any(String));
    await expect(
      prisma.car.count({ where: { id: createdId } }),
    ).resolves.toBe(0);
    await expect(
      prisma.car.count({
        where: { specialist_id: specialistId, is_active: true },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.productImportJob.findUniqueOrThrow({
        where: { id: accepted.jobId },
        select: { status: true, deactivated_items: true, error_message: true },
      }),
    ).resolves.toMatchObject({
      status: ProductImportJobStatus.COMPLETED_WITH_ERRORS,
      deactivated_items: 0,
      error_message: expect.stringContaining('Importação parcial'),
    });
  });

  it('não cria deadlock com uma mutação manual que já detém o lock monetário', async () => {
    const service = createService();
    const file = Buffer.from('same-csv');
    const preview = await service.previewCsvImport(
      file,
      ProductType.CAR,
      specialistId,
      'SYNCHRONIZE',
    );
    const accepted = await service.createJobFromCsv(
      file,
      { id: adminId, role: UserRole.ADMIN } as any,
      ProductType.CAR,
      options(preview.synchronizePreviewToken!),
    );
    const candidate = await prisma.car.findFirstOrThrow({
      where: {
        specialist_id: specialistId,
        identificador: { startsWith: 'STALE-B-' },
      },
    });
    let advisoryReady!: () => void;
    const advisoryAcquired = new Promise<void>((resolve) => {
      advisoryReady = resolve;
    });
    let allowManualUpdate!: () => void;
    const manualUpdateGate = new Promise<void>((resolve) => {
      allowManualUpdate = resolve;
    });
    const manualUpdate = prisma.$transaction(async (tx) => {
      await acquireProductMonetaryLock(tx, {
        productType: ProductType.CAR,
        productId: candidate.id,
      });
      advisoryReady();
      await manualUpdateGate;
      return tx.car.update({
        where: { id: candidate.id },
        data: { modelo: 'Manual after sync lock' },
      });
    });
    await advisoryAcquired;

    const realCatalogLock = (
      service as any
    ).lockProductCatalogForSnapshot.bind(service);
    let catalogReady!: () => void;
    const catalogLocked = new Promise<void>((resolve) => {
      catalogReady = resolve;
    });
    jest
      .spyOn(service as any, 'lockProductCatalogForSnapshot')
      .mockImplementation(async (...args: unknown[]) => {
        const result = await realCatalogLock(...args);
        catalogReady();
        return result;
      });
    const processing = (service as any).processJob(accepted.jobId);
    await catalogLocked;
    allowManualUpdate();

    await Promise.all([manualUpdate, processing]);

    await expect(
      prisma.productImportJob.findUniqueOrThrow({
        where: { id: accepted.jobId },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: ProductImportJobStatus.COMPLETED });
  });

  it('retoma como COMPLETED quando o próprio job já desativou o candidato', async () => {
    const service = createService();
    const file = Buffer.from('same-csv');
    const preview = await service.previewCsvImport(
      file,
      ProductType.CAR,
      specialistId,
      'SYNCHRONIZE',
    );
    const accepted = await service.createJobFromCsv(
      file,
      { id: adminId, role: UserRole.ADMIN } as any,
      ProductType.CAR,
      options(preview.synchronizePreviewToken!),
    );
    const [kept, candidate] = await Promise.all([
      prisma.car.findFirstOrThrow({
        where: {
          specialist_id: specialistId,
          identificador: row.identificador,
        },
      }),
      prisma.car.findFirstOrThrow({
        where: {
          specialist_id: specialistId,
          identificador: { startsWith: 'STALE-B-' },
        },
      }),
    ]);
    await prisma.$transaction([
      prisma.car.update({
        where: { id: candidate.id },
        data: {
          is_active: false,
          deactivated_at: new Date(),
          deactivated_by_sync_job_id: accepted.jobId,
        },
      }),
      prisma.productImportJobItem.updateMany({
        where: { job_id: accepted.jobId },
        data: {
          status: 'COMPLETED',
          product_id: kept.id,
          action: 'UPDATED',
          processed_at: new Date(),
        },
      }),
      prisma.productImportJob.update({
        where: { id: accepted.jobId },
        data: { status: ProductImportJobStatus.PROCESSING },
      }),
    ]);

    await (service as any).processJob(accepted.jobId);

    await expect(
      prisma.productImportJob.findUniqueOrThrow({
        where: { id: accepted.jobId },
        select: {
          status: true,
          deactivated_items: true,
          deactivated_product_ids: true,
          error_message: true,
        },
      }),
    ).resolves.toEqual({
      status: ProductImportJobStatus.COMPLETED,
      deactivated_items: 1,
      deactivated_product_ids: [candidate.id],
      error_message: null,
    });
  });

  it('relata retomada parcial se D surgiu após C ter sido desativado pelo job', async () => {
    const service = createService();
    const file = Buffer.from('same-csv');
    const preview = await service.previewCsvImport(
      file,
      ProductType.CAR,
      specialistId,
      'SYNCHRONIZE',
    );
    const accepted = await service.createJobFromCsv(
      file,
      { id: adminId, role: UserRole.ADMIN } as any,
      ProductType.CAR,
      options(preview.synchronizePreviewToken!),
    );
    const [kept, candidate] = await Promise.all([
      prisma.car.findFirstOrThrow({
        where: {
          specialist_id: specialistId,
          identificador: row.identificador,
        },
      }),
      prisma.car.findFirstOrThrow({
        where: {
          specialist_id: specialistId,
          identificador: { startsWith: 'STALE-B-' },
        },
      }),
    ]);
    await prisma.$transaction([
      prisma.car.update({
        where: { id: candidate.id },
        data: {
          is_active: false,
          deactivated_at: new Date(),
          deactivated_by_sync_job_id: accepted.jobId,
        },
      }),
      prisma.productImportJobItem.updateMany({
        where: { job_id: accepted.jobId },
        data: {
          status: 'COMPLETED',
          product_id: kept.id,
          action: 'UPDATED',
          processed_at: new Date(),
        },
      }),
      prisma.productImportJob.update({
        where: { id: accepted.jobId },
        data: { status: ProductImportJobStatus.PROCESSING },
      }),
    ]);
    const productD = await prisma.car.create({
      data: {
        specialist_id: specialistId,
        identificador: `NEW-D-RESUME-${suffix}`,
        marca: 'New',
        modelo: 'D',
        valor: 700000,
        estado: 'MG',
        ano: 2026,
      },
    });

    await (service as any).processJob(accepted.jobId);

    await expect(
      prisma.car.findUniqueOrThrow({
        where: { id: productD.id },
        select: { is_active: true },
      }),
    ).resolves.toEqual({ is_active: true });
    await expect(
      prisma.productImportJob.findUniqueOrThrow({
        where: { id: accepted.jobId },
        select: {
          status: true,
          deactivated_items: true,
          deactivated_product_ids: true,
          error_message: true,
        },
      }),
    ).resolves.toMatchObject({
      status: ProductImportJobStatus.COMPLETED_WITH_ERRORS,
      deactivated_items: 1,
      deactivated_product_ids: [candidate.id],
      error_message: expect.stringContaining('Importação parcial'),
    });
  });
});
