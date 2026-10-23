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
  const controller = new BoatsController(
    boatsService,
    productImportJobsService,
    actorContext,
    audit,
  );
  return { controller, boatsService, productImportJobsService };
}

const specialist = {
  id: 'spec-1',
  role: 'SPECIALIST',
  speciality: 'BOAT',
} as any;

describe('BoatsController — Calendly opcional', () => {
  it('permite criação manual sem consultar Calendly', async () => {
    const { controller, boatsService } = mkController();
    const dto = {} as any;

    await expect(controller.create(dto, specialist)).resolves.toEqual({
      id: 'boat-1',
    });
    expect(dto.specialist_id).toBe(specialist.id);
    expect(boatsService.create).toHaveBeenCalledWith(dto);
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
