import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetUsersDto } from './dto/get-users.dto';
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
}
