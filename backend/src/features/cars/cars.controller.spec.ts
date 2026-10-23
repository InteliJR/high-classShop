import { ProductType } from '@prisma/client';
import { CarsController } from './cars.controller';

function mkController() {
  const carsService = {
    create: jest.fn().mockResolvedValue({ id: 'car-1' }),
    findOne: jest.fn().mockResolvedValue({
      id: 'car-1',
      specialist_id: 'spec-1',
    }),
    update: jest.fn().mockResolvedValue({ id: 'car-1' }),
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
  const controller = new CarsController(
    carsService,
    productImportJobsService,
    actorContext,
    audit,
  );
  return {
    controller,
    carsService,
    productImportJobsService,
    actorContext,
    audit,
  };
}

const specialist = {
  id: 'spec-1',
  role: 'SPECIALIST',
  speciality: 'CAR',
} as any;

describe('CarsController — Calendly opcional', () => {
  it('permite criação manual sem consultar Calendly', async () => {
    const { controller, carsService } = mkController();
    const dto = {} as any;

    await expect(controller.create(dto, specialist)).resolves.toEqual({
      id: 'car-1',
    });
    expect(dto.specialist_id).toBe(specialist.id);
    expect(carsService.create).toHaveBeenCalledWith(dto);
  });

  it('mantém ADMIN como ator e grava o SPECIALIST selecionado como owner', async () => {
    const { controller, carsService, actorContext, audit } = mkController();
    const admin = { id: 'admin-1', role: 'ADMIN' } as any;
    const dto = { specialist_id: 'spec-1' } as any;

    await controller.create(dto, admin);

    expect(actorContext.resolve).toHaveBeenCalledWith(
      admin,
      'spec-1',
      ProductType.CAR,
    );
    expect(carsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ specialist_id: 'spec-1' }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRODUCT_CREATE',
        resourceType: 'CAR',
        resourceId: 'car-1',
      }),
    );
  });

  it('não permite remover o owner com specialist_id null no PATCH', async () => {
    const { controller, carsService } = mkController();

    await expect(
      controller.update(
        'car-1',
        { specialist_id: null } as any,
        specialist,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(carsService.update).not.toHaveBeenCalled();
  });

  it('permite importação CSV sem consultar Calendly', async () => {
    const { controller, productImportJobsService } = mkController();
    const file = {
      buffer: Buffer.from('marca,modelo'),
      mimetype: 'text/csv',
      originalname: 'carros.csv',
    } as Express.Multer.File;

    await expect(controller.importCsv(file, specialist)).resolves.toEqual({
      id: 'job-1',
    });
    expect(productImportJobsService.createJobFromCsv).toHaveBeenCalledWith(
      file.buffer,
      specialist,
      ProductType.CAR,
      expect.objectContaining({
        mode: 'ADDITIVE',
        confirmSynchronize: false,
        context: expect.objectContaining({ specialistId: specialist.id }),
      }),
    );
  });
});
