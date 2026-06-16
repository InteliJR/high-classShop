import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConsultantInviteJobsService } from './consultant-invite-jobs.service';
import { XlsxImportService } from 'src/shared/services/xlsx-import.service';

const SCOPE_OFFICE_A = { companyId: 'companyA', isAdmin: false };
const SCOPE_OFFICE_B = { companyId: 'companyB', isAdmin: false };
const SCOPE_ADMIN = { companyId: null, isAdmin: true };

function mkPrisma() {
  return {
    consultantInviteJob: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    consultantInviteJobItem: {
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: { findUnique: jest.fn() },
  } as any;
}

function mkSvc(prisma: any) {
  const xlsx = new XlsxImportService();
  const jwt = { sign: jest.fn().mockReturnValue('tok') } as any;
  const ses = {
    sendConsultantInviteEmail: jest.fn().mockResolvedValue({ success: true }),
  } as any;
  const svc = new ConsultantInviteJobsService(prisma, xlsx, jwt, ses);
  return svc;
}

function csvBuf(s: string) {
  return Buffer.from(s, 'utf-8');
}

describe('ConsultantInviteJobsService — CSV + scope', () => {
  // B2: faltando colunas obrigatórias → 400
  it('CSV sem coluna "email" → BadRequest', async () => {
    const prisma = mkPrisma();
    const svc = mkSvc(prisma);
    const csv = csvBuf('name\nJoão\nMaria');
    await expect(
      svc.createJobFromCsv(SCOPE_OFFICE_A, 'actor', csv),
    ).rejects.toThrow(BadRequestException);
  });

  // B3 + B5: e-mail inválido + duplicatas
  it('CSV: linha inválida → FAILED, duplicada → DUPLICATE', async () => {
    const prisma = mkPrisma();
    prisma.consultantInviteJob.create.mockImplementation((args: any) => ({
      id: 'job1',
      total_items: args.data.total_items,
      status: 'PENDING',
    }));
    const svc = mkSvc(prisma);
    const csv = csvBuf(
      'name,email\nJoão,joao@x.com\nMaria,not-an-email\nJoão2,joao@x.com',
    );
    await svc.createJobFromCsv(SCOPE_OFFICE_A, 'actor', csv);

    const itemsArg =
      prisma.consultantInviteJob.create.mock.calls[0][0].data.items.createMany
        .data;
    expect(itemsArg).toHaveLength(3);
    expect(itemsArg[0].status).toBe('PENDING');
    expect(itemsArg[1].status).toBe('FAILED');
    expect(itemsArg[2].status).toBe('DUPLICATE');
  });

  // B4: CSV injection — sanitiza prefixando aspa simples
  it('sanitiza CSV injection (=, +, -, @)', async () => {
    const prisma = mkPrisma();
    prisma.consultantInviteJob.create.mockImplementation((args: any) => ({
      id: 'job1',
      total_items: args.data.total_items,
      status: 'PENDING',
    }));
    const svc = mkSvc(prisma);
    // nome começando com '=' deve ficar prefixado com aspa simples
    const csv = csvBuf('name,email\n=cmd|"calc"!A1,a@b.com');
    await svc.createJobFromCsv(SCOPE_OFFICE_A, 'actor', csv);

    const itemsArg =
      prisma.consultantInviteJob.create.mock.calls[0][0].data.items.createMany
        .data;
    expect(itemsArg[0].name.startsWith("'")).toBe(true);
  });

  // B7: arquivo >5MB → 400
  it('arquivo >5MB → BadRequest', async () => {
    const prisma = mkPrisma();
    const svc = mkSvc(prisma);
    const big = Buffer.alloc(5 * 1024 * 1024 + 100);
    await expect(
      svc.createJobFromCsv(SCOPE_OFFICE_A, 'actor', big),
    ).rejects.toThrow(BadRequestException);
  });

  // B10: BOM UTF-8 + acentos
  it('aceita BOM UTF-8 e acentos', async () => {
    const prisma = mkPrisma();
    prisma.consultantInviteJob.create.mockImplementation((args: any) => ({
      id: 'job1',
      total_items: args.data.total_items,
      status: 'PENDING',
    }));
    const svc = mkSvc(prisma);
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const csv = Buffer.concat([
      bom,
      csvBuf('name,email\nJoão Açaí,joao@x.com'),
    ]);
    await svc.createJobFromCsv(SCOPE_OFFICE_A, 'actor', csv);
    const itemsArg =
      prisma.consultantInviteJob.create.mock.calls[0][0].data.items.createMany
        .data;
    expect(itemsArg[0].name).toContain('Açaí');
  });

  // S8: scope OFFICE A não consegue ler job de B
  it('getJobStatus: scope OFFICE A em job de B → 404', async () => {
    const prisma = mkPrisma();
    prisma.consultantInviteJob.findUnique.mockResolvedValue({
      id: 'jobB',
      company_id: 'companyB',
      items: [],
      processed_items: 0,
      success_items: 0,
      failed_items: 0,
      duplicate_items: 0,
      status: 'COMPLETED',
      total_items: 0,
      started_at: null,
      finished_at: null,
      error_message: null,
    });
    const svc = mkSvc(prisma);
    await expect(svc.getJobStatus(SCOPE_OFFICE_A, 'jobB')).rejects.toThrow(
      NotFoundException,
    );
  });

  // ADMIN bypass: vê qualquer job
  it('getJobStatus: ADMIN acessa job de qualquer tenant', async () => {
    const prisma = mkPrisma();
    prisma.consultantInviteJob.findUnique.mockResolvedValue({
      id: 'jobX',
      company_id: 'qualquer',
      items: [],
      processed_items: 0,
      success_items: 0,
      failed_items: 0,
      duplicate_items: 0,
      status: 'COMPLETED',
      total_items: 0,
      started_at: null,
      finished_at: null,
      error_message: null,
    });
    const svc = mkSvc(prisma);
    const r = await svc.getJobStatus(SCOPE_ADMIN, 'jobX');
    expect(r.jobId).toBe('jobX');
  });

  // createJob: OFFICE A passa companyId B no query → IGNORADO, usa scope companyA
  it('createJobFromCsv: OFFICE ignora companyId do query, sempre usa scope', async () => {
    const prisma = mkPrisma();
    prisma.consultantInviteJob.create.mockImplementation((args: any) => ({
      id: 'job1',
      total_items: args.data.total_items,
      status: 'PENDING',
    }));
    const svc = mkSvc(prisma);
    const csv = csvBuf('name,email\nJoão,j@x.com');
    await svc.createJobFromCsv(SCOPE_OFFICE_A, 'actor', csv, 'companyB');
    // company_id passado ao Prisma é o do scope (A), não o query (B)
    const callData = prisma.consultantInviteJob.create.mock.calls[0][0].data;
    expect(callData.company_id).toBe('companyA');
  });

  // ADMIN sem companyId no query → 400
  it('createJobFromCsv: ADMIN sem companyId no query → BadRequest', async () => {
    const prisma = mkPrisma();
    const svc = mkSvc(prisma);
    const csv = csvBuf('name,email\nJoão,j@x.com');
    await expect(
      svc.createJobFromCsv(SCOPE_ADMIN, 'actor', csv),
    ).rejects.toThrow(BadRequestException);
  });

  // Listagem respeita escopo
  it('listJobs: scope OFFICE B filtra por company_id', async () => {
    const prisma = mkPrisma();
    const svc = mkSvc(prisma);
    await svc.listJobs(SCOPE_OFFICE_B);
    expect(prisma.consultantInviteJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { company_id: 'companyB' } }),
    );
  });
});
