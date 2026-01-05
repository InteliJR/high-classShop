import { Controller, Get, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { GetUsersDto } from './dto/get-users.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/users
   * Get all users with pagination and optional role filter
   * @param query - Query parameters (page, perPage, role)
   * @example
   * GET /api/users?page=1&perPage=20&role=CUSTOMER
   */
  @Get()
  async getAll(@Query() query: GetUsersDto) {
    const result = await this.usersService.getAll(query);

    return {
      success: true,
      message: 'Usuários recuperados com sucesso',
      data: result.data,
      meta: {
        pagination: result.pagination,
      },
    };
  }
}
