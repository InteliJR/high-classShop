import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AdminUserManagementService } from './admin-user-management.service';
import {
  emailDeExclusao,
  foiExcluido,
  rgDeExclusao,
} from './admin-user-deletion';

const ADMIN = 'admin-1';
const ALVO = 'user-1';

function mkPrisma(user: any = { id: ALVO, email: 'joao@example.dev', name: 'João', surname: 'Silva', role: 'CUSTOMER' }) {
  const tx = {
    refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    calendlyConnection: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    user: { update: jest.fn().mockResolvedValue({ id: ALVO }) },
  };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  } as any;
  return { prisma, tx };
}

const svc = (prisma: any) => new AdminUserManagementService(prisma);

describe('lápides de exclusão', () => {
  it('e-mail usa domínio reservado e é único a cada chamada', () => {
    const a = emailDeExclusao();
    const b = emailDeExclusao();
    expect(a).toMatch(/@deleted\.invalid$/);
    expect(a).not.toBe(b);
  });

  // RG real é só dígito; o prefixo garante que a lápide nunca colida com um.
  it('RG cabe em VarChar(11) e nunca parece um RG real', () => {
    for (let i = 0; i < 50; i++) {
      const rg = rgDeExclusao();
      expect(rg.length).toBeLessThanOrEqual(11);
      expect(rg).toMatch(/^X[0-9a-f]{10}$/);
    }
  });

  it('reconhece conta excluída pelo e-mail, sem coluna nova', () => {
    expect(foiExcluido(emailDeExclusao())).toBe(true);
    expect(foiExcluido('joao@example.dev')).toBe(false);
    expect(foiExcluido(null)).toBe(false);
  });
});

describe('AdminUserManagementService.deleteUser', () => {
  // Critério: e-mail e documentos voltam a ficar livres para novo cadastro.
  it('libera e-mail, CPF, RG e matrícula', async () => {
    const { prisma, tx } = mkPrisma();
    await svc(prisma).deleteUser(ALVO, ADMIN);

    const data = tx.user.update.mock.calls[0][0].data;
    expect(data.email).toMatch(/@deleted\.invalid$/);
    expect(data.cpf).toBeNull();
    expect(data.rg).toMatch(/^X[0-9a-f]{10}$/);
    expect(data.identification_number).toBeNull();
  });

  // Critério: a conta não autentica nem renova sessão.
  it('apaga refresh tokens, inativa a conta e inutiliza a senha', async () => {
    const { prisma, tx } = mkPrisma();
    await svc(prisma).deleteUser(ALVO, ADMIN);

    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { user_id: ALVO },
    });
    const data = tx.user.update.mock.calls[0][0].data;
    expect(data.is_active).toBe(false);
    expect(data.password_hash).toMatch(/^excluido:/);
    expect(data.deactivated_by).toBe(ADMIN);
  });

  // calendly_user_uri é único: sem remover, o recadastro não reconecta.
  it('remove a conexão do Calendly', async () => {
    const { prisma, tx } = mkPrisma();
    await svc(prisma).deleteUser(ALVO, ADMIN);

    expect(tx.calendlyConnection.deleteMany).toHaveBeenCalledWith({
      where: { user_id: ALVO },
    });
  });

  // Critério: o histórico não pode ser apagado nem bloquear a exclusão.
  it('não apaga a linha do usuário — processos seguem resolvendo a FK', async () => {
    const { prisma, tx } = mkPrisma();
    await svc(prisma).deleteUser(ALVO, ADMIN);

    expect((tx.user as any).delete).toBeUndefined();
    expect(tx.user.update).toHaveBeenCalledTimes(1);
  });

  it('preserva nome e papel para o histórico continuar legível', async () => {
    const { prisma, tx } = mkPrisma();
    const r = await svc(prisma).deleteUser(ALVO, ADMIN);

    const data = tx.user.update.mock.calls[0][0].data;
    expect(data.name).toBeUndefined();
    expect(data.surname).toBeUndefined();
    expect(data.role).toBeUndefined();
    expect(r.name).toBe('João Silva');
  });

  it('tudo acontece numa transação só', async () => {
    const { prisma } = mkPrisma();
    await svc(prisma).deleteUser(ALVO, ADMIN);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('admin não exclui a própria conta', async () => {
    const { prisma } = mkPrisma();
    await expect(svc(prisma).deleteUser(ADMIN, ADMIN)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('usuário inexistente é 404', async () => {
    const { prisma } = mkPrisma(null);
    await expect(svc(prisma).deleteUser(ALVO, ADMIN)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('conta já excluída não é excluída de novo', async () => {
    const { prisma, tx } = mkPrisma({
      id: ALVO,
      email: emailDeExclusao(),
      name: 'João',
      surname: 'Silva',
      role: 'CUSTOMER',
    });
    await expect(svc(prisma).deleteUser(ALVO, ADMIN)).rejects.toThrow(
      ConflictException,
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
