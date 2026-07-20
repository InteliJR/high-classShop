import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ConsultantInviteItemStatus,
  ConsultantInviteJobStatus,
} from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { SesService } from 'src/aws/ses.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { XlsxImportService } from 'src/shared/services/xlsx-import.service';

const INVITE_JOB_COLUMNS = [
  { name: 'name', required: true, type: 'string' as const },
  { name: 'email', required: true, type: 'string' as const },
];

// CSV injection: sanitiza valores que começam com =, +, -, @
const CSV_INJECTION_RE = /^[=+\-@]/;
function sanitizeCellEcho(s: string): string {
  return CSV_INJECTION_RE.test(s) ? `'${s}` : s;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Convite de CLIENTES em lote, disparado pelo CONSULTOR (espelha o job de
 * convite de consultores do OFFICE). Cada item envia o mesmo link de referral
 * do convite unitário (`/register?ref=<token>`), então o cliente registrado
 * fica vinculado a este consultor.
 */
@Injectable()
export class ClientInviteJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClientInviteJobsService.name);
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

  async createJobFromCsv(consultantId: string, fileBuffer: Buffer) {
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

    const seen = new Set<string>();
    const items: Array<{
      row_number: number;
      name: string;
      email: string;
      status: ConsultantInviteItemStatus;
      error_message?: string;
    }> = [];

    rows.forEach((row, idx) => {
      const rowNumber = idx + 2;
      const safeName = sanitizeCellEcho((row.name || '').trim()).slice(0, 120);
      const safeEmail = sanitizeCellEcho((row.email || '').trim().toLowerCase()).slice(
        0,
        254,
      );

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

    const job = await this.prisma.clientInviteJob.create({
      data: {
        consultant_id: consultantId,
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
      message: 'Convite de clientes em lote iniciado em segundo plano.',
    };
  }

  async getJobStatus(consultantId: string, jobId: string) {
    const job = await this.prisma.clientInviteJob.findUnique({
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
          },
        },
      },
    });
    if (!job || job.consultant_id !== consultantId) {
      throw new NotFoundException('Job não encontrado');
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

  async listJobs(consultantId: string) {
    return this.prisma.clientInviteJob.findMany({
      where: { consultant_id: consultantId },
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

  private async recover() {
    const jobs = await this.prisma.clientInviteJob.findMany({
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
    const job = await this.prisma.clientInviteJob.findUnique({
      where: { id: jobId },
      include: {
        consultant: { select: { name: true, surname: true } },
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

    await this.prisma.clientInviteJob.update({
      where: { id: jobId },
      data: {
        status: ConsultantInviteJobStatus.PROCESSING,
        started_at: job.started_at ?? new Date(),
        error_message: null,
      },
    });

    const consultantFullName =
      `${job.consultant.name} ${job.consultant.surname}`.trim();

    for (const item of job.items) {
      if (
        item.status !== ConsultantInviteItemStatus.PENDING &&
        item.status !== ConsultantInviteItemStatus.PROCESSING
      )
        continue;

      await this.prisma.clientInviteJobItem.update({
        where: { id: item.id },
        data: {
          status: ConsultantInviteItemStatus.PROCESSING,
          attempts: { increment: 1 },
        },
      });

      try {
        const existing = await this.prisma.user.findUnique({
          where: { email: item.email },
          select: { id: true },
        });
        if (existing) {
          await this.prisma.clientInviteJobItem.update({
            where: { id: item.id },
            data: {
              status: ConsultantInviteItemStatus.FAILED,
              error_message: 'E-mail já cadastrado na plataforma',
              processed_at: new Date(),
            },
          });
          continue;
        }

        // Mesmo token/payload do convite unitário → cliente cai vinculado a este consultor.
        const token = this.jwt.sign(
          { consultantId: job.consultant_id, email: item.email },
          { expiresIn: '7d' },
        );

        const result = await this.ses.sendRegistrationEmail(
          item.email,
          job.consultant_id,
          consultantFullName,
        );

        if (!result.success) {
          await this.prisma.clientInviteJobItem.update({
            where: { id: item.id },
            data: {
              status: ConsultantInviteItemStatus.FAILED,
              error_message: result.error || 'Falha SES desconhecida',
              token,
              processed_at: new Date(),
            },
          });
          continue;
        }

        await this.prisma.clientInviteJobItem.update({
          where: { id: item.id },
          data: {
            status: ConsultantInviteItemStatus.SENT,
            token,
            processed_at: new Date(),
          },
        });

        await new Promise((r) => setTimeout(r, 100));
      } catch (e) {
        const msg = (e as Error)?.message || 'Erro desconhecido';
        await this.prisma.clientInviteJobItem.update({
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
    const items = await this.prisma.clientInviteJobItem.findMany({
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

    let finalStatus: ConsultantInviteJobStatus =
      ConsultantInviteJobStatus.COMPLETED;
    if (failed > 0 && success > 0)
      finalStatus = ConsultantInviteJobStatus.COMPLETED_WITH_ERRORS;
    else if (failed > 0 && success === 0)
      finalStatus = ConsultantInviteJobStatus.FAILED;

    await this.prisma.clientInviteJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        total_items: items.length,
        processed_items: success + failed + duplicate,
        success_items: success,
        failed_items: failed,
        duplicate_items: duplicate,
        finished_at: new Date(),
      },
    });
  }
}
