import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
// Mocka LogoSanitizerService p/ não puxar isomorphic-dompurify (ESM, incompatível com jest)
jest.mock('src/shared/services/logo-sanitizer.service', () => ({
  LogoSanitizerService: class {
    sanitize() {
      return {
        buffer: Buffer.alloc(0),
        contentType: 'image/png',
        extension: 'png',
      };
    }
  },
}));

import { OfficeService } from './office.service';

const SCOPE_OFFICE_A = { companyId: 'companyA', isAdmin: false };
const SCOPE_OFFICE_B = { companyId: 'companyB', isAdmin: false };
const SCOPE_ADMIN = { companyId: null, isAdmin: true };

function mkPrisma() {
  return {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    process: {
      count: jest.fn().mockResolvedValue(0),
    },
    refreshToken: { deleteMany: jest.fn() },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
  } as any;
}

function mkSes() {
  return {
    sendConsultantInviteEmail: jest.fn().mockResolvedValue({ success: true }),
  };
}

function mkJwt(value = 'tok123') {
  return { sign: jest.fn().mockReturnValue(value) };
}

function mkSvc(prisma: any, ses: any = mkSes(), jwt: any = mkJwt()) {
  return new OfficeService(prisma, jwt, ses, {} as any, {} as any);
}

describe('OfficeService — tenant isolation', () => {
  // S2: PATCH consultor de outra company → NotFoundException
  it('updateConsultant: consultor de outra company → 404', async () => {
    const prisma = mkPrisma();
    prisma.user.findFirst.mockResolvedValue(null);
    const svc = mkSvc(prisma);
    await expect(
      svc.updateConsultant(SCOPE_OFFICE_A, 'consultorB', { name: 'X' }),
    ).rejects.toThrow(NotFoundException);
    // filtro DEVE incluir company_id da scope
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        company_id: 'companyA',
        role: 'CONSULTANT',
      }),
    });
  });

  // ADMIN bypassa filtro
  it('updateConsultant ADMIN: sem filtro company_id', async () => {
    const prisma = mkPrisma();
    prisma.user.findFirst.mockResolvedValue({ id: 'c1' });
    prisma.user.update.mockResolvedValue({ id: 'c1', name: 'X' });
    const svc = mkSvc(prisma);
    await svc.updateConsultant(SCOPE_ADMIN, 'c1', { name: 'X' });
    const callWhere = prisma.user.findFirst.mock.calls[0][0].where;
    expect(callWhere.company_id).toBeUndefined();
  });

  // S3: DELETE consultor outra company → 404
  it('deactivateConsultant: consultor outra company → 404', async () => {
    const prisma = mkPrisma();
    prisma.user.findFirst.mockResolvedValue(null);
    const svc = mkSvc(prisma);
    await expect(
      svc.deactivateConsultant(SCOPE_OFFICE_A, 'consultorB', 'actor'),
    ).rejects.toThrow(NotFoundException);
  });

  // D1: bloqueia desativação com processo ativo
  it('deactivateConsultant: bloqueia se há processo ativo', async () => {
    const prisma = mkPrisma();
    prisma.user.findFirst.mockResolvedValue({ id: 'c1', is_active: true });
    prisma.process.count.mockResolvedValue(3);
    const svc = mkSvc(prisma);
    await expect(
      svc.deactivateConsultant(SCOPE_OFFICE_A, 'c1', 'actor'),
    ).rejects.toThrow(ConflictException);
  });

  // D3: desvincula clientes + revoga refresh tokens
  it('deactivateConsultant: desvincula clientes e revoga tokens', async () => {
    const prisma = mkPrisma();
    prisma.user.findFirst.mockResolvedValue({ id: 'c1', is_active: true });
    prisma.process.count.mockResolvedValue(0);
    const svc = mkSvc(prisma);
    await svc.deactivateConsultant(SCOPE_OFFICE_A, 'c1', 'actor');
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { consultant_id: 'c1', role: 'CUSTOMER' },
      data: { consultant_id: null },
    });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { user_id: 'c1' },
    });
  });

  // S7: list clients de outro consultor → vazio
  it('listClients: consultantId de outra company → retorna []', async () => {
    const prisma = mkPrisma();
    prisma.user.findFirst.mockResolvedValue(null); // consultor de outra company
    const svc = mkSvc(prisma);
    const r = await svc.listClients(SCOPE_OFFICE_A, {
      consultantId: 'consultorB',
    });
    expect(r).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  // S6: invite ignora company_id no body — sempre usa scope
  it('inviteConsultant: usa companyId do scope, ignora payload', async () => {
    const prisma = mkPrisma();
    prisma.company.findUnique.mockResolvedValue({ id: 'companyA', name: 'A' });
    prisma.user.findUnique.mockResolvedValue(null);
    const svc = mkSvc(prisma);
    await svc.inviteConsultant(SCOPE_OFFICE_A, { email: 'x@y.com' });
    expect(prisma.company.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'companyA' } }),
    );
  });

  // I1/I2/I3: e-mail já cadastrado → 409
  it('inviteConsultant: e-mail já existe → ConflictException', async () => {
    const prisma = mkPrisma();
    prisma.company.findUnique.mockResolvedValue({ id: 'companyA', name: 'A' });
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
    const svc = mkSvc(prisma);
    await expect(
      svc.inviteConsultant(SCOPE_OFFICE_A, { email: 'taken@y.com' }),
    ).rejects.toThrow(ConflictException);
  });

  // S5: PATCH company ignora id no body — sempre usa scope
  it('updateCompany: usa companyId do scope', async () => {
    const prisma = mkPrisma();
    prisma.company.findUnique.mockResolvedValue({
      bank: 'X',
      agency: '1',
      checking_account: '2',
    });
    prisma.company.update.mockResolvedValue({ id: 'companyA', name: 'A' });
    const svc = mkSvc(prisma);
    await svc.updateCompany(SCOPE_OFFICE_A, { name: 'Novo' });
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'companyA' },
      data: { name: 'Novo' },
    });
  });

  // C3: CNPJ duplicado → 409
  it('updateCompany: CNPJ duplicado → ConflictException', async () => {
    const prisma = mkPrisma();
    prisma.company.findFirst.mockResolvedValue({ id: 'other' });
    const svc = mkSvc(prisma);
    await expect(
      svc.updateCompany(SCOPE_OFFICE_A, { cnpj: '12345678000199' }),
    ).rejects.toThrow(ConflictException);
  });

  // CNPJ inválido → 400
  it('updateCompany: CNPJ não-14 dígitos → BadRequest', async () => {
    const prisma = mkPrisma();
    const svc = mkSvc(prisma);
    await expect(
      svc.updateCompany(SCOPE_OFFICE_A, { cnpj: '123' }),
    ).rejects.toThrow(BadRequestException);
  });

  // ADMIN sem companyId no query string → 400
  it('dashboard: ADMIN sem companyId → BadRequest', async () => {
    const svc = mkSvc(mkPrisma());
    await expect(svc.dashboard(SCOPE_ADMIN)).rejects.toThrow(
      BadRequestException,
    );
  });

  // Comprovar isolamento entre OFFICE A e OFFICE B (não confunde tenants)
  it('listConsultants: scope OFFICE B filtra apenas company B', async () => {
    const prisma = mkPrisma();
    const svc = mkSvc(prisma);
    await svc.listConsultants(SCOPE_OFFICE_B);
    const callWhere = prisma.user.findMany.mock.calls[0][0].where;
    expect(callWhere.company_id).toBe('companyB');
    expect(callWhere.role).toBe('CONSULTANT');
  });
});
