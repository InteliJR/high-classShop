import { ForbiddenException } from '@nestjs/common';
import { OfficeScopeGuard } from './office-scope.guard';

function mkCtx(user: any) {
  const req: any = { user };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}

describe('OfficeScopeGuard', () => {
  let guard: OfficeScopeGuard;
  beforeEach(() => (guard = new OfficeScopeGuard()));

  // S9: CONSULTANT/CUSTOMER/SPECIALIST → 403
  it.each(['CONSULTANT', 'CUSTOMER', 'SPECIALIST'])(
    'role %s é bloqueado',
    (role) => {
      const ctx = mkCtx({ id: 'u1', role, company_id: 'c1' });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    },
  );

  // S10: sem user → 403
  it('sem user lança ForbiddenException', () => {
    const ctx = mkCtx(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  // OFFICE válido injeta scope
  it('OFFICE com company_id popula scope', () => {
    const ctx = mkCtx({ id: 'u1', role: 'OFFICE', company_id: 'companyA' });
    expect(guard.canActivate(ctx)).toBe(true);
    const req: any = ctx.switchToHttp().getRequest();
    expect(req.officeScope).toEqual({ companyId: 'companyA', isAdmin: false });
  });

  // OFFICE sem company_id → 403 (config inválida, não pode vazar tenant alheio)
  it('OFFICE sem company_id é bloqueado', () => {
    const ctx = mkCtx({ id: 'u1', role: 'OFFICE', company_id: null });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  // ADMIN bypass: companyId=null, isAdmin=true (override total)
  it('ADMIN obtém bypass total', () => {
    const ctx = mkCtx({ id: 'admin1', role: 'ADMIN', company_id: null });
    expect(guard.canActivate(ctx)).toBe(true);
    const req: any = ctx.switchToHttp().getRequest();
    expect(req.officeScope).toEqual({ companyId: null, isAdmin: true });
  });
});
