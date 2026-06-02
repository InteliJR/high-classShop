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

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private sesService: SesService,
  ) {}

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
        const consultants_count = await this.prisma.user.count({
          where: { company_id: c.id, role: 'CONSULTANT' },
        });
        return {
          ...c,
          commission_rate: c.commission_rate ? Number(c.commission_rate) : null,
          consultants_count,
          _count: undefined,
        };
      }),
    );

    return companiesWithConsultantCount;
  }

  // Cria uma nova empresa na base de dados.
  async create(data: CreateCompanyDto) {
    try {
      // Verifica se já existe empresa com o mesmo CNPJ
      const existingCompany = await this.prisma.company.findUnique({
        where: { cnpj: data.cnpj },
      });

      if (existingCompany) {
        throw new ConflictException(
          'Já existe uma empresa cadastrada com este CNPJ',
        );
      }

      return await this.prisma.company.create({ data });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      // Tratamento de erros do Prisma
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

  // Retorna uma única empresa pelo ID.
  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }
    return {
      ...company,
      commission_rate: company.commission_rate
        ? Number(company.commission_rate)
        : null,
    };
  }

  // Atualiza os dados de uma empresa existente.
  async update(id: string, data: UpdateCompanyDto) {
    try {
      await this.findOne(id);

      // Se está atualizando o CNPJ, verifica se já existe outro com o mesmo CNPJ
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

      return await this.prisma.company.update({ where: { id }, data });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
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

  // Apaga uma empresa pelo ID.
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.company.delete({ where: { id } });
    return { ok: true };
  }

  // Gera link de convite para que um consultor se cadastre vinculado à empresa.
  async inviteConsultant(companyId: string, email: string) {
    const company = await this.findOne(companyId);

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Já existe uma conta cadastrada com este email');
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
      throw new ConflictException('Este escritório já possui um gerente cadastrado');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Já existe uma conta cadastrada com este email');
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
