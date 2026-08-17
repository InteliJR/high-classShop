import { UserRole } from '@prisma/client';
import { assertSpecialistHasCalendly } from './specialist-auth.helper';

function mkPrisma(connection: { is_active: boolean } | null) {
  return {
    calendlyConnection: {
      findUnique: jest.fn().mockResolvedValue(connection),
    },
  } as any;
}

describe('assertSpecialistHasCalendly', () => {
  it('permite ADMIN sem checar Calendly', async () => {
    const prisma = mkPrisma(null);
    await expect(
      assertSpecialistHasCalendly(
        { id: 'admin-1', role: UserRole.ADMIN } as any,
        prisma,
      ),
    ).resolves.toBeUndefined();
    expect(prisma.calendlyConnection.findUnique).not.toHaveBeenCalled();
  });

  it('permite SPECIALIST com Calendly conectado (is_active=true)', async () => {
    const prisma = mkPrisma({ is_active: true });
    await expect(
      assertSpecialistHasCalendly(
        { id: 'spec-1', role: UserRole.SPECIALIST } as any,
        prisma,
      ),
    ).resolves.toBeUndefined();
  });

  it('bloqueia SPECIALIST sem conexão com o Calendly', async () => {
    const prisma = mkPrisma(null);
    await expect(
      assertSpecialistHasCalendly(
        { id: 'spec-1', role: UserRole.SPECIALIST } as any,
        prisma,
      ),
    ).rejects.toThrow(/Calendly/);
  });

  it('bloqueia SPECIALIST com conexão desativada (is_active=false)', async () => {
    const prisma = mkPrisma({ is_active: false });
    await expect(
      assertSpecialistHasCalendly(
        { id: 'spec-1', role: UserRole.SPECIALIST } as any,
        prisma,
      ),
    ).rejects.toThrow(/Calendly/);
  });
});
