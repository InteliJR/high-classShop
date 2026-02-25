import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdatePlatformCompanyDto } from './dto/update-platform-company.dto';

@Injectable()
export class PlatformCompanyService {
  constructor(private prisma: PrismaService) {}

  /**
   * Retorna a empresa da plataforma (singleton - primeiro registro).
   * Se não existir, retorna null.
   */
  async findOne() {
    const company = await this.prisma.platformCompany.findFirst();
    if (!company) {
      return null;
    }
    return {
      ...company,
      default_commission_rate: Number(company.default_commission_rate),
    };
  }

  /**
   * Atualiza os dados da empresa da plataforma.
   * Se não existir, cria uma nova (upsert).
   */
  async update(data: UpdatePlatformCompanyDto) {
    const existing = await this.prisma.platformCompany.findFirst();

    if (existing) {
      const updated = await this.prisma.platformCompany.update({
        where: { id: existing.id },
        data,
      });
      return {
        ...updated,
        default_commission_rate: Number(updated.default_commission_rate),
      };
    }

    // Se não existir, cria
    const created = await this.prisma.platformCompany.create({ data });
    return {
      ...created,
      default_commission_rate: Number(created.default_commission_rate),
    };
  }
}
