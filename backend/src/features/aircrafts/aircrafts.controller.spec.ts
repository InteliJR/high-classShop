import { ProductType } from '@prisma/client';
import { AircraftsController } from './aircrafts.controller';

function mkController() {
  const aircraftsService = {
    create: jest.fn().mockResolvedValue({ id: 'aircraft-1' }),
  } as any;
  const productImportJobsService = {
    createJobFromCsv: jest.fn().mockResolvedValue({ id: 'job-1' }),
  } as any;
  const controller = new AircraftsController(
    aircraftsService,
    productImportJobsService,
  );
  return { controller, aircraftsService, productImportJobsService };
}

const specialist = {
  id: 'spec-1',
  role: 'SPECIALIST',
  speciality: 'AIRCRAFT',
} as any;

describe('AircraftsController — Calendly opcional', () => {
  it('permite criação manual sem consultar Calendly', async () => {
    const { controller, aircraftsService } = mkController();
    const dto = {} as any;

    await expect(controller.create(dto, specialist)).resolves.toEqual({
      id: 'aircraft-1',
    });
    expect(dto.specialist_id).toBe(specialist.id);
    expect(aircraftsService.create).toHaveBeenCalledWith(dto);
  });

  it('permite importação CSV sem consultar Calendly', async () => {
    const { controller, productImportJobsService } = mkController();
    const file = {
      buffer: Buffer.from('marca,modelo'),
      mimetype: 'text/csv',
      originalname: 'aeronaves.csv',
    } as Express.Multer.File;

    await expect(controller.importCsv(file, specialist)).resolves.toEqual({
      id: 'job-1',
    });
    expect(productImportJobsService.createJobFromCsv).toHaveBeenCalledWith(
      file.buffer,
      specialist,
      ProductType.AIRCRAFT,
    );
  });
});
