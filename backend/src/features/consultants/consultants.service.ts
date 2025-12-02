import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateConsultantDto } from './dto/create-consultant.dto';
import { UpdateConsultantDto } from './dto/update-consultant.dto';
import { UserRole } from 'src/auth/dto/auth';
import * as bcrypt from 'bcrypt';
import { UserEntity } from 'src/auth/entities/user.entity';
import { Prisma } from '@prisma/client';


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
    try {
      // Verificar se já existe usuário com o mesmo email
      const existingUserByEmail = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUserByEmail) {
        throw new ConflictException('Já existe um usuário cadastrado com este email');
      }

      // Verificar se já existe usuário com o mesmo CPF
      const existingUserByCpf = await this.prisma.user.findUnique({
        where: { cpf: data.cpf },
      });

      if (existingUserByCpf) {
        throw new ConflictException('Já existe um usuário cadastrado com este CPF');
      }

      // Verificar se a empresa existe
      if (data.company_id) {
        const companyExists = await this.prisma.company.findUnique({
          where: { id: data.company_id },
        });

        if (!companyExists) {
          throw new BadRequestException('Empresa não encontrada');
        }
      }

      // Criar o role para registrar o usuário padrão
      const registerRole = UserRole.CONSULTANT;

      // Separação da req
      const { password, ...dataSave } = data;

      // Criar o hash da senha
      const passwordHash = await bcrypt.hash(password, 10);

      // Cria o usuário
      const user = await this.prisma.user.create({
        data: { ...dataSave, password_hash: passwordHash, role: registerRole },
      });

      return {
        user: UserEntity.fromPrisma(user),
      };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }

      // Tratamento de erros do Prisma
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = (error.meta?.target as string[]) || [];
          if (target.includes('email')) {
            throw new ConflictException('Já existe um usuário cadastrado com este email');
          }
          if (target.includes('cpf')) {
            throw new ConflictException('Já existe um usuário cadastrado com este CPF');
          }
          throw new ConflictException('Já existe um usuário cadastrado com estes dados');
        }
        if (error.code === 'P2003') {
          throw new BadRequestException('Empresa não encontrada');
        }
      }

      throw new BadRequestException('Erro ao criar consultor. Verifique os dados e tente novamente.');
    }
  }

  // Retorna um único consultor pelo ID.
  async findOne(id: string) {
    const consultant = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!consultant || consultant.role !== 'CONSULTANT') {
      throw new NotFoundException('Consultor não encontrado');
    }
    return consultant;
  }

  // Atualiza os dados de um consultor existente.
  async update(id: string, data: UpdateConsultantDto) {
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
          throw new ConflictException('Já existe outro usuário cadastrado com este email');
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
          throw new ConflictException('Já existe outro usuário cadastrado com este CPF');
        }
      }

      // Se está atualizando a empresa, verifica se ela existe
      if (data.company_id) {
        const companyExists = await this.prisma.company.findUnique({
          where: { id: data.company_id },
        });

        if (!companyExists) {
          throw new BadRequestException('Empresa não encontrada');
        }
      }

      // Se está atualizando a senha, faz o hash
      const updateData = { ...data };
      if (data.password) {
        updateData.password_hash = await bcrypt.hash(data.password, 10);
        delete updateData.password;
      }

      return await this.prisma.user.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = (error.meta?.target as string[]) || [];
          if (target.includes('email')) {
            throw new ConflictException('Já existe outro usuário cadastrado com este email');
          }
          if (target.includes('cpf')) {
            throw new ConflictException('Já existe outro usuário cadastrado com este CPF');
          }
        }
        if (error.code === 'P2003') {
          throw new BadRequestException('Empresa não encontrada');
        }
      }

      throw new BadRequestException('Erro ao atualizar consultor. Verifique os dados e tente novamente.');
    }
  }

  // Apaga um consultor pelo ID.
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }
}
