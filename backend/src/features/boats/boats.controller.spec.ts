import { ProductType } from '@prisma/client';
import { BoatsController } from './boats.controller';

function mkController() {
  const boatsService = {
    create: jest.fn().mockResolvedValue({ id: 'boat-1' }),
    findOne: jest.fn().mockResolvedValue({
      id: 'boat-1',
      specialist_id: 'spec-1',
    }),
    update: jest.fn().mockResolvedValue({ id: 'boat-1' }),
    prepareProductImages: jest.fn().mockResolvedValue([]),
    cleanupPreparedImages: jest.fn().mockResolvedValue(undefined),
  } as any;
  const productImportJobsService = {
    createJobFromCsv: jest.fn().mockResolvedValue({ id: 'job-1' }),
  } as any;
  const actorContext = {
    resolve: jest.fn().mockImplementation(async (user, target) => ({
      actorId: user.id,
      actorRole: user.role,
      specialistId: target ?? user.id,
      delegated: user.role === 'ADMIN',
      specialist: {},
    })),
    assertResourceSpecialist: jest.fn(),
  } as any;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
  const tx = { name: 'tx' } as any;
  const prisma = {
    $transaction: jest.fn(async (callback) => callback(tx)),
  } as any;
  const controller = new (BoatsController as any)(
    boatsService,
    productImportJobsService,
    actorContext,
    audit,
    prisma,
  );
  return {
    controller,
    boatsService,
    productImportJobsService,
    audit,
    prisma,
    tx,
  };
}

const specialist = {
  id: 'spec-1',
  role: 'SPECIALIST',
  speciality: 'BOAT',
} as any;

describe('BoatsController — Calendly opcional', () => {
  it('permite criação manual sem consultar Calendly', async () => {
    const { controller, boatsService, tx } = mkController();
    const dto = {} as any;

    await expect(controller.create(dto, specialist)).resolves.toEqual({
      id: 'boat-1',
    });
    expect(dto.specialist_id).toBe(specialist.id);
    expect(boatsService.create).toHaveBeenCalledWith(
      dto,
      tx,
      expect.objectContaining({ productId: expect.any(String), images: [] }),
    );
  });

  it('não permite trocar o owner no PATCH comum', async () => {
    const { controller, boatsService } = mkController();

    await expect(
      controller.update(
        'boat-1',
        { specialist_id: 'spec-2' } as any,
        specialist,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(boatsService.update).not.toHaveBeenCalled();
  });

  it('executa criação manual e auditoria na mesma transação', async () => {
    const { controller, boatsService, audit, prisma, tx } = mkController();
    audit.record.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(controller.create({} as any, specialist)).rejects.toThrow(
      'audit unavailable',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(boatsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ specialist_id: specialist.id }),
      tx,
      expect.objectContaining({ productId: expect.any(String), images: [] }),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.any(Object), tx);
  });

  it('aguarda upload fora da transação e compensa se a auditoria falhar', async () => {
    const { controller, boatsService, audit, prisma } = mkController();
    const prepared = [{ image_url: 'boats/new-key.jpg', is_primary: true }];
    let finishUpload!: (images: typeof prepared) => void;
    boatsService.prepareProductImages.mockReturnValueOnce(
      new Promise((resolve) => {
        finishUpload = resolve;
      }),
    );
    audit.record.mockRejectedValueOnce(new Error('audit unavailable'));

    const operation = controller.create(
      { images: [{ data: 'base64', is_primary: true }] } as any,
      specialist,
    );
    const rejection = expect(operation).rejects.toThrow('audit unavailable');
    await Promise.resolve();

    expect(boatsService.prepareProductImages).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    finishUpload(prepared);
    await rejection;
    expect(boatsService.cleanupPreparedImages).toHaveBeenCalledWith(prepared);
  });

  it('também prepara PATCH fora da transação e compensa falha de auditoria', async () => {
    const { controller, boatsService, audit, prisma } = mkController();
    const prepared = [{ image_url: 'boats/patch-key.jpg', is_primary: true }];
    let finishUpload!: (images: typeof prepared) => void;
    boatsService.prepareProductImages.mockReturnValueOnce(
      new Promise((resolve) => {
        finishUpload = resolve;
      }),
    );
    audit.record.mockRejectedValueOnce(new Error('audit unavailable'));

    const operation = controller.update(
      'boat-1',
      { images: [{ data: 'base64', is_primary: true }] } as any,
      specialist,
    );
    const rejection = expect(operation).rejects.toThrow('audit unavailable');
    await Promise.resolve();
    await Promise.resolve();

    expect(boatsService.prepareProductImages).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    finishUpload(prepared);
    await rejection;
    expect(boatsService.cleanupPreparedImages).toHaveBeenCalledWith(prepared);
  });

  it('permite importação CSV sem consultar Calendly', async () => {
    const { controller, productImportJobsService } = mkController();
    const file = {
      buffer: Buffer.from('marca,modelo'),
      mimetype: 'text/csv',
      originalname: 'embarcacoes.csv',
    } as Express.Multer.File;

    await expect(controller.importCsv(file, specialist)).resolves.toEqual({
      id: 'job-1',
    });
    expect(productImportJobsService.createJobFromCsv).toHaveBeenCalledWith(
      file.buffer,
      specialist,
      ProductType.BOAT,
      expect.objectContaining({
        mode: 'ADDITIVE',
        confirmSynchronize: false,
        context: expect.objectContaining({ specialistId: specialist.id }),
      }),
    );
  });
});
