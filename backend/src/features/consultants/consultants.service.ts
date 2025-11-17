import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateConsultantDto } from './dto/create-consultant.dto';
import { UpdateConsultantDto } from './dto/update-consultant.dto';

@Injectable()
export class ConsultantsService {
  constructor(private prisma: PrismaService) {}

  // Busca todos os consultores.
  async findAll() {
    return this.prisma.user.findMany({
      where: { role: 'CONSULTANT' },
    });
  }

  // Cria um novo consultor na base de dados.
  async create(data: CreateConsultantDto) {
    return this.prisma.user.create({
      data: {
        ...data,
        role: 'CONSULTANT',
      },
    });
  }

  // Retorna um único consultor pelo ID.
  async findOne(id: string) {
    const consultant = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!consultant || consultant.role !== 'CONSULTANT') {
      throw new NotFoundException('Consultant not found');
    }
    return consultant;
  }

  // Atualiza os dados de um consultor existente.
  async update(id: string, data: UpdateConsultantDto) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  // Apaga um consultor pelo ID.
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }
}
