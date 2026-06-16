import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ProcessStatus, UserRole } from '@prisma/client';
import { jwtConstants } from 'src/auth/constants';
import { SesService } from 'src/aws/ses.service';
import { S3Service } from 'src/aws/s3.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogoSanitizerService } from 'src/shared/services/logo-sanitizer.service';
import { resolveCompanyLogoUrl } from 'src/auth/utils/company-logo.util';
import { InviteConsultantDto } from './dto/invite-consultant.dto';
import { OfficeUpdateCompanyDto } from './dto/update-company.dto';
import { OfficeUpdateConsultantDto } from './dto/update-consultant.dto';

interface Scope {
  companyId: string | null;
  isAdmin: boolean;
}

@Injectable()
export class OfficeService {
  private readonly logger = new Logger(OfficeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly ses: SesService,
    private readonly s3: S3Service,
    private readonly logoSanitizer: LogoSanitizerService,
  ) {}

  /** ADMIN vê todas Companies; OFFICE só a própria. */
  private resolveCompanyId(scope: Scope, requestedCompanyId?: string): string {
    if (scope.isAdmin) {
      if (!requestedCompanyId) {
        throw new BadRequestException('ADMIN deve informar companyId');
      }
      return requestedCompanyId;
    }
    return scope.companyId!;
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────
  async dashboard(scope: Scope, requestedCompanyId?: string) {
    const companyId = this.resolveCompanyId(scope, requestedCompanyId);

    const [
      activeConsultants,
      inactiveConsultants,
      clientsCount,
      openProcesses,
    ] = await Promise.all([
      this.prisma.user.count({
        where: {
          company_id: companyId,
          role: UserRole.CONSULTANT,
          is_active: true,
        },
      }),
      this.prisma.user.count({
        where: {
          company_id: companyId,
          role: UserRole.CONSULTANT,
          is_active: false,
        },
      }),
      this.prisma.user.count({
        where: {
          role: UserRole.CUSTOMER,
          consultant: { company_id: companyId },
        },
      }),
      this.prisma.process.count({
        where: {
          status: { notIn: [ProcessStatus.COMPLETED, ProcessStatus.REJECTED] },
          client: { consultant: { company_id: companyId } },
        },
      }),
    ]);

    return {
      companyId,
      activeConsultants,
      inactiveConsultants,
      clientsCount,
      openProcesses,
    };
  }

  // ─── Consultor: listar ──────────────────────────────────────────────────
  async listConsultants(
    scope: Scope,
    opts: { onlyActive?: boolean; q?: string } = {},
  ) {
    const companyId = scope.isAdmin ? undefined : scope.companyId!;

    const where: any = { role: UserRole.CONSULTANT };
    if (companyId) where.company_id = companyId;
    if (opts.onlyActive !== undefined) where.is_active = opts.onlyActive;
    if (opts.q) {
      where.OR = [
        { name: { contains: opts.q, mode: 'insensitive' } },
        { surname: { contains: opts.q, mode: 'insensitive' } },
        { email: { contains: opts.q, mode: 'insensitive' } },
      ];
    }

    const consultants = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        is_active: true,
        deactivated_at: true,
        commission_rate: true,
        bank: true,
        agency: true,
        checking_account: true,
        created_at: true,
        _count: { select: { clients: true } },
      },
      orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
    });

    return consultants.map((c) => ({
      ...c,
      clients_count: c._count.clients,
      commission_rate: c.commission_rate ? Number(c.commission_rate) : null,
      _count: undefined,
    }));
  }

  // ─── Consultor: editar ──────────────────────────────────────────────────
  async updateConsultant(
    scope: Scope,
    consultantId: string,
    dto: OfficeUpdateConsultantDto,
  ) {
    const where: any = { id: consultantId, role: UserRole.CONSULTANT };
    if (!scope.isAdmin) where.company_id = scope.companyId;

    const existing = await this.prisma.user.findFirst({ where });
    if (!existing) {
      // 404 (não 403) — evita oracle de existência cross-tenant
      throw new NotFoundException('Consultor não encontrado');
    }

    return this.prisma.user.update({
      where: { id: consultantId },
      data: dto,
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        commission_rate: true,
        bank: true,
        agency: true,
        checking_account: true,
        is_active: true,
      },
    });
  }

  // ─── Consultor: desativar (soft) ───────────────────────────────────────
  async deactivateConsultant(
    scope: Scope,
    consultantId: string,
    actorId: string,
  ) {
    const where: any = { id: consultantId, role: UserRole.CONSULTANT };
    if (!scope.isAdmin) where.company_id = scope.companyId;

    const consultant = await this.prisma.user.findFirst({
      where,
      select: { id: true, is_active: true },
    });
    if (!consultant) throw new NotFoundException('Consultor não encontrado');
    if (!consultant.is_active)
      return { success: true, message: 'Consultor já estava inativo' };

    // Bloqueia desativação se há processos ATIVOS dos clientes desse consultor
    const activeProcesses = await this.prisma.process.count({
      where: {
        client: { consultant_id: consultantId },
        status: { notIn: [ProcessStatus.COMPLETED, ProcessStatus.REJECTED] },
      },
    });
    if (activeProcesses > 0) {
      throw new ConflictException(
        `Consultor possui ${activeProcesses} processo(s) ativo(s). Conclua ou rejeite antes de desativar.`,
      );
    }

    await this.prisma.$transaction([
      // Desvincula clientes
      this.prisma.user.updateMany({
        where: { consultant_id: consultantId, role: UserRole.CUSTOMER },
        data: { consultant_id: null },
      }),
      // Desativa consultor
      this.prisma.user.update({
        where: { id: consultantId },
        data: {
          is_active: false,
          deactivated_at: new Date(),
          deactivated_by: actorId,
        },
      }),
      // Revoga refresh tokens (força logout)
      this.prisma.refreshToken.deleteMany({ where: { user_id: consultantId } }),
    ]);

    return {
      success: true,
      message: 'Consultor desativado e clientes desvinculados',
    };
  }

  // ─── Consultor: reativar ───────────────────────────────────────────────
  async reactivateConsultant(scope: Scope, consultantId: string) {
    const where: any = { id: consultantId, role: UserRole.CONSULTANT };
    if (!scope.isAdmin) where.company_id = scope.companyId;

    const consultant = await this.prisma.user.findFirst({ where });
    if (!consultant) throw new NotFoundException('Consultor não encontrado');

    return this.prisma.user.update({
      where: { id: consultantId },
      data: { is_active: true, deactivated_at: null, deactivated_by: null },
      select: { id: true, is_active: true },
    });
  }

  // ─── Convite consultor individual ──────────────────────────────────────
  async inviteConsultant(
    scope: Scope,
    dto: InviteConsultantDto,
    requestedCompanyId?: string,
  ) {
    const companyId = this.resolveCompanyId(scope, requestedCompanyId);

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });
    if (!company) throw new NotFoundException('Escritório não encontrado');

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException(
        'Já existe uma conta cadastrada com este email',
      );
    }

    // Token reusa shape do consultant invite atual (auth.service.validateConsultantInviteToken)
    const token = this.jwt.sign(
      { type: 'CONSULTANT_INVITE', companyId, email: dto.email },
      { secret: jwtConstants.referral, expiresIn: '7d' },
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteLink = `${frontendUrl}/register-consultant?invite=${token}`;

    setImmediate(() => {
      this.ses
        .sendConsultantInviteEmail(dto.email, inviteLink, company.name)
        .catch((e) => {
          this.logger.warn(
            `[office.invite] falha no SES p/ ${dto.email}: ${e?.message}`,
          );
        });
    });

    return { inviteLink, email: dto.email };
  }

  // ─── Clientes (read-only) ──────────────────────────────────────────────
  async listClients(
    scope: Scope,
    opts: { consultantId?: string; q?: string } = {},
  ) {
    const where: any = { role: UserRole.CUSTOMER };

    if (scope.isAdmin) {
      if (opts.consultantId) where.consultant_id = opts.consultantId;
    } else {
      // Escopo: somente clientes ligados a consultores da MESMA Company
      where.consultant = { company_id: scope.companyId };
      if (opts.consultantId) {
        // Garante que o consultor pedido pertence à Company antes de filtrar
        const consultant = await this.prisma.user.findFirst({
          where: {
            id: opts.consultantId,
            role: UserRole.CONSULTANT,
            company_id: scope.companyId!,
          },
          select: { id: true },
        });
        if (!consultant) return []; // consultor de outra company → silenciosamente vazio
        where.consultant_id = opts.consultantId;
      }
    }

    if (opts.q) {
      where.OR = [
        { name: { contains: opts.q, mode: 'insensitive' } },
        { surname: { contains: opts.q, mode: 'insensitive' } },
        { email: { contains: opts.q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        cpf: true,
        civil_state: true,
        consultant_id: true,
        consultant: { select: { id: true, name: true, surname: true } },
        created_at: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  // ─── Company: get ──────────────────────────────────────────────────────
  async getCompany(scope: Scope, requestedCompanyId?: string) {
    const companyId = this.resolveCompanyId(scope, requestedCompanyId);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException('Escritório não encontrado');
    const logoUrl = await resolveCompanyLogoUrl(this.s3, company.logo);
    return {
      ...company,
      commission_rate: company.commission_rate
        ? Number(company.commission_rate)
        : null,
      logoUrl,
    };
  }

  // ─── Company: editar ───────────────────────────────────────────────────
  async updateCompany(
    scope: Scope,
    dto: OfficeUpdateCompanyDto,
    requestedCompanyId?: string,
  ) {
    const companyId = this.resolveCompanyId(scope, requestedCompanyId);

    if (dto.cnpj) {
      // Normaliza p/ apenas dígitos antes de checar unicidade
      const normalizedCnpj = dto.cnpj.replace(/\D/g, '');
      if (normalizedCnpj.length !== 14) {
        throw new BadRequestException('CNPJ deve ter 14 dígitos');
      }
      const dup = await this.prisma.company.findFirst({
        where: { cnpj: normalizedCnpj, NOT: { id: companyId } },
      });
      if (dup)
        throw new ConflictException('CNPJ já cadastrado em outro escritório');
      dto.cnpj = normalizedCnpj;
    }

    const before = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { bank: true, agency: true, checking_account: true },
    });
    if (!before) throw new NotFoundException('Escritório não encontrado');

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: dto,
    });

    // Auditoria de mudança em dados financeiros (alvo de phishing)
    const financialChanged =
      (dto.bank && dto.bank !== before.bank) ||
      (dto.agency && dto.agency !== before.agency) ||
      (dto.checking_account &&
        dto.checking_account !== before.checking_account);
    if (financialChanged) {
      this.logger.warn(
        `[office.updateCompany] DADOS FINANCEIROS alterados company=${companyId} role=${scope.isAdmin ? 'ADMIN' : 'OFFICE'}`,
      );
    }

    const logoUrl = await resolveCompanyLogoUrl(this.s3, updated.logo);
    return {
      ...updated,
      commission_rate: updated.commission_rate
        ? Number(updated.commission_rate)
        : null,
      logoUrl,
    };
  }

  // ─── Company: upload logo ──────────────────────────────────────────────
  async uploadCompanyLogo(
    scope: Scope,
    file: Express.Multer.File,
    requestedCompanyId?: string,
  ) {
    const companyId = this.resolveCompanyId(scope, requestedCompanyId);

    const sanitized = this.logoSanitizer.sanitize(file);

    const key = `companies/${companyId}/logo-${Date.now()}.${sanitized.extension}`;
    await this.s3.uploadBuffer(sanitized.buffer, key, sanitized.contentType);

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { logo: true },
    });
    if (!company) throw new NotFoundException('Escritório não encontrado');

    const previousKey = company.logo;
    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: { logo: key },
      select: { id: true, logo: true },
    });

    // Limpa logo anterior (best-effort)
    if (previousKey && previousKey !== key) {
      this.s3.deleteObject(previousKey).catch(() => {});
    }

    const logoUrl = await resolveCompanyLogoUrl(this.s3, updated.logo);
    return { ...updated, logoUrl };
  }
}
