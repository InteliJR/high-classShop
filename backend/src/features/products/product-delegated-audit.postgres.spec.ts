import { randomUUID } from 'node:crypto';
import { PrismaClient, ProductType, UserRole } from '@prisma/client';
import { CarsController } from '../cars/cars.controller';
import { CarsService } from '../cars/cars.service';
import { BoatsController } from '../boats/boats.controller';
import { BoatsService } from '../boats/boats.service';
import { AircraftsController } from '../aircrafts/aircrafts.controller';
import { AircraftsService } from '../aircrafts/aircrafts.service';

const databaseUrl = process.env.POSTGRES_CONCURRENCY_TEST_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres('delegated product mutation audit — PostgreSQL', () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl! } },
  });
  const specialistId = randomUUID();
  const adminId = randomUUID();
  const suffix = randomUUID().replaceAll('-', '');
  const s3 = {
    uploadImageAuto: jest.fn(),
    getSignedUrl: jest.fn(async (key) => key),
  } as any;
  const actorContext = {
    resolve: jest.fn(async (user, target) => ({
      actorId: user.id,
      actorRole: user.role,
      actor: { id: user.id, role: user.role, name: 'Admin', surname: '' },
      specialistId: target,
      specialist: {},
      delegated: true,
    })),
    assertResourceSpecialist: jest.fn((context, owner) => {
      if (context.specialistId !== owner) throw new Error('wrong owner');
    }),
  } as any;
  const audit = {
    record: jest.fn(async () => {
      throw new Error('audit unavailable');
    }),
  } as any;
  const jobs = {} as any;
  const admin = { id: adminId, role: UserRole.ADMIN } as any;

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: specialistId,
        name: 'Audit',
        surname: 'Specialist',
        email: `audit-${suffix}@example.test`,
        rg: suffix.slice(0, 11),
        role: UserRole.SPECIALIST,
        speciality: ProductType.CAR,
        password_hash: 'not-used',
      },
    });
  });

  beforeEach(async () => {
    audit.record.mockClear();
    await prisma.car.deleteMany({ where: { specialist_id: specialistId } });
    await prisma.boat.deleteMany({ where: { specialist_id: specialistId } });
    await prisma.aircraft.deleteMany({
      where: { specialist_id: specialistId },
    });
  });

  afterAll(async () => {
    await prisma.car.deleteMany({ where: { specialist_id: specialistId } });
    await prisma.boat.deleteMany({ where: { specialist_id: specialistId } });
    await prisma.aircraft.deleteMany({
      where: { specialist_id: specialistId },
    });
    await prisma.user.delete({ where: { id: specialistId } });
    await prisma.$disconnect();
  });

  const cases = [
    {
      label: 'CAR',
      delegate: 'car',
      controller: new CarsController(
        new CarsService(prisma as any, s3),
        jobs,
        actorContext,
        audit,
        prisma as any,
      ),
    },
    {
      label: 'BOAT',
      delegate: 'boat',
      controller: new BoatsController(
        new BoatsService(prisma as any, s3),
        jobs,
        actorContext,
        audit,
        prisma as any,
      ),
    },
    {
      label: 'AIRCRAFT',
      delegate: 'aircraft',
      controller: new AircraftsController(
        new AircraftsService(prisma as any, s3),
        jobs,
        actorContext,
        audit,
        prisma as any,
      ),
    },
  ] as const;

  it.each(cases)(
    'reverte POST/PATCH/DELETE de $label quando a auditoria falha',
    async ({ label, delegate, controller }) => {
      const model = (prisma as any)[delegate];
      const createDto = {
        specialist_id: specialistId,
        identificador: `${label}-CREATE-${suffix}`,
        marca: 'Original',
        modelo: 'Original',
        valor: 100000,
        estado: 'SP',
        ano: 2024,
      };

      await expect(
        (controller as any).create({ ...createDto }, admin),
      ).rejects.toThrow('audit unavailable');
      await expect(
        model.count({ where: { identificador: createDto.identificador } }),
      ).resolves.toBe(0);

      const existing = await model.create({
        data: {
          ...createDto,
          identificador: `${label}-EXISTING-${suffix}`,
        },
      });
      await expect(
        (controller as any).update(
          existing.id,
          { modelo: 'Changed' },
          admin,
          specialistId,
        ),
      ).rejects.toThrow('audit unavailable');
      await expect(
        model.findUnique({ where: { id: existing.id }, select: { modelo: true } }),
      ).resolves.toEqual({ modelo: 'Original' });

      await expect(
        (controller as any).remove(existing.id, admin, specialistId),
      ).rejects.toThrow('audit unavailable');
      await expect(
        model.findUnique({
          where: { id: existing.id },
          select: { is_active: true },
        }),
      ).resolves.toEqual({ is_active: true });
      expect(audit.record).toHaveBeenCalledTimes(3);
    },
  );
});
