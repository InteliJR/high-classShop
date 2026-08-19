import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ProductType, UserRole } from '@prisma/client';
import { ROLES_KEY } from 'src/shared/decorators/roles.decorator';
import { AdminDatabaseController } from './admin-database.controller';
import { AdminDatabaseService } from './admin-database.service';
import { AdminUserManagementService } from './admin-user-management.service';
import { ChangeRoleDto } from './dto/change-role.dto';
import { ChangeSpecialityDto } from './dto/change-speciality.dto';
import { localizedValidationExceptionFactory } from '../../shared/validation/localized-validation-exception';

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

  it.each([
    {
      metatype: ChangeRoleDto,
      payload: { role: 'SUPERUSER' },
      expected:
        'O cargo deve ser Cliente, Consultor, Especialista, Gerente de escritório ou Administrador.',
    },
    {
      metatype: ChangeRoleDto,
      payload: { role: UserRole.CONSULTANT, company_id: 'escritorio-1' },
      expected: 'O escritório deve ter um identificador válido.',
    },
    {
      metatype: ChangeRoleDto,
      payload: {
        role: UserRole.OFFICE,
        replacement: { role: 'SUPERUSER' },
      },
      expected:
        'O novo cargo do gerente atual deve ser Cliente, Consultor, Especialista ou Administrador.',
    },
    {
      metatype: ChangeSpecialityDto,
      payload: { speciality: 'MOTORCYCLE' },
      expected: 'A especialidade deve ser Carros, Embarcações ou Aeronaves.',
    },
  ])(
    'devolve validação de payload em português sem enum cru: $expected',
    async ({ metatype, payload, expected }) => {
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: localizedValidationExceptionFactory,
      });

      const caught = await pipe
        .transform(payload, { type: 'body', metatype })
        .catch((error: unknown) => error);

      expect(caught).toBeInstanceOf(BadRequestException);
      expect((caught as BadRequestException).getResponse()).toMatchObject({
        message: expect.arrayContaining([expected]),
      });
      expect(
        JSON.stringify((caught as BadRequestException).getResponse()),
      ).not.toMatch(
        /SUPERUSER|MOTORCYCLE|CUSTOMER|CONSULTANT|SPECIALIST|OFFICE|ADMIN|CAR|BOAT|AIRCRAFT/,
      );
    },
  );
});
