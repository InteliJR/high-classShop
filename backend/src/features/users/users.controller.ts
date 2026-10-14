import {
  Controller,
  Get,
  Query,
  Param,
  Patch,
  Body,
  ParseUUIDPipe,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { GetUsersDto } from './dto/get-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { UserRole } from '@prisma/client';
import { UserEntity } from 'src/auth/entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private assertSelfOrAdmin(targetId: string, actor?: UserEntity): void {
    if (!actor?.id || (actor.id !== targetId && actor.role !== UserRole.ADMIN)) {
      throw new ForbiddenException('Acesso não autorizado');
    }
  }

  /**
   * DESATIVADA — GET /api/users (listagem)
   *
   * A rota não tinha @Roles(), então qualquer usuário autenticado listava
   * todos os usuários da plataforma com nome, e-mail e CPF. O único consumidor
   * era o select de clientes do CreateProcessModal, na tela de processos do
   * especialista — ou seja, para escolher um cliente o especialista via a base
   * inteira, inclusive clientes de outros escritórios.
   *
   * O botão que abria esse modal foi retirado da tela, e a função que chamava
   * esta rota (fetchClients, em select-options.service.ts) foi comentada.
   *
   * Comentada em vez de apagada: se a listagem voltar, ela precisa nascer
   * escopada por papel — o ADMIN tem visão global legítima, os demais não.
   * GET /api/users/:id (abaixo) exige autenticação e acesso self ou ADMIN.
   */
  // /**
  // * GET /api/users
  // * Get all users with pagination and optional role filter
  // * @param query - Query parameters (page, perPage, role)
  // * @example
  // * GET /api/users?page=1&perPage=20&role=CUSTOMER
  // */
  // @Get()
  // async getAll(@Query() query: GetUsersDto) {
  // const result = await this.usersService.getAll(query);
  //
  // return {
  // success: true,
  // message: 'Usuários recuperados com sucesso',
  // data: result.data,
  // meta: {
  // pagination: result.pagination,
  // },
  // };
  // }

  /**
   * GET /api/users/:id
   * Get a private user profile (self or ADMIN)
   * @param userId - The ID of the user (UUID)
   * @returns User data with full details
   */
  @Get(':id')
  @UseGuards(AuthGuard)
  async getById(
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Req() req: { user?: UserEntity },
  ) {
    this.assertSelfOrAdmin(userId, req?.user);
    const user = await this.usersService.getById(userId);

    return {
      success: true,
      message: 'Usuário obtido com sucesso',
      data: user,
    };
  }

  /**
   * PATCH /api/users/:id
   * Update user data (name, surname, cpf, rg, phone, calendly_url)
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
    @Req() req: { user?: UserEntity },
  ) {
    this.assertSelfOrAdmin(userId, req?.user);
    const updatedUser = await this.usersService.update(userId, updateUserDto);

    return {
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: updatedUser,
    };
  }
}
