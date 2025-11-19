import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateConsultantDto } from './dto/create-consultant.dto';
import { UpdateConsultantDto } from './dto/update-consultant.dto';
import { UserRole } from 'src/auth/dto/auth';
import * as bcrypt from 'bcrypt';
import { UserEntity } from 'src/auth/entities/user.entity';


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
    // Verificar se o usuário já existe
    console.log("Na função de criar o consultor");
    const userAlreadyExists = await this.prisma.user.findUnique({
      where: {
        email: data.email,   
      },
    });
    if (userAlreadyExists) {
      throw new UnauthorizedException('This user already exists');
    }

    // Criar o role para registrar o usuário padrão
    const registerRole = UserRole.CONSULTANT;

    // Separação da req
    const { password, ...dataSave } = data;

    // Criar o hash da senha
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Cria o usuário
    const user = await this.prisma.user.create({
      data: { ...dataSave, password_hash: passwordHash, role: registerRole },
    });

    console.log(user);

    return {
      user: UserEntity.fromPrisma(user),
    };
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
