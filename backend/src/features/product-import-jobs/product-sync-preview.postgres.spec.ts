import { randomUUID } from 'node:crypto';
import {
  PrismaClient,
  ProductImportJobStatus,
  ProductType,
  UserRole,
} from '@prisma/client';
import { ProductImportJobsService } from './product-import-jobs.service';

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

  function createService() {
    const service = new ProductImportJobsService(
      prisma as any,
      xlsx,
      { importImagesForProductFromFolder: jest.fn() } as any,
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
      select: { id: true, identificador: true, is_active: true },
    });
    expect(products).toHaveLength(3);
    expect(products.every((product) => product.is_active)).toBe(true);
    expect(products.find((product) => product.id === productC.id)?.is_active).toBe(
      true,
    );
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
});
