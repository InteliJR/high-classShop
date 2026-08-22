import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

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
