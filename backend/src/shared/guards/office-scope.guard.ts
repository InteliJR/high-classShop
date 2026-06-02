import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UserEntity } from 'src/auth/entities/user.entity';

export interface OfficeScopedRequest {
  user: UserEntity;
  officeScope: {
    companyId: string | null; // null = ADMIN bypass (sem filtro tenant)
    isAdmin: boolean;
  };
}

/**
 * OfficeScopeGuard — proteção multi-tenant para endpoints /office/*.
 *
 * Regras:
 *  - OFFICE: exige company_id no JWT, injeta em req.officeScope.companyId.
 *  - ADMIN: bypass (companyId=null, isAdmin=true) — services devem ler isAdmin
 *    para decidir se aplicam ou não filtro.
 *  - qualquer outro role: 403.
 *
 * CRÍTICO: todo service /office/* DEVE filtrar Prisma por req.officeScope.companyId
 * quando NÃO for ADMIN. Sem isso = IDOR garantido.
 */
@Injectable()
export class OfficeScopeGuard implements CanActivate {
  private readonly logger = new Logger(OfficeScopeGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<OfficeScopedRequest & { user?: UserEntity }>();

    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Acesso negado');
    }

    if (user.role === UserRole.ADMIN) {
      req.officeScope = { companyId: null, isAdmin: true };
      return true;
    }

    if (user.role !== UserRole.OFFICE) {
      this.logger.warn(
        `[OfficeScopeGuard] acesso negado role=${user.role} user=${user.id}`,
      );
      throw new ForbiddenException('Acesso negado');
    }

    if (!user.company_id) {
      this.logger.error(
        `[OfficeScopeGuard] OFFICE user=${user.id} sem company_id — config inválida`,
      );
      throw new ForbiddenException('Escritório sem empresa vinculada');
    }

    req.officeScope = { companyId: user.company_id, isAdmin: false };
    return true;
  }
}
