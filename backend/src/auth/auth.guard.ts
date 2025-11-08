import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserEntity } from './entities/user.entity';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/utils/decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
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
    if (!token) {
      throw new UnauthorizedException('Unauthorized');
    }
    
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtConstants.access,
      });

      // Adicionar as informações do usuario que estão no banco de dados
      const user = await this.prismaService.user.findUnique({
        where: {
          id: payload.sub,
          email: payload.email,
        },
      });

      if (!user) {
        throw new UnauthorizedException('Unauthorized');
      }

      request['user'] = UserEntity.fromPrisma(user);
    } catch {
      throw new UnauthorizedException('Unauthorized');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
