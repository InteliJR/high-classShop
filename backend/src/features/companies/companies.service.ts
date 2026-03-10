import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Prisma } from '@prisma/client';
import { PaginationDto } from '../../shared/dto/pagination.dto';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  // Busca todas as empresas com contagem de especialistas.
  async findAll() {
    const companies = await this.prisma.company.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    return companies.map((c) => ({
      ...c,
      commission_rate: c.commission_rate ? Number(c.commission_rate) : null,
      specialists_count: c._count.users,
      _count: undefined,
    }));
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

  // Busca especialistas associados a uma empresa, com paginação.
  async findSpecialistsByCompany(
    companyId: string,
    page: number = 1,
    perPage: number = 5,
  ) {
    // Verificar se empresa existe
    await this.findOne(companyId);

    const skip = (page - 1) * perPage;

    const [specialists, count] = await Promise.all([
      this.prisma.user.findMany({
        where: { company_id: companyId },
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
          role: true,
          speciality: true,
          commission_rate: true,
          calendly_url: true,
          created_at: true,
        },
        skip,
        take: perPage,
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.count({
        where: { company_id: companyId },
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
      data: specialists.map((s) => ({
        ...s,
        commission_rate: s.commission_rate ? Number(s.commission_rate) : null,
      })),
      pagination,
    };
  }
}
