import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ProductType, UserRole } from '@prisma/client';
import { ActorContextService } from './actor-context.service';

describe('ActorContextService', () => {
  const activeSpecialist = {
    id: 'specialist-1',
    role: UserRole.SPECIALIST,
    is_active: true,
    speciality: ProductType.CAR,
    name: 'Specialist',
    surname: 'One',
  };
  const prisma = {
    user: { findUnique: jest.fn() },
  } as any;
  const service = new ActorContextService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('requires an explicit represented specialist for ADMIN', async () => {
    await expect(
      service.resolve(
        { id: 'admin-1', role: UserRole.ADMIN } as any,
        undefined,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...activeSpecialist, role: UserRole.CUSTOMER }, 'papel'],
    [{ ...activeSpecialist, is_active: false }, 'inativo'],
    [{ ...activeSpecialist, speciality: ProductType.BOAT }, 'especialidade'],
  ])('denies an invalid represented specialist (%s)', async (record) => {
    prisma.user.findUnique.mockResolvedValue(record);

    await expect(
      service.resolve(
        { id: 'admin-1', role: UserRole.ADMIN } as any,
        activeSpecialist.id,
        ProductType.CAR,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps the ADMIN as actor and the SPECIALIST as represented party', async () => {
    prisma.user.findUnique.mockResolvedValue(activeSpecialist);

    await expect(
      service.resolve(
        { id: 'admin-1', role: UserRole.ADMIN } as any,
        activeSpecialist.id,
        ProductType.CAR,
      ),
    ).resolves.toEqual({
      actorId: 'admin-1',
      actorRole: UserRole.ADMIN,
      actor: {
        id: 'admin-1',
        role: UserRole.ADMIN,
        name: '',
        surname: '',
      },
      specialistId: activeSpecialist.id,
      specialist: activeSpecialist,
      delegated: true,
    });
  });

  it('preserves a specialist normal session and rejects injected targets', async () => {
    const specialistActor = {
      ...activeSpecialist,
      role: UserRole.SPECIALIST,
    } as any;

    await expect(
      service.resolve(specialistActor, undefined, ProductType.CAR),
    ).resolves.toMatchObject({
      actorId: activeSpecialist.id,
      specialistId: activeSpecialist.id,
      delegated: false,
    });
    await expect(
      service.resolve(specialistActor, 'specialist-2', ProductType.CAR),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies resource IDs owned by another specialist', async () => {
    prisma.user.findUnique.mockResolvedValue(activeSpecialist);
    const context = await service.resolve(
      { id: 'admin-1', role: UserRole.ADMIN } as any,
      activeSpecialist.id,
    );

    expect(() =>
      service.assertResourceSpecialist(context, 'specialist-2'),
    ).toThrow(ForbiddenException);
  });
});
