import { ProductType, UserRole } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { ROLES_KEY } from 'src/shared/decorators/roles.decorator';
import { ActorContextService } from 'src/shared/actor-context/actor-context.service';
import { CarsController } from './cars.controller';

function mkController() {
  const carsService = {
    create: jest.fn().mockResolvedValue({ id: 'car-1' }),
    findOne: jest.fn().mockResolvedValue({
      id: 'car-1',
      specialist_id: 'spec-1',
    }),
    update: jest.fn().mockResolvedValue({ id: 'car-1' }),
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
  const controller = new (CarsController as any)(
    carsService,
    productImportJobsService,
    actorContext,
    audit,
    prisma,
  );
  return {
    controller,
    carsService,
    productImportJobsService,
    actorContext,
    audit,
    prisma,
    tx,
  };
}

const specialist = {
  id: 'spec-1',
  role: 'SPECIALIST',
  speciality: 'CAR',
} as any;

describe('CarsController — Calendly opcional', () => {
  it('permite criação manual sem consultar Calendly', async () => {
    const { controller, carsService, tx } = mkController();
    const dto = {} as any;

    await expect(controller.create(dto, specialist)).resolves.toEqual({
      id: 'car-1',
    });
    expect(dto.specialist_id).toBe(specialist.id);
    expect(carsService.create).toHaveBeenCalledWith(
      dto,
      tx,
      expect.objectContaining({ productId: expect.any(String), images: [] }),
    );
  });

  it('mantém ADMIN como ator e grava o SPECIALIST selecionado como owner', async () => {
    const { controller, carsService, actorContext, audit, tx } = mkController();
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
      tx,
      expect.objectContaining({ productId: expect.any(String), images: [] }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRODUCT_CREATE',
        resourceType: 'CAR',
        resourceId: 'car-1',
      }),
      tx,
    );
  });

  it('executa criação manual e auditoria na mesma transação', async () => {
    const { controller, carsService, audit, prisma, tx } = mkController();
    audit.record.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(controller.create({} as any, specialist)).rejects.toThrow(
      'audit unavailable',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(carsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ specialist_id: specialist.id }),
      tx,
      expect.objectContaining({ productId: expect.any(String), images: [] }),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.any(Object), tx);
  });

  it('aguarda upload fora da transação e compensa se a auditoria falhar', async () => {
    const { controller, carsService, audit, prisma } = mkController();
    const prepared = [{ image_url: 'cars/new-key.jpg', is_primary: true }];
    let finishUpload!: (images: typeof prepared) => void;
    carsService.prepareProductImages.mockReturnValueOnce(
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

    expect(carsService.prepareProductImages).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    finishUpload(prepared);
    await rejection;
    expect(carsService.cleanupPreparedImages).toHaveBeenCalledWith(prepared);
  });

  it('também prepara PATCH fora da transação e compensa falha de auditoria', async () => {
    const { controller, carsService, audit, prisma } = mkController();
    const prepared = [{ image_url: 'cars/patch-key.jpg', is_primary: true }];
    let finishUpload!: (images: typeof prepared) => void;
    carsService.prepareProductImages.mockReturnValueOnce(
      new Promise((resolve) => {
        finishUpload = resolve;
      }),
    );
    audit.record.mockRejectedValueOnce(new Error('audit unavailable'));

    const operation = controller.update(
      'car-1',
      { images: [{ data: 'base64', is_primary: true }] } as any,
      specialist,
    );
    const rejection = expect(operation).rejects.toThrow('audit unavailable');
    await Promise.resolve();
    await Promise.resolve();

    expect(carsService.prepareProductImages).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    finishUpload(prepared);
    await rejection;
    expect(carsService.cleanupPreparedImages).toHaveBeenCalledWith(prepared);
  });

  it('não permite remover o owner com specialist_id null no PATCH', async () => {
    const { controller, carsService } = mkController();

    await expect(
      controller.update('car-1', { specialist_id: null } as any, specialist),
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

describe('CarsController — admin/all (Gestão de Produtos)', () => {
  function mkListController() {
    const carsService = {
      getAllCars: jest.fn().mockResolvedValue({
        data: [],
        count: 0,
        filters: {},
      }),
    } as any;
    const prisma = { user: { findUnique: jest.fn() } } as any;
    // ActorContextService real: é ele quem restringe o SPECIALIST a si mesmo.
    const actorContext = new ActorContextService(prisma);
    const controller = new (CarsController as any)(
      carsService,
      {} as any,
      actorContext,
      {} as any,
      prisma,
    );
    return { controller, carsService, prisma };
  }

  const owner = {
    id: 'spec-1',
    role: UserRole.SPECIALIST,
    speciality: ProductType.CAR,
    is_active: true,
    name: 'Esp',
    surname: 'Um',
  } as any;

  it('libera ADMIN e SPECIALIST nos metadados de roles', () => {
    const roles = new Reflector().get(
      ROLES_KEY,
      CarsController.prototype.getAllCarsForAdmin,
    );
    expect(roles).toEqual(
      expect.arrayContaining([UserRole.ADMIN, UserRole.SPECIALIST]),
    );
  });

  it('lista só os produtos do próprio especialista, incluindo inativos', async () => {
    const { controller, carsService } = mkListController();

    await controller.getAllCarsForAdmin(
      { page: '2', perPage: '20', search: 'abc', specialist_id: 'spec-2' },
      owner,
    );

    expect(carsService.getAllCars).toHaveBeenCalledWith(
      {
        page: 2,
        perPage: 20,
        appliedFilters: { search: 'abc', specialist_id: 'spec-1' },
      },
      true,
    );
  });

  it('responde 403 se o especialista pedir outro target_specialist_id', async () => {
    const { controller, carsService } = mkListController();

    await expect(
      controller.getAllCarsForAdmin({ target_specialist_id: 'spec-2' }, owner),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(carsService.getAllCars).not.toHaveBeenCalled();
  });

  it('responde 403 se a especialidade não corresponder ao recurso', async () => {
    const { controller, carsService } = mkListController();

    await expect(
      controller.getAllCarsForAdmin(
        {},
        { ...owner, speciality: ProductType.BOAT },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(carsService.getAllCars).not.toHaveBeenCalled();
  });
});
