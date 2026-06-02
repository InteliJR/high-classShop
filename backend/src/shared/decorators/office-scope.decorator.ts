import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OfficeScopedRequest } from '../guards/office-scope.guard';

/**
 * Param decorator: injeta { companyId, isAdmin } populado pelo OfficeScopeGuard.
 *
 * Uso:
 *   @Get('consultants')
 *   list(@OfficeScope() scope: { companyId: string|null; isAdmin: boolean }) { ... }
 */
export const OfficeScope = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<OfficeScopedRequest>();
    return req.officeScope;
  },
);
