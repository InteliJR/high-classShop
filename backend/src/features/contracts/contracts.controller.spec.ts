import { UserRole } from '@prisma/client';
import { ROLES_KEY } from 'src/shared/decorators/roles.decorator';
import { ContractsController } from './contracts.controller';

describe('ContractsController route policy', () => {
  it('reserva generate legado ao SPECIALIST e mantém preview/send para ADMIN', () => {
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        ContractsController.prototype.generateContract,
      ),
    ).toEqual([UserRole.SPECIALIST]);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        ContractsController.prototype.previewContract,
      ),
    ).toEqual(expect.arrayContaining([UserRole.SPECIALIST, UserRole.ADMIN]));
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        ContractsController.prototype.sendContractAfterPreview,
      ),
    ).toEqual(expect.arrayContaining([UserRole.SPECIALIST, UserRole.ADMIN]));
  });
});
