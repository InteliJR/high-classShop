import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserEntity } from './entities/user.entity';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/shared/decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
    private readonly reflector: Reflector
  ) {}

  // Implementar a função de can activate do guard
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ])

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<any>();
    const token = this.extractTokenFromHeader(request);
    
    this.logger.log(`[AuthGuard] Token fornecido? ${!!token}`);
    
    if (!token) {
      this.logger.error(`[AuthGuard] ERRO: Token não fornecido`);
      throw new UnauthorizedException('Unauthorized');
    }
    
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtConstants.access,
      });

      this.logger.log(`[AuthGuard] Token verificado. User ID: ${payload.sub}`);

      // Adicionar as informações do usuario que estão no banco de dados
      const user = await this.prismaService.user.findUnique({
        where: {
          id: payload.sub,
          email: payload.email,
        },
      });

      this.logger.log(`[AuthGuard] Usuário encontrado no banco? ${!!user}`);
      if (user) {
        this.logger.log(`[AuthGuard] Usuário: ${user.email}, Role: ${user.role}`);
      }

      if (!user) {
        this.logger.error(`[AuthGuard] ERRO: Usuário não encontrado no banco de dados`);
        throw new UnauthorizedException('Unauthorized');
      }

      request['user'] = UserEntity.fromPrisma(user);
      this.logger.log(`[AuthGuard] User entity atribuído ao request`);
    } catch (error) {
      this.logger.error(`[AuthGuard] ERRO ao verificar token: ${error?.message}`);
      throw new UnauthorizedException('Unauthorized');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
