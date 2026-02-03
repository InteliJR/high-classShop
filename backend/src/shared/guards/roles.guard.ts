import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { Observable } from "rxjs";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { UserEntity } from "src/auth/entities/user.entity";

@Injectable()
export class RolesGuard implements CanActivate {
    private readonly logger = new Logger(RolesGuard.name);

    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass()
        ]);

        this.logger.log(`[RolesGuard] Required roles: ${JSON.stringify(requiredRoles)}`);

        if (!requiredRoles) {
            this.logger.log(`[RolesGuard] Nenhuma role requerida, permitindo acesso`);
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user : UserEntity = request.user;

        this.logger.log(`[RolesGuard] Usuário encontrado: ${user?.id}`);
        this.logger.log(`[RolesGuard] Role do usuário: ${user?.role}`);

        if (!user) {
            this.logger.error(`[RolesGuard] ERRO: Usuário não encontrado no request`);
            throw new UnauthorizedException('Unauthorized');
        }

        const hasRole = requiredRoles.some((role) => user.role == role);
        this.logger.log(`[RolesGuard] User tem role? ${hasRole} (verificou ${requiredRoles.length} roles)`);
        
        if (!hasRole) {
            this.logger.error(`[RolesGuard] ERRO: Usuário ${user.id} com role ${user.role} não tem permissão. Roles requeridas: ${JSON.stringify(requiredRoles)}`);
            throw new UnauthorizedException('Unauthorized');
        }

        return true;
    }

}