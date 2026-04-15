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

        if (!requiredRoles) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user : UserEntity = request.user;

        if (!user) {
            throw new UnauthorizedException('Unauthorized');
        }

        const hasRole = requiredRoles.some((role) => user.role == role);
        
        if (!hasRole) {
            this.logger.warn(
              `[RolesGuard] Acesso negado para usuário ${user.id} (${user.role}). Roles requeridas: ${JSON.stringify(requiredRoles)}`,
            );
            throw new UnauthorizedException('Unauthorized');
        }

        return true;
    }

}