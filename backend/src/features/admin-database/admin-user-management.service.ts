import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProcessStatus, ProductType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { blockerMessage } from './admin-user-management.labels';
import {
  ChangeRoleDto,
  OfficeManagerReplacementDto,
} from './dto/change-role.dto';
import { ChangeSpecialityDto } from './dto/change-speciality.dto';
import {
  ChangeBlocker,
  ChangeBlockerCode,
  ChangeValidationResult,
} from './admin-user-management.types';

type UserManagementDatabase = Pick<
  PrismaService,
  | 'user'
  | 'company'
  | 'customerAdvisor'
  | 'car'
  | 'boat'
  | 'aircraft'
  | 'appointment'
  | 'process'
>;

type ManagedUser = {
  id: string;
  role: UserRole;
  is_active: boolean;
  consultant_id: string | null;
  company_id: string | null;
  speciality: ProductType | null;
};

@Injectable()
export class AdminUserManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async validateRoleChange(
    id: string,
    dto: ChangeRoleDto,
  ): Promise<ChangeValidationResult> {
    return this.analyzeRoleChange(this.prisma, id, dto);
  }

  async changeRole(id: string, dto: ChangeRoleDto) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const result = await this.analyzeRoleChange(tx, id, dto);
          if (!result.allowed) throw new ConflictException(result);
          return this.applyRoleChange(tx, id, dto);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (this.isOfficeConflict(error))
        throw new ConflictException(this.result(['OFFICE_CONFLICT']));
      throw error;
    }
  }

  async validateSpecialityChange(
    id: string,
    dto: ChangeSpecialityDto,
  ): Promise<ChangeValidationResult> {
    return this.analyzeSpecialityChange(this.prisma, id, dto);
  }

  async changeSpeciality(id: string, dto: ChangeSpecialityDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const result = await this.analyzeSpecialityChange(tx, id, dto);
        if (!result.allowed) throw new ConflictException(result);
        return tx.user.update({
          where: { id },
          data: { speciality: dto.speciality },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async analyzeRoleChange(
    db: UserManagementDatabase,
    id: string,
    dto: ChangeRoleDto,
    skipOfficeReplacement = false,
  ): Promise<ChangeValidationResult> {
    const subject = await this.findUser(db, id);
    const blockers: ChangeBlocker[] = [];

    if (subject.role === dto.role) this.add(blockers, 'ROLE_UNCHANGED');
    await this.validateRoleContext(db, dto, blockers);
    await this.addDepartureBlockers(db, subject, dto.role, blockers);

    let currentManager: ManagedUser | null = null;
    if (
      !skipOfficeReplacement &&
      dto.role === UserRole.OFFICE &&
      dto.company_id
    ) {
      currentManager = (await db.user.findFirst({
        where: {
          role: UserRole.OFFICE,
          company_id: dto.company_id,
          id: { not: id },
        },
        select: this.userSelect(),
      })) as ManagedUser | null;

      if (currentManager && !dto.replacement) {
        this.add(blockers, 'OFFICE_REPLACEMENT_REQUIRED');
      } else if (!currentManager && dto.replacement) {
        this.add(blockers, 'OFFICE_REPLACEMENT_INVALID');
      } else if (currentManager && dto.replacement) {
        await this.validateOfficeReplacement(
          db,
          currentManager,
          dto.replacement,
          blockers,
        );
      }
    } else if (!skipOfficeReplacement && dto.replacement) {
      this.add(blockers, 'OFFICE_REPLACEMENT_INVALID');
    }

    return this.result(blockers);
  }

  private async analyzeSpecialityChange(
    db: UserManagementDatabase,
    id: string,
    dto: ChangeSpecialityDto,
  ): Promise<ChangeValidationResult> {
    const subject = await this.findUser(db, id);
    if (subject.role !== UserRole.SPECIALIST) {
      throw new BadRequestException(
        'A especialidade só pode ser alterada para usuários Especialistas.',
      );
    }

    const blockers: ChangeBlocker[] = [];
    if (subject.speciality === dto.speciality)
      this.add(blockers, 'SPECIALITY_UNCHANGED');
    await this.addSpecialistBlockers(
      db,
      subject.id,
      dto.speciality,
      blockers,
      true,
    );
    return this.result(blockers);
  }

  private async validateRoleContext(
    db: UserManagementDatabase,
    dto: ChangeRoleDto | OfficeManagerReplacementDto,
    blockers: ChangeBlocker[],
  ) {
    if (
      (dto.role === UserRole.CONSULTANT || dto.role === UserRole.OFFICE) &&
      !dto.company_id
    ) {
      this.add(blockers, 'COMPANY_REQUIRED');
    }
    if (dto.role === UserRole.SPECIALIST && !dto.speciality) {
      this.add(blockers, 'SPECIALITY_REQUIRED');
    }
    if (dto.company_id) {
      const company = await db.company.findUnique({
        where: { id: dto.company_id },
        select: { id: true },
      });
      if (!company) this.add(blockers, 'COMPANY_NOT_FOUND');
    }
  }

  private async addDepartureBlockers(
    db: UserManagementDatabase,
    subject: ManagedUser,
    targetRole: UserRole,
    blockers: ChangeBlocker[],
  ) {
    if (
      subject.role === UserRole.CUSTOMER &&
      targetRole !== UserRole.CUSTOMER
    ) {
      if (subject.consultant_id) this.add(blockers, 'CUSTOMER_HAS_CONSULTANT');
      const advisors = await db.customerAdvisor.count({
        where: { customer_id: subject.id },
      });
      if (advisors) this.add(blockers, 'CUSTOMER_HAS_ADVISOR', advisors);
    }

    if (
      subject.role === UserRole.CONSULTANT &&
      targetRole !== UserRole.CONSULTANT
    ) {
      const clients = await db.user.count({
        where: { consultant_id: subject.id },
      });
      if (clients) this.add(blockers, 'CONSULTANT_HAS_CLIENTS', clients);
      const advisees = await db.customerAdvisor.count({
        where: { advisor_id: subject.id },
      });
      if (advisees) this.add(blockers, 'CONSULTANT_HAS_ADVISEES', advisees);
    }

    if (
      subject.role === UserRole.SPECIALIST &&
      targetRole !== UserRole.SPECIALIST
    ) {
      await this.addSpecialistBlockers(
        db,
        subject.id,
        undefined,
        blockers,
        false,
      );
    }

    if (
      subject.role === UserRole.ADMIN &&
      subject.is_active &&
      targetRole !== UserRole.ADMIN
    ) {
      const activeAdmins = await db.user.count({
        where: { role: UserRole.ADMIN, is_active: true },
      });
      if (activeAdmins <= 1) this.add(blockers, 'LAST_ACTIVE_ADMIN');
    }
  }

  private async addSpecialistBlockers(
    db: UserManagementDatabase,
    specialistId: string,
    speciality: ProductType | undefined,
    blockers: ChangeBlocker[],
    changingSpeciality: boolean,
  ) {
    const [cars, boats, aircraft, appointments, processes] = await Promise.all([
      db.car.count({ where: { specialist_id: specialistId, is_active: true } }),
      db.boat.count({
        where: { specialist_id: specialistId, is_active: true },
      }),
      db.aircraft.count({
        where: { specialist_id: specialistId, is_active: true },
      }),
      db.appointment.count({
        where: { specialist_id: specialistId, status: 'PENDING' },
      }),
      db.process.count({
        where: {
          specialist_id: specialistId,
          status: { notIn: [ProcessStatus.COMPLETED, ProcessStatus.REJECTED] },
          ...(changingSpeciality && speciality
            ? { product_type: { not: speciality } }
            : {}),
        },
      }),
    ]);
    const products = cars + boats + aircraft;
    if (products)
      this.add(blockers, 'SPECIALIST_HAS_ACTIVE_PRODUCTS', products);
    if (appointments)
      this.add(blockers, 'SPECIALIST_HAS_PENDING_APPOINTMENTS', appointments);
    if (processes)
      this.add(blockers, 'SPECIALIST_HAS_OPEN_PROCESSES', processes);
  }

  private async validateOfficeReplacement(
    db: UserManagementDatabase,
    currentManager: ManagedUser,
    replacement: OfficeManagerReplacementDto,
    blockers: ChangeBlocker[],
  ) {
    if (replacement.role === UserRole.OFFICE) {
      this.add(blockers, 'OFFICE_REPLACEMENT_INVALID');
      return;
    }
    const result = await this.analyzeRoleChange(
      db,
      currentManager.id,
      replacement as ChangeRoleDto,
      true,
    );
    blockers.push(...result.blockers);
  }

  private async applyRoleChange(
    db: Prisma.TransactionClient,
    id: string,
    dto: ChangeRoleDto,
  ) {
    if (dto.role === UserRole.OFFICE && dto.company_id && dto.replacement) {
      const currentManager = await db.user.findFirst({
        where: {
          role: UserRole.OFFICE,
          company_id: dto.company_id,
          id: { not: id },
        },
        select: { id: true },
      });
      if (currentManager)
        await db.user.update({
          where: { id: currentManager.id },
          data: this.roleData(dto.replacement),
        });
    }
    return db.user.update({ where: { id }, data: this.roleData(dto) });
  }

  private roleData(dto: ChangeRoleDto | OfficeManagerReplacementDto) {
    return {
      role: dto.role,
      ...(dto.company_id !== undefined ? { company_id: dto.company_id } : {}),
      ...(dto.speciality !== undefined ? { speciality: dto.speciality } : {}),
    };
  }

  private async findUser(
    db: UserManagementDatabase,
    id: string,
  ): Promise<ManagedUser> {
    const subject = await db.user.findUnique({
      where: { id },
      select: this.userSelect(),
    });
    if (!subject) throw new NotFoundException('Usuário não encontrado.');
    return subject as ManagedUser;
  }

  private userSelect() {
    return {
      id: true,
      role: true,
      is_active: true,
      consultant_id: true,
      company_id: true,
      speciality: true,
    };
  }

  private add(
    blockers: ChangeBlocker[],
    code: ChangeBlockerCode,
    count?: number,
  ) {
    if (!blockers.some((blocker) => blocker.code === code)) {
      blockers.push({
        code,
        message: blockerMessage({ code, count }),
        ...(count !== undefined ? { count } : {}),
      });
    }
  }

  private result(
    blockers: ChangeBlocker[] | ChangeBlockerCode[],
  ): ChangeValidationResult {
    const normalized = blockers.map((blocker) =>
      typeof blocker === 'string'
        ? { code: blocker, message: blockerMessage({ code: blocker }) }
        : blocker,
    );
    return {
      allowed: normalized.length === 0,
      summary:
        normalized.length === 0
          ? 'Alteração permitida.'
          : 'A alteração não pode ser concluída.',
      blockers: normalized,
    };
  }

  private isOfficeConflict(error: unknown): boolean {
    const prismaError = error as { code?: string; meta?: { target?: unknown } };
    const target = Array.isArray(prismaError?.meta?.target)
      ? prismaError.meta.target.join(',')
      : String(prismaError?.meta?.target ?? '');
    return (
      prismaError?.code === 'P2002' &&
      (target.includes('one_office_per_company') ||
        target.includes('company_id'))
    );
  }
}
