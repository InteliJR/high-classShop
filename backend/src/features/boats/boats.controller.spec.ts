import { ProductType } from '@prisma/client';
import { BoatsController } from './boats.controller';

function mkController() {
  const boatsService = {
    create: jest.fn().mockResolvedValue({ id: 'boat-1' }),
  } as any;
  const productImportJobsService = {
    createJobFromCsv: jest.fn().mockResolvedValue({ id: 'job-1' }),
  } as any;
  const controller = new BoatsController(boatsService, productImportJobsService);
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
    );
  });
});
