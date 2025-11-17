import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  // Busca todas as empresas.
  async findAll() {
    return this.prisma.company.findMany();
  }

  // Cria uma nova empresa na base de dados.
  async create(data: CreateCompanyDto) {
    return this.prisma.company.create({ data });
  }

  // Retorna uma única empresa pelo ID.
  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  // Atualiza os dados de uma empresa existente.
  async update(id: string, data: UpdateCompanyDto) {
    await this.findOne(id);
    return this.prisma.company.update({ where: { id }, data });
  }

  // Apaga uma empresa pelo ID.
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.company.delete({ where: { id } });
    return { ok: true };
  }
}
