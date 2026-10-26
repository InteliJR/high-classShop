import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

const userId = '11111111-1111-4111-8111-111111111111';

function mkService(overrides: Record<string, any> = {}) {
  const findUnique = jest.fn().mockResolvedValue({
    id: userId,
    name: 'Fulano',
    surname: 'Silva',
    email: 'fulano@example.com',
    role: 'CUSTOMER',
    cpf: '12345678901',
    rg: '123456789',
    phone: '11987654321',
    calendly_url: null,
  });
  const findFirst = jest.fn().mockResolvedValue(null);
  const update = jest.fn().mockResolvedValue({ id: userId });

  const prisma = {
    user: { findUnique, findFirst, update },
    ...overrides,
  } as any;

  return {
    service: new UsersService(prisma),
    findUnique,
    update,
  };
}

describe('UsersService — telefone no perfil', () => {
  // O campo é editável na tela de perfil; sem ele no select a tela abria
  // vazia e parecia que o valor não tinha sido salvo.
  it('getById retorna o telefone', async () => {
    const { service, findUnique } = mkService();

    const user = await service.getById(userId);

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ phone: true }),
      }),
    );
    expect(user.phone).toBe('11987654321');
  });

  // O DTO validava `phone`, mas o service não gravava: a edição sumia.
  it('update grava o telefone recebido', async () => {
    const { service, update } = mkService();

    await service.update(userId, { phone: '11912345678' } as UpdateUserDto);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '11912345678' }),
      }),
    );
  });

  it('update devolve o telefone na resposta', async () => {
    const { service, update } = mkService();

    await service.update(userId, { phone: '11912345678' } as UpdateUserDto);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ phone: true }),
      }),
    );
  });

  // Limpar o campo é diferente de não mexer nele.
  it('telefone vazio limpa o valor, e ausente não toca no campo', async () => {
    const comVazio = mkService();
    await comVazio.service.update(userId, { phone: '' } as UpdateUserDto);
    expect(comVazio.update.mock.calls[0][0].data.phone).toBeNull();

    const semCampo = mkService();
    await semCampo.service.update(userId, { name: 'Novo' } as UpdateUserDto);
    expect(semCampo.update.mock.calls[0][0].data).not.toHaveProperty('phone');
  });
});

describe('UsersService — Calendly no perfil', () => {
  it.each([
    UserRole.CUSTOMER,
    UserRole.CONSULTANT,
    UserRole.OFFICE,
    UserRole.ADMIN,
  ])(
    'rejects non-null Calendly URLs for target role %s before writing',
    async (role) => {
      const { service, findUnique, update } = mkService();
      findUnique.mockResolvedValue({ id: userId, role });
      await expect(
        service.update(userId, { calendly_url: 'https://calendly.com/ana' }),
      ).rejects.toThrow(ForbiddenException);
      expect(update).not.toHaveBeenCalled();
      expect(findUnique).toHaveBeenCalledTimes(1);
    },
  );

  it('saves a specialist URL and preserves the private response projection', async () => {
    const { service, findUnique, update } = mkService();
    findUnique.mockResolvedValue({ id: userId, role: UserRole.SPECIALIST });
    await service.update(userId, {
      calendly_url: ' https://calendly.com/ana ',
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          calendly_url: 'https://calendly.com/ana',
        }),
        select: expect.objectContaining({ phone: true, calendly_url: true }),
      }),
    );
  });

  it.each([null, '', '   '])(
    'clears a specialist URL with %p',
    async (calendly_url) => {
      const { service, findUnique, update } = mkService();
      findUnique.mockResolvedValue({ id: userId, role: UserRole.SPECIALIST });
      await service.update(userId, { calendly_url });
      expect(update.mock.calls[0][0].data.calendly_url).toBeNull();
    },
  );

  it('allows explicit null removal for a non-specialist but leaves absent URLs untouched', async () => {
    const removal = mkService();
    await removal.service.update(userId, { calendly_url: null });
    expect(removal.update.mock.calls[0][0].data.calendly_url).toBeNull();
    const unchanged = mkService();
    await unchanged.service.update(userId, { name: 'Novo' });
    expect(unchanged.update.mock.calls[0][0].data).not.toHaveProperty(
      'calendly_url',
    );
  });

  it.each([null, 'https://calendly.com/ana'])(
    'DTO accepts Calendly value %p',
    async (calendly_url) => {
      const dto = plainToInstance(UpdateUserDto, { calendly_url });
      expect(await validate(dto)).toEqual([]);
    },
  );
});
