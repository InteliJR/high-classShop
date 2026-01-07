import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetUsersDto } from './dto/get-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponse } from './entity/user.response';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all users with pagination and role filter
   * @param query - Query parameters (page, perPage, role)
   * @returns Paginated list of users
   */
  async getAll(query: GetUsersDto): Promise<{
    data: UserResponse[];
    pagination: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {
    const page = query.page || 1;
    const perPage = query.perPage || 20;
    const skip = (page - 1) * perPage;

    // Build where clause
    const where: any = {};
    if (query.role) {
      where.role = query.role;
    }

    // Fetch total count and data
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
          role: true,
          cpf: true,
          civil_state: true,
          speciality: true,
          created_at: true,
        },
        skip,
        take: perPage,
        orderBy: {
          created_at: 'desc',
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return {
      data: users.map((user) => this.mapToUserResponse(user)),
      pagination: {
        page,
        perPage,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Map Prisma user to UserResponse
   */
  private mapToUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      role: user.role,
      cpf: user.cpf,
      civil_state: user.civil_state,
      speciality: user.speciality,
      created_at: user.created_at,
    };
  }

  /**
   * Get a single user by ID
   * @param userId - The ID of the user
   * @returns User data with full details
   * @throws NotFoundException if user not found
   */
  async getById(userId: string): Promise<{
    id: string;
    name: string;
    surname: string;
    email: string;
    role: string;
    cpf: string;
    rg: string;
    civil_state: string | null;
    speciality: string | null;
    calendly_url: string | null;
    created_at: Date;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        role: true,
        cpf: true,
        rg: true,
        civil_state: true,
        speciality: true,
        calendly_url: true,
        created_at: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuário com id ${userId} não encontrado`);
    }

    return user;
  }

  /**
   * Update user data
   * @param userId - The ID of the user to update
   * @param updateUserDto - Data to update
   * @returns Updated user data
   * @throws NotFoundException if user not found
   * @throws ConflictException if CPF or RG already exists
   */
  async update(
    userId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<{
    id: string;
    name: string;
    surname: string;
    email: string;
    role: string;
    cpf: string;
    rg: string;
    calendly_url: string | null;
  }> {
    // Verificar se o usuário existe
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException(`Usuário com id ${userId} não encontrado`);
    }

    // Verificar CPF duplicado (se estiver sendo atualizado)
    if (updateUserDto.cpf && updateUserDto.cpf !== existingUser.cpf) {
      const cpfExists = await this.prisma.user.findUnique({
        where: { cpf: updateUserDto.cpf },
      });
      if (cpfExists) {
        throw new ConflictException('CPF já cadastrado no sistema');
      }
    }

    // Verificar RG duplicado (se estiver sendo atualizado)
    if (updateUserDto.rg && updateUserDto.rg !== existingUser.rg) {
      const rgExists = await this.prisma.user.findUnique({
        where: { rg: updateUserDto.rg },
      });
      if (rgExists) {
        throw new ConflictException('RG já cadastrado no sistema');
      }
    }

    // Atualizar usuário
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(updateUserDto.name && { name: updateUserDto.name }),
        ...(updateUserDto.surname && { surname: updateUserDto.surname }),
        ...(updateUserDto.cpf && { cpf: updateUserDto.cpf }),
        ...(updateUserDto.rg && { rg: updateUserDto.rg }),
        ...(updateUserDto.calendly_url !== undefined && {
          calendly_url: updateUserDto.calendly_url,
        }),
        updated_at: new Date(),
      },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        role: true,
        cpf: true,
        rg: true,
        calendly_url: true,
      },
    });

    return updatedUser;
  }
}
