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
  private lastNoTokenLogTime: number = 0;
  private readonly LOG_THROTTLE_MS = 5 * 60 * 1000;
  private readonly verboseAuthLogs =
    process.env.AUTH_LOG_VERBOSE === 'true' &&
    process.env.NODE_ENV !== 'production';

  constructor(
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  // Implementar a função de can activate do guard
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<any>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      // Throttle dos logs para evitar spam
      const now = Date.now();
      if (this.verboseAuthLogs && now - this.lastNoTokenLogTime > this.LOG_THROTTLE_MS) {
        this.logger.debug(
          `[AuthGuard] Token não fornecido em requisição protegida (${request.method} ${request.url})`,
        );
        this.lastNoTokenLogTime = now;
      }
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
        this.logger.warn(
          `[AuthGuard] Usuário do token não encontrado no banco (ID: ${payload.sub})`,
        );
        throw new UnauthorizedException('Unauthorized');
      }

      request['user'] = UserEntity.fromPrisma(user);
    } catch (error) {
      if (this.verboseAuthLogs) {
        this.logger.warn(`[AuthGuard] Falha ao verificar token: ${error?.message}`);
      }
      throw new UnauthorizedException('Unauthorized');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
