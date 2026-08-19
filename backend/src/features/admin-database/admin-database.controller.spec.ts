import 'reflect-metadata';
import { ProductType, UserRole } from '@prisma/client';
import { ROLES_KEY } from 'src/shared/decorators/roles.decorator';
import { AdminDatabaseController } from './admin-database.controller';
import { AdminDatabaseService } from './admin-database.service';
import { AdminUserManagementService } from './admin-user-management.service';
import { ChangeRoleDto } from './dto/change-role.dto';
import { ChangeSpecialityDto } from './dto/change-speciality.dto';

describe('AdminDatabaseController — gestão de usuários', () => {
  const userId = 'a3e72de0-41b0-4468-a866-c5aac1a7a55e';
  const roleDto: ChangeRoleDto = { role: UserRole.SPECIALIST };
  const specialityDto: ChangeSpecialityDto = { speciality: ProductType.CAR };
  const management = {
    validateRoleChange: jest.fn(),
    changeRole: jest.fn(),
    validateSpecialityChange: jest.fn(),
    changeSpeciality: jest.fn(),
  } as unknown as AdminUserManagementService;
  const controller = new AdminDatabaseController(
    {} as AdminDatabaseService,
    management,
  );

  beforeEach(() => jest.clearAllMocks());

  it('delega pré-validação de cargo', async () => {
    const result = { allowed: true, blockers: [] };
    management.validateRoleChange = jest.fn().mockResolvedValue(result);

    await expect(
      (controller as any).validateRoleChange(userId, roleDto),
    ).resolves.toBe(result);
    expect(management.validateRoleChange).toHaveBeenCalledWith(userId, roleDto);
  });

  it('delega correção de cargo', async () => {
    const result = { id: userId, role: UserRole.SPECIALIST };
    management.changeRole = jest.fn().mockResolvedValue(result);

    await expect((controller as any).changeRole(userId, roleDto)).resolves.toBe(
      result,
    );
    expect(management.changeRole).toHaveBeenCalledWith(userId, roleDto);
  });

  it('delega pré-validação de especialidade', async () => {
    const result = { allowed: true, blockers: [] };
    management.validateSpecialityChange = jest.fn().mockResolvedValue(result);

    await expect(
      (controller as any).validateSpecialityChange(userId, specialityDto),
    ).resolves.toBe(result);
    expect(management.validateSpecialityChange).toHaveBeenCalledWith(
      userId,
      specialityDto,
    );
  });

  it('delega correção de especialidade', async () => {
    const result = { id: userId, speciality: ProductType.CAR };
    management.changeSpeciality = jest.fn().mockResolvedValue(result);

    await expect(
      (controller as any).changeSpeciality(userId, specialityDto),
    ).resolves.toBe(result);
    expect(management.changeSpeciality).toHaveBeenCalledWith(
      userId,
      specialityDto,
    );
  });

  it.each([
    'validateRoleChange',
    'changeRole',
    'validateSpecialityChange',
    'changeSpeciality',
  ])('protege %s somente para ADMIN', (method) => {
    expect(Reflect.getMetadata(ROLES_KEY, (controller as any)[method])).toEqual(
      [UserRole.ADMIN],
    );
  });
});
