import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Prisma } from '@prisma/client';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { SesService } from 'src/aws/ses.service';
import { S3Service } from 'src/aws/s3.service';
import { LogoSanitizerService } from 'src/shared/services/logo-sanitizer.service';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private sesService: SesService,
    private s3Service: S3Service,
    private logoSanitizer: LogoSanitizerService,
  ) {}

  // Heurística: chave S3 (gerada por nós) sempre começa com `companies/`.
  // Logos legados em base64 não têm prefixo de path.
  private isS3Key(value: string | null | undefined): value is string {
    return !!value && value.startsWith('companies/');
  }

  // Resolve a URL pública (signed) do logo quando ele está no S3.
  // Legados em base64 ficam com logoUrl=null — o frontend cai no fallback.
  private async resolveLogoUrl(logo: string | null): Promise<string | null> {
    if (!this.isS3Key(logo)) return null;
    return this.s3Service.getSignedUrl(logo);
  }

  // Sobe um novo logo (base64) para o S3 e remove o anterior (best-effort).
  // Retorna a key salva para persistir em `company.logo`.
  private async processLogoUpload(
    companyId: string,
    base64: string,
    previousKey?: string | null,
  ): Promise<string> {
    const sanitized = this.logoSanitizer.sanitizeBase64(base64);
    const key = `companies/${companyId}/logo-${Date.now()}.${sanitized.extension}`;
    await this.s3Service.uploadBuffer(
      sanitized.buffer,
      key,
      sanitized.contentType,
    );

    if (previousKey && this.isS3Key(previousKey) && previousKey !== key) {
      this.s3Service.deleteObject(previousKey).catch(() => {});
    }

    return key;
  }

  // Busca todas as empresas com contagem de consultores.
  async findAll() {
    const companies = await this.prisma.company.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const companiesWithConsultantCount = await Promise.all(
      companies.map(async (c) => {
        const [consultants_count, logoUrl] = await Promise.all([
          this.prisma.user.count({
            where: { company_id: c.id, role: 'CONSULTANT' },
          }),
          this.resolveLogoUrl(c.logo),
        ]);
        return {
          ...c,
          commission_rate: c.commission_rate ? Number(c.commission_rate) : null,
          platform_commission_rate: c.platform_commission_rate
            ? Number(c.platform_commission_rate)
            : null,
          consultants_count,
          logoUrl,
          _count: undefined,
        };
      }),
    );

    return companiesWithConsultantCount;
  }

  // Cria uma nova empresa na base de dados.
  // Se `logo` (base64) vier no payload, faz upload pro S3 após o insert
  // (precisamos do id da empresa pra montar a key `companies/<id>/...`).
  async create(data: CreateCompanyDto) {
    try {
      const existingCompany = await this.prisma.company.findUnique({
        where: { cnpj: data.cnpj },
      });

      if (existingCompany) {
        throw new ConflictException(
          'Já existe uma empresa cadastrada com este CNPJ',
        );
      }

      const { logo: logoBase64, ...rest } = data;
      const created = await this.prisma.company.create({ data: rest });

      if (logoBase64) {
        const key = await this.processLogoUpload(created.id, logoBase64, null);
        await this.prisma.company.update({
          where: { id: created.id },
          data: { logo: key },
        });
      }

      return this.findOne(created.id);
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Já existe uma empresa cadastrada com este CNPJ',
          );
        }
      }

      throw new BadRequestException(
        'Erro ao criar empresa. Verifique os dados e tente novamente.',
      );
    }
  }

  // Retorna uma única empresa pelo ID com logoUrl resolvida (signed S3).
  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }
    const logoUrl = await this.resolveLogoUrl(company.logo);
    return {
      ...company,
      commission_rate: company.commission_rate
        ? Number(company.commission_rate)
        : null,
      platform_commission_rate: company.platform_commission_rate
        ? Number(company.platform_commission_rate)
        : null,
      logoUrl,
    };
  }

  // Atualiza os dados de uma empresa existente.
  // Se `logo` (base64) vier no payload, faz upload pro S3 e remove o anterior.
  async update(id: string, data: UpdateCompanyDto) {
    try {
      const current = await this.prisma.company.findUnique({
        where: { id },
        select: { id: true, logo: true },
      });
      if (!current) {
        throw new NotFoundException('Empresa não encontrada');
      }

      if (data.cnpj) {
        const existingCompany = await this.prisma.company.findFirst({
          where: {
            cnpj: data.cnpj,
            NOT: { id },
          },
        });

        if (existingCompany) {
          throw new ConflictException(
            'Já existe outra empresa cadastrada com este CNPJ',
          );
        }
      }

      const { logo: logoBase64, ...rest } = data;
      const updateData: Prisma.CompanyUpdateInput = { ...rest };

      if (logoBase64) {
        updateData.logo = await this.processLogoUpload(
          id,
          logoBase64,
          current.logo,
        );
      }

      await this.prisma.company.update({ where: { id }, data: updateData });
      return this.findOne(id);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Já existe outra empresa cadastrada com este CNPJ',
          );
        }
      }

      throw new BadRequestException(
        'Erro ao atualizar empresa. Verifique os dados e tente novamente.',
      );
    }
  }

  // Apaga uma empresa pelo ID + limpa o logo no S3 (best-effort).
  async remove(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { id: true, logo: true },
    });
    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }
    if (this.isS3Key(company.logo)) {
      this.s3Service.deleteObject(company.logo).catch(() => {});
    }
    await this.prisma.company.delete({ where: { id } });
    return { ok: true };
  }

  // Gera link de convite para que um consultor se cadastre vinculado à empresa.
  async inviteConsultant(companyId: string, email: string) {
    const company = await this.findOne(companyId);

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException(
        'Já existe uma conta cadastrada com este email',
      );
    }

    const token = this.jwtService.sign(
      { type: 'CONSULTANT_INVITE', companyId, email },
      { expiresIn: '7d' },
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteLink = `${frontendUrl}/register-consultant?invite=${token}`;

    setImmediate(() => {
      this.sesService
        .sendConsultantInviteEmail(email, inviteLink, company.name)
        .catch(() => {});
    });

    return { inviteLink, email };
  }

  // Gera convite p/ o gerente do escritório (role=OFFICE) — só ADMIN chama.
  async inviteOffice(companyId: string, email: string) {
    const company = await this.findOne(companyId);

    const existingOffice = await this.prisma.user.findFirst({
      where: { company_id: companyId, role: 'OFFICE' },
      select: { id: true },
    });
    if (existingOffice) {
      throw new ConflictException(
        'Este escritório já possui um gerente cadastrado',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException(
        'Já existe uma conta cadastrada com este email',
      );
    }

    const token = this.jwtService.sign(
      { type: 'OFFICE_INVITE', companyId, email },
      { expiresIn: '7d' },
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteLink = `${frontendUrl}/register-office?invite=${token}`;

    setImmediate(() => {
      this.sesService
        .sendOfficeInviteEmail(email, inviteLink, company.name)
        .catch(() => {});
    });

    return { inviteLink, email };
  }

  // Busca consultores associados a uma empresa, com paginação.
  async findConsultantsByCompany(
    companyId: string,
    page: number = 1,
    perPage: number = 5,
  ) {
    await this.findOne(companyId);

    const skip = (page - 1) * perPage;

    const [consultants, count] = await Promise.all([
      this.prisma.user.findMany({
        where: { company_id: companyId, role: 'CONSULTANT' },
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
          role: true,
          created_at: true,
          _count: { select: { clients: true } },
        },
        skip,
        take: perPage,
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.count({
        where: { company_id: companyId, role: 'CONSULTANT' },
      }),
    ]);

    const totalPages = Math.ceil(count / perPage);

    const pagination: PaginationDto = {
      current_page: page,
      per_page: perPage,
      total: count,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    };

    return {
      data: consultants.map((c) => ({
        ...c,
        clients_count: c._count.clients,
        _count: undefined,
      })),
      pagination,
    };
  }
}
