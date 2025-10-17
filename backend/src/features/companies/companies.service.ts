import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from 'src/aws/s3.service';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
  ) {}

  // Retorna todas as empresas, com o URL do logo assinado para acesso temporário.
  async findAll() {
    const companies = await this.prisma.companies.findMany();
    return Promise.all(
      companies.map(async (company) => {
        let logoUrl: string | null = null;
        if (company.logo) {
          logoUrl = await this.s3Service.getSignedUrl(company.logo);
        }
        return { ...company, logoUrl };
      }),
    );
  }

  // Cria uma nova empresa na base de dados.
  create(data: { name: string; cnpj: string; logo?: string }) {
    return this.prisma.companies.create({ data });
  }

  // Retorna uma única empresa pelo ID, com o URL do logo assinado.
  async findOne(id: number) {
    const company = await this.prisma.companies.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    let logoUrl: string | null = null;
    if (company.logo) {
      logoUrl = await this.s3Service.getSignedUrl(company.logo);
    }

    return { ...company, logoUrl };
  }

  // Atualiza os dados de uma empresa existente.
  async update(
    id: number,
    data: Partial<{
      name: string;
      cnpj: string;
      logo: string;
      description: string;
    }>,
  ) {
    await this.findOne(id);
    return this.prisma.companies.update({ where: { id }, data });
  }

  // Apaga uma empresa pelo ID.
  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.companies.delete({ where: { id } });
    return { ok: true };
  }
}
