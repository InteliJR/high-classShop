import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import { IS_PUBLIC_KEY } from 'src/shared/decorators/public.decorator';
import { UsersController } from './users.controller';

const targetId = '11111111-1111-4111-8111-111111111111';
const outsiderId = '22222222-2222-4222-8222-222222222222';

function setup() {
  const service = {
    getById: jest
      .fn()
      .mockResolvedValue({ id: targetId, phone: '11987654321' }),
    update: jest.fn().mockResolvedValue({ id: targetId, name: 'Novo' }),
  };
  return { service, controller: new UsersController(service as any) };
}

describe('UsersController private profile authorization', () => {
  it('rejects editing another user before service access', async () => {
    const { controller, service } = setup();
    await expect(
      (controller.update as any)(
        targetId,
        { name: 'Novo' },
        {
          user: { id: outsiderId, role: UserRole.CUSTOMER },
        },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(service.update).not.toHaveBeenCalled();
  });
  it('requires authentication on both profile routes', () => {
    for (const method of [
      UsersController.prototype.getById,
      UsersController.prototype.update,
    ]) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, method)).not.toBe(true);
      expect(Reflect.getMetadata(GUARDS_METADATA, method)).toContain(AuthGuard);
    }
  });

  it.each([
    UserRole.CUSTOMER,
    UserRole.SPECIALIST,
    UserRole.CONSULTANT,
    UserRole.OFFICE,
  ])(
    'rejects reading and editing another user as %s before service access',
    async (role) => {
      const { controller, service } = setup();
      const request = { user: { id: outsiderId, role } };
      await expect(
        (controller.getById as any)(targetId, request),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        (controller.update as any)(targetId, { name: 'Novo' }, request),
      ).rejects.toThrow(ForbiddenException);
      expect(service.getById).not.toHaveBeenCalled();
      expect(service.update).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, {}, { user: null }, { user: {} }])(
    'fails closed when the authenticated actor is missing: %p',
    async (request) => {
      const { controller, service } = setup();
      await expect(
        (controller.getById as any)(targetId, request),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        (controller.update as any)(targetId, { name: 'Novo' }, request),
      ).rejects.toThrow(ForbiddenException);
      expect(service.getById).not.toHaveBeenCalled();
      expect(service.update).not.toHaveBeenCalled();
    },
  );

  it.each([
    { id: targetId, role: UserRole.CUSTOMER },
    { id: targetId, role: UserRole.SPECIALIST },
    { id: outsiderId, role: UserRole.ADMIN },
  ])(
    'preserves private read/update response envelopes for %p',
    async (user) => {
      const { controller, service } = setup();
      const dto = { name: 'Novo' };
      await expect(
        (controller.getById as any)(targetId, { user }),
      ).resolves.toEqual({
        success: true,
        message: 'Usuário obtido com sucesso',
        data: { id: targetId, phone: '11987654321' },
      });
      await expect(
        (controller.update as any)(targetId, dto, { user }),
      ).resolves.toEqual({
        success: true,
        message: 'Usuário atualizado com sucesso',
        data: { id: targetId, name: 'Novo' },
      });
      expect(service.getById).toHaveBeenCalledWith(targetId);
      expect(service.update).toHaveBeenCalledWith(targetId, dto);
    },
  );
});
