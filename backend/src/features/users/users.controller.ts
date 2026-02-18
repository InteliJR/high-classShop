import {
  Controller,
  Get,
  Query,
  Param,
  Patch,
  Body,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { GetUsersDto } from './dto/get-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { Public } from 'src/shared/decorators/public.decorator';

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

  /**
   * GET /api/users/:id
   * Get a single user by ID (public - used for specialist info on product pages)
   * @param userId - The ID of the user (UUID)
   * @returns User data with full details
   */
  @Get(':id')
  @Public()
  async getById(@Param('id', new ParseUUIDPipe()) userId: string) {
    const user = await this.usersService.getById(userId);

    return {
      success: true,
      message: 'Usuário obtido com sucesso',
      data: user,
    };
  }

  /**
   * PATCH /api/users/:id
   * Update user data (name, surname, cpf, rg, calendly_url)
   *
   * @param userId - The ID of the user to update
   * @param updateUserDto - Data to update
   * @returns Updated user data
   *
   * @throws 404 - User not found
   * @throws 409 - CPF or RG already exists
   *
   * @example
   * PATCH /api/users/123e4567-e89b-12d3-a456-426614174000
   * Body: { "name": "João", "calendly_url": "https://calendly.com/joao" }
   */
  @Patch(':id')
  @UseGuards(AuthGuard)
  async update(
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const updatedUser = await this.usersService.update(userId, updateUserDto);

    return {
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: updatedUser,
    };
  }
}
