import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSpecialistDto } from './dto/create-specialist.dto';
import { UpdateSpecialistDto } from './dto/update-specialist.dto';

@Injectable()
export class SpecialistsService {
  constructor(private prisma: PrismaService) {}

  // Busca todos os especialistas.
  async findAll() {
    return this.prisma.user.findMany({
      where: { role: 'SPECIALIST' },
    });
  }

  // Cria um novo especialista na base de dados.
  async create(data: CreateSpecialistDto) {
    return this.prisma.user.create({
      data: {
        name: data.name,
        surname: data.surname,
        email: data.email,
        cpf: data.cpf,
        rg: data.rg,
        password_hash: data.password_hash,
        speciality: data.speciality,
        role: 'SPECIALIST',
      },
    });
  }

  // Retorna um único especialista pelo ID.
  async findOne(id: string) {
    const specialist = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!specialist || specialist.role !== 'SPECIALIST') {
      throw new NotFoundException('Specialist not found');
    }
    return specialist;
  }

  // Atualiza os dados de um especialista existente.
  async update(id: string, data: UpdateSpecialistDto) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  // Apaga um especialista pelo ID.
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }
}
