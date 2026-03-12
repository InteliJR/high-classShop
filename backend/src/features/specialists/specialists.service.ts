import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSpecialistDto } from './dto/create-specialist.dto';
import { UpdateSpecialistDto } from './dto/update-specialist.dto';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SpecialistsService {
  constructor(private prisma: PrismaService) {}

  // Busca todos os especialistas.
  async findAll() {
    const specialists = await this.prisma.user.findMany({
      where: { role: 'SPECIALIST' },
      include: { company: true },
    });
    return specialists.map((s) => ({
      ...s,
      commission_rate: s.commission_rate ? Number(s.commission_rate) : null,
    }));
  }

  // Cria um novo especialista na base de dados.
  async create(data: CreateSpecialistDto) {
    try {
      // Verifica se já existe usuário com o mesmo email
      const existingUserByEmail = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUserByEmail) {
        throw new ConflictException(
          'Já existe um usuário cadastrado com este email',
        );
      }

      // Verifica se já existe usuário com o mesmo CPF
      const existingUserByCpf = await this.prisma.user.findUnique({
        where: { cpf: data.cpf },
      });

      if (existingUserByCpf) {
        throw new ConflictException(
          'Já existe um usuário cadastrado com este CPF',
        );
      }

      // Hash da senha antes de salvar no banco de dados
      const hashedPassword = await bcrypt.hash(data.password_hash, 10);

      return await this.prisma.user.create({
        data: {
          name: data.name,
          surname: data.surname,
          email: data.email,
          cpf: data.cpf,
          rg: data.rg,
          password_hash: hashedPassword,
          speciality: data.speciality,
          role: 'SPECIALIST',
          company_id: data.company_id || null,
          commission_rate: data.commission_rate ?? null,
          bank: data.bank || null,
          agency: data.agency || null,
          checking_account: data.checking_account || null,
        },
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      // Tratamento de erros do Prisma
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = (error.meta?.target as string[]) || [];
          if (target.includes('email')) {
            throw new ConflictException(
              'Já existe um usuário cadastrado com este email',
            );
          }
          if (target.includes('cpf')) {
            throw new ConflictException(
              'Já existe um usuário cadastrado com este CPF',
            );
          }
          throw new ConflictException(
            'Já existe um usuário cadastrado com estes dados',
          );
        }
      }

      throw new BadRequestException(
        'Erro ao criar especialista. Verifique os dados e tente novamente.',
      );
    }
  }

  // Retorna um único especialista pelo ID.
  async findOne(id: string) {
    const specialist = await this.prisma.user.findUnique({
      where: { id },
      include: { company: true },
    });
    if (!specialist || specialist.role !== 'SPECIALIST') {
      throw new NotFoundException('Especialista não encontrado');
    }
    return {
      ...specialist,
      commission_rate: specialist.commission_rate
        ? Number(specialist.commission_rate)
        : null,
    };
  }

  // Atualiza os dados de um especialista existente.
  async update(id: string, data: UpdateSpecialistDto) {
    try {
      await this.findOne(id);

      // Se está atualizando o email, verifica se já existe outro usuário com o mesmo email
      if (data.email) {
        const existingUser = await this.prisma.user.findFirst({
          where: {
            email: data.email,
            NOT: { id },
          },
        });

        if (existingUser) {
          throw new ConflictException(
            'Já existe outro usuário cadastrado com este email',
          );
        }
      }

      // Se está atualizando o CPF, verifica se já existe outro usuário com o mesmo CPF
      if (data.cpf) {
        const existingUser = await this.prisma.user.findFirst({
          where: {
            cpf: data.cpf,
            NOT: { id },
          },
        });

        if (existingUser) {
          throw new ConflictException(
            'Já existe outro usuário cadastrado com este CPF',
          );
        }
      }

      // Se está atualizando a senha, hashear antes de salvar
      const updateData = { ...data };
      if (data.password_hash) {
        updateData.password_hash = await bcrypt.hash(data.password_hash, 10);
      }

      return await this.prisma.user.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = (error.meta?.target as string[]) || [];
          if (target.includes('email')) {
            throw new ConflictException(
              'Já existe outro usuário cadastrado com este email',
            );
          }
          if (target.includes('cpf')) {
            throw new ConflictException(
              'Já existe outro usuário cadastrado com este CPF',
            );
          }
        }
      }

      throw new BadRequestException(
        'Erro ao atualizar especialista. Verifique os dados e tente novamente.',
      );
    }
  }

  // Apaga um especialista pelo ID.
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  // Retorna especialistas agrupados por categoria (speciality).
  async findAllGroupedByCategory() {
    const specialists = await this.prisma.user.findMany({
      where: { role: 'SPECIALIST' },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        cpf: true,
        rg: true,
        speciality: true,
        company_id: true,
        commission_rate: true,
      },
    });

    // Agrupa os especialistas por categoria
    const grouped = {
      CAR: specialists.filter((s) => s.speciality === 'CAR'),
      BOAT: specialists.filter((s) => s.speciality === 'BOAT'),
      AIRCRAFT: specialists.filter((s) => s.speciality === 'AIRCRAFT'),
    };

    return grouped;
  }
}
