import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ConsultantInviteItemStatus,
  ConsultantInviteJobStatus,
  Prisma,
} from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from 'src/auth/constants';
import { SesService } from 'src/aws/ses.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { XlsxImportService } from 'src/shared/services/xlsx-import.service';

interface Scope {
  companyId: string | null;
  isAdmin: boolean;
}

const INVITE_JOB_COLUMNS = [
  { name: 'name', required: true, type: 'string' as const },
  { name: 'email', required: true, type: 'string' as const },
];

// CSV injection: sanitiza valores que começam com =, +, -, @ — prefix com aspa simples
const CSV_INJECTION_RE = /^[=+\-@]/;
function sanitizeCellEcho(s: string): string {
  return CSV_INJECTION_RE.test(s) ? `'${s}` : s;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

@Injectable()
export class ConsultantInviteJobsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ConsultantInviteJobsService.name);
  private readonly runningJobs = new Set<string>();
  private recoveryTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly xlsx: XlsxImportService,
    private readonly jwt: JwtService,
    private readonly ses: SesService,
  ) {}

  onModuleInit() {
    this.recover().catch((e) => this.logger.error('Falha recover', e));
    this.recoveryTimer = setInterval(
      () => this.recover().catch((e) => this.logger.error('Falha recover', e)),
      30000,
    );
  }

  onModuleDestroy() {
    if (this.recoveryTimer) clearInterval(this.recoveryTimer);
  }

  // ─── Criar job ─────────────────────────────────────────────────────────
  async createJobFromCsv(
    scope: Scope,
    actorUserId: string,
    fileBuffer: Buffer,
    requestedCompanyId?: string,
  ) {
    const companyId = scope.isAdmin ? requestedCompanyId : scope.companyId!;
    if (!companyId) throw new BadRequestException('companyId obrigatório');

    if (!scope.isAdmin && companyId !== scope.companyId) {
      throw new ForbiddenException();
    }

    if (fileBuffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException('CSV excede 5MB');
    }

    const { rows } = this.xlsx.parseCsv(fileBuffer);

    const structure = this.xlsx.validateStructure(rows, INVITE_JOB_COLUMNS);
    if (!structure.valid) {
      throw new BadRequestException({
        message: 'Estrutura do CSV inválida',
        errors: structure.errors,
        missingRequired: structure.missingRequired,
        unknownColumns: structure.unknownColumns,
      });
    }

    // Dedupe por e-mail (preserva 1ª ocorrência) + normaliza
    const seen = new Set<string>();
    const items: Array<{
      row_number: number;
      name: string;
      email: string;
      status: ConsultantInviteItemStatus;
      error_message?: string;
    }> = [];

    rows.forEach((row, idx) => {
      const rowNumber = idx + 2; // +1 header, +1 base-1
      const rawName = (row.name || '').trim();
      const rawEmail = (row.email || '').trim().toLowerCase();
      const safeName = sanitizeCellEcho(rawName).slice(0, 120);
      const safeEmail = sanitizeCellEcho(rawEmail).slice(0, 254);

      if (!safeName || !safeEmail) {
        items.push({
          row_number: rowNumber,
          name: safeName,
          email: safeEmail,
          status: ConsultantInviteItemStatus.FAILED,
          error_message: 'name e email são obrigatórios',
        });
        return;
      }

      if (!EMAIL_RE.test(safeEmail)) {
        items.push({
          row_number: rowNumber,
          name: safeName,
          email: safeEmail,
          status: ConsultantInviteItemStatus.FAILED,
          error_message: 'E-mail inválido',
        });
        return;
      }

      if (seen.has(safeEmail)) {
        items.push({
          row_number: rowNumber,
          name: safeName,
          email: safeEmail,
          status: ConsultantInviteItemStatus.DUPLICATE,
          error_message: 'E-mail duplicado no CSV',
        });
        return;
      }
      seen.add(safeEmail);

      items.push({
        row_number: rowNumber,
        name: safeName,
        email: safeEmail,
        status: ConsultantInviteItemStatus.PENDING,
      });
    });

    const job = await this.prisma.consultantInviteJob.create({
      data: {
        company_id: companyId,
        created_by: actorUserId,
        status: ConsultantInviteJobStatus.PENDING,
        total_items: items.length,
        items: { createMany: { data: items } },
      },
      select: { id: true, total_items: true, status: true },
    });

    this.scheduleJob(job.id);

    return {
      jobId: job.id,
      totalItems: job.total_items,
      status: job.status,
      pollIntervalMs: 2000,
      message: 'Convite em lote iniciado em segundo plano.',
    };
  }

  // ─── Status ────────────────────────────────────────────────────────────
  async getJobStatus(scope: Scope, jobId: string) {
    const job = await this.prisma.consultantInviteJob.findUnique({
      where: { id: jobId },
      include: {
        items: {
          orderBy: { row_number: 'asc' },
          select: {
            row_number: true,
            name: true,
            email: true,
            status: true,
            error_message: true,
            consultant_id: true,
          },
        },
      },
    });
    if (!job) throw new NotFoundException('Job não encontrado');

    if (!scope.isAdmin && job.company_id !== scope.companyId) {
      throw new NotFoundException('Job não encontrado'); // 404 evita oracle
    }

    return {
      jobId: job.id,
      status: job.status,
      totalItems: job.total_items,
      processedItems: job.processed_items,
      successItems: job.success_items,
      failedItems: job.failed_items,
      duplicateItems: job.duplicate_items,
      startedAt: job.started_at,
      finishedAt: job.finished_at,
      errorMessage: job.error_message,
      done:
        job.status === ConsultantInviteJobStatus.COMPLETED ||
        job.status === ConsultantInviteJobStatus.COMPLETED_WITH_ERRORS ||
        job.status === ConsultantInviteJobStatus.FAILED,
      items: job.items,
    };
  }

  async listJobs(scope: Scope, requestedCompanyId?: string) {
    const where: any = {};
    if (!scope.isAdmin) where.company_id = scope.companyId;
    else if (requestedCompanyId) where.company_id = requestedCompanyId;

    return this.prisma.consultantInviteJob.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        total_items: true,
        success_items: true,
        failed_items: true,
        duplicate_items: true,
        created_at: true,
        finished_at: true,
      },
    });
  }

  // ─── Worker ────────────────────────────────────────────────────────────
  private async recover() {
    const jobs = await this.prisma.consultantInviteJob.findMany({
      where: {
        status: {
          in: [
            ConsultantInviteJobStatus.PENDING,
            ConsultantInviteJobStatus.PROCESSING,
          ],
        },
      },
      select: { id: true },
      orderBy: { created_at: 'asc' },
      take: 20,
    });
    for (const job of jobs) this.scheduleJob(job.id);
  }

  private scheduleJob(jobId: string) {
    if (this.runningJobs.has(jobId)) return;
    this.runningJobs.add(jobId);
    setImmediate(() => {
      this.processJob(jobId)
        .catch((e) => this.logger.error(`Job ${jobId} falhou`, e))
        .finally(() => this.runningJobs.delete(jobId));
    });
  }

  private async processJob(jobId: string) {
    const job = await this.prisma.consultantInviteJob.findUnique({
      where: { id: jobId },
      include: {
        company: { select: { name: true } },
        items: { orderBy: { row_number: 'asc' } },
      },
    });
    if (!job) return;
    if (
      job.status === ConsultantInviteJobStatus.COMPLETED ||
      job.status === ConsultantInviteJobStatus.COMPLETED_WITH_ERRORS ||
      job.status === ConsultantInviteJobStatus.FAILED
    )
      return;

    await this.prisma.consultantInviteJob.update({
      where: { id: jobId },
      data: {
        status: ConsultantInviteJobStatus.PROCESSING,
        started_at: job.started_at ?? new Date(),
        error_message: null,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    for (const item of job.items) {
      if (
        item.status !== ConsultantInviteItemStatus.PENDING &&
        item.status !== ConsultantInviteItemStatus.PROCESSING
      )
        continue;

      await this.prisma.consultantInviteJobItem.update({
        where: { id: item.id },
        data: {
          status: ConsultantInviteItemStatus.PROCESSING,
          attempts: { increment: 1 },
        },
      });

      try {
        // E-mail já em uso?
        const existing = await this.prisma.user.findUnique({
          where: { email: item.email },
          select: { id: true },
        });
        if (existing) {
          await this.prisma.consultantInviteJobItem.update({
            where: { id: item.id },
            data: {
              status: ConsultantInviteItemStatus.FAILED,
              error_message: 'E-mail já cadastrado na plataforma',
              processed_at: new Date(),
            },
          });
          continue;
        }

        const token = this.jwt.sign(
          {
            type: 'CONSULTANT_INVITE',
            companyId: job.company_id,
            email: item.email,
          },
          { secret: jwtConstants.referral, expiresIn: '7d' },
        );

        const link = `${frontendUrl}/register-consultant?invite=${token}`;

        const sesResult = await this.ses.sendConsultantInviteEmail(
          item.email,
          link,
          job.company.name,
        );

        if (!sesResult.success) {
          await this.prisma.consultantInviteJobItem.update({
            where: { id: item.id },
            data: {
              status: ConsultantInviteItemStatus.FAILED,
              error_message: sesResult.error || 'Falha SES desconhecida',
              token,
              processed_at: new Date(),
            },
          });
          continue;
        }

        await this.prisma.consultantInviteJobItem.update({
          where: { id: item.id },
          data: {
            status: ConsultantInviteItemStatus.SENT,
            token,
            processed_at: new Date(),
          },
        });

        // Backoff leve p/ não estourar SES sandbox (14 emails/s)
        await new Promise((r) => setTimeout(r, 100));
      } catch (e) {
        const error = e as Error;
        // Race condition de unique constraint no token (improvável, mas trata)
        const msg = error?.message || 'Erro desconhecido';
        await this.prisma.consultantInviteJobItem.update({
          where: { id: item.id },
          data: {
            status: ConsultantInviteItemStatus.FAILED,
            error_message: msg.slice(0, 500),
            processed_at: new Date(),
          },
        });
      }
    }

    await this.refreshCounters(jobId);
  }

  private async refreshCounters(jobId: string) {
    const items = await this.prisma.consultantInviteJobItem.findMany({
      where: { job_id: jobId },
      select: { status: true },
    });

    const success = items.filter(
      (i) =>
        i.status === ConsultantInviteItemStatus.SENT ||
        i.status === ConsultantInviteItemStatus.ACCEPTED,
    ).length;
    const failed = items.filter(
      (i) => i.status === ConsultantInviteItemStatus.FAILED,
    ).length;
    const duplicate = items.filter(
      (i) => i.status === ConsultantInviteItemStatus.DUPLICATE,
    ).length;
    const processed = success + failed + duplicate;

    let finalStatus: ConsultantInviteJobStatus =
      ConsultantInviteJobStatus.COMPLETED;
    if (failed > 0 && success > 0)
      finalStatus = ConsultantInviteJobStatus.COMPLETED_WITH_ERRORS;
    else if (failed > 0 && success === 0)
      finalStatus = ConsultantInviteJobStatus.FAILED;

    await this.prisma.consultantInviteJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        total_items: items.length,
        processed_items: processed,
        success_items: success,
        failed_items: failed,
        duplicate_items: duplicate,
        finished_at: new Date(),
      },
    });
  }
}
