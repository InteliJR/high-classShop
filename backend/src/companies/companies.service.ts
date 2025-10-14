import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.companies.findMany();
  }

  create(data: { name: string; cnpj: string }) {
    return this.prisma.companies.create({ data });
  }

  async findOne(id: number) {
    const company = await this.prisma.companies.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async update(id: number, data: Partial<{ name: string; cnpj: string; logo: string; description: string }>) {
    await this.findOne(id); // valida existência
    return this.prisma.companies.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.findOne(id); // valida existência
    await this.prisma.companies.delete({ where: { id } });
    return { ok: true };
  }
}
