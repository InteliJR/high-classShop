import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.company.findMany();
  }

  create(data: { name: string; cnpj: string }) {
    return this.prisma.company.create({ data });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async update(id: string, data: Partial<{ name: string; cnpj: string; logo: string; description: string }>) {
    await this.findOne(id); // valida existência
    return this.prisma.company.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id); // valida existência
    await this.prisma.company.delete({ where: { id } });
    return { ok: true };
  }
}
