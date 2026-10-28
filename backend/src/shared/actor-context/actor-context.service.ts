import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ProductType, UserRole } from '@prisma/client';
import { UserEntity } from 'src/auth/entities/user.entity';
import { PrismaService } from 'src/prisma/prisma.service';

export type ActorContext = {
  actorId: string;
  actorRole: UserRole;
  actor: { id: string; role: UserRole; name: string; surname: string };
  specialistId: string;
  specialist: {
    id: string;
    role: UserRole;
    is_active: boolean;
    speciality: ProductType | null;
    name: string;
    surname: string;
  };
  delegated: boolean;
};

@Injectable()
export class ActorContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    actor: Pick<UserEntity, 'id' | 'role' | 'is_active' | 'speciality' | 'name' | 'surname'>,
    targetSpecialistId?: string,
    requiredSpeciality?: ProductType,
  ): Promise<ActorContext> {
    if (actor.role === UserRole.SPECIALIST) {
      if (targetSpecialistId && targetSpecialistId !== actor.id) {
        throw new ForbiddenException(
          'Especialistas não podem operar em nome de outro especialista.',
        );
      }
      if (actor.is_active === false) {
        throw new ForbiddenException('Especialista inativo.');
      }
      if (requiredSpeciality && actor.speciality !== requiredSpeciality) {
        throw new ForbiddenException(
          'A especialidade do especialista não corresponde ao recurso.',
        );
      }
      return {
        actorId: actor.id,
        actorRole: actor.role,
        actor: {
          id: actor.id,
          role: actor.role,
          name: actor.name ?? '',
          surname: actor.surname ?? '',
        },
        specialistId: actor.id,
        specialist: {
          id: actor.id,
          role: actor.role,
          is_active: true,
          speciality: actor.speciality ?? null,
          name: actor.name ?? '',
          surname: actor.surname ?? '',
        },
        delegated: false,
      };
    }

    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Este papel não pode representar um especialista.',
      );
    }
    if (!targetSpecialistId) {
      throw new BadRequestException(
        'target_specialist_id é obrigatório para ações administrativas.',
      );
    }

    const specialist = await this.prisma.user.findUnique({
      where: { id: targetSpecialistId },
      select: {
        id: true,
        role: true,
        is_active: true,
        speciality: true,
        name: true,
        surname: true,
      },
    });
    if (!specialist || specialist.role !== UserRole.SPECIALIST) {
      throw new ForbiddenException(
        'O usuário representado deve ser um especialista existente.',
      );
    }
    if (!specialist.is_active) {
      throw new ForbiddenException('O especialista representado está inativo.');
    }
    if (
      requiredSpeciality &&
      specialist.speciality !== requiredSpeciality
    ) {
      throw new ForbiddenException(
        'A especialidade do especialista representado não corresponde ao recurso.',
      );
    }

    return {
      actorId: actor.id,
      actorRole: actor.role,
      actor: {
        id: actor.id,
        role: actor.role,
        name: actor.name ?? '',
        surname: actor.surname ?? '',
      },
      specialistId: specialist.id,
      specialist,
      delegated: true,
    };
  }

  assertResourceSpecialist(
    context: ActorContext,
    resourceSpecialistId: string | null | undefined,
  ): void {
    if (
      !resourceSpecialistId ||
      resourceSpecialistId !== context.specialistId
    ) {
      throw new ForbiddenException(
        'O recurso não pertence ao especialista representado.',
      );
    }
  }
}
