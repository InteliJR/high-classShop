import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  // Busca todas as empresas.
  async findAll() {
    return this.prisma.company.findMany();
  }

  // Cria uma nova empresa na base de dados.
  async create(data: CreateCompanyDto) {
    try {
      // Verifica se já existe empresa com o mesmo CNPJ
      const existingCompany = await this.prisma.company.findUnique({
        where: { cnpj: data.cnpj },
      });

      if (existingCompany) {
        throw new ConflictException('Já existe uma empresa cadastrada com este CNPJ');
      }

      return await this.prisma.company.create({ data });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      // Tratamento de erros do Prisma
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Já existe uma empresa cadastrada com este CNPJ');
        }
      }

      throw new BadRequestException('Erro ao criar empresa. Verifique os dados e tente novamente.');
    }
  }

  // Retorna uma única empresa pelo ID.
  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }
    return company;
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
          throw new ConflictException('Já existe outra empresa cadastrada com este CNPJ');
        }
      }

      return await this.prisma.company.update({ where: { id }, data });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Já existe outra empresa cadastrada com este CNPJ');
        }
      }

      throw new BadRequestException('Erro ao atualizar empresa. Verifique os dados e tente novamente.');
    }
  }

  // Apaga uma empresa pelo ID.
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.company.delete({ where: { id } });
    return { ok: true };
  }
}
