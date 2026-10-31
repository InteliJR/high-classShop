import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProcessStatus,
  ProductType,
  StatusAgendamento,
} from '@prisma/client';
import { UserEntity } from 'src/auth/entities/user.entity';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActorContextService } from 'src/shared/actor-context/actor-context.service';
import { DelegatedActionAuditService } from 'src/shared/actor-context/delegated-action-audit.service';
import {
  acquireProductMonetaryLock,
  PROCESS_FOREIGN_KEY_BY_TYPE,
  PRODUCT_DELEGATE_BY_TYPE,
} from './product-monetary-lock';

/**
 * Troca o especialista responsável por um produto.
 * Bloqueia se houver processo ou agendamento em andamento: esses registros
 * ficam com o especialista antigo e nunca são transferidos silenciosamente.
 * Processos concluídos/rejeitados mantêm o especialista original (histórico).
 */
export async function transferProductSpecialist(
  tx: Prisma.TransactionClient,
  input: {
    productType: ProductType;
    productId: string;
    toSpecialistId: string;
  },
): Promise<{ fromSpecialistId: string | null; toSpecialistId: string }> {
  // Mesmo lock usado ao vincular produto a processo/agendamento.
  await acquireProductMonetaryLock(tx, input);

  const delegate = (tx as any)[PRODUCT_DELEGATE_BY_TYPE[input.productType]];
  const product = await delegate.findUnique({
    where: { id: input.productId },
    select: { id: true, specialist_id: true },
  });
  if (!product) throw new NotFoundException('Produto não encontrado');
  if (product.specialist_id === input.toSpecialistId) {
    throw new BadRequestException(
      'O produto já pertence a este especialista.',
    );
  }

  const [openProcess, openAppointment] = await Promise.all([
    tx.process.findFirst({
      where: {
        [PROCESS_FOREIGN_KEY_BY_TYPE[input.productType]]: input.productId,
        status: { notIn: [ProcessStatus.COMPLETED, ProcessStatus.REJECTED] },
        removed_at: null,
      },
      select: { id: true },
    }),
    tx.appointment.findFirst({
      where: {
        product_type: input.productType,
        product_id: input.productId,
        status: {
          in: [StatusAgendamento.PENDING, StatusAgendamento.SCHEDULED],
        },
      },
      select: { id: true },
    }),
  ]);
  if (openProcess || openAppointment) {
    throw new ConflictException({
      code: 'PRODUCT_HAS_OPEN_PROCESSES',
      message:
        'Este produto tem processos ou agendamentos em andamento. Conclua ou rejeite-os antes de transferir.',
    });
  }

  await delegate.update({
    where: { id: input.productId },
    data: { specialist_id: input.toSpecialistId },
  });
  return {
    fromSpecialistId: product.specialist_id,
    toSpecialistId: input.toSpecialistId,
  };
}

/** Fluxo completo do endpoint PATCH /:resource/:id/specialist (somente ADMIN). */
export async function transferProductAsAdmin(
  deps: {
    prisma: PrismaService;
    actorContextService: ActorContextService;
    delegatedAudit: DelegatedActionAuditService;
  },
  user: UserEntity,
  productType: ProductType,
  productId: string,
  toSpecialistId: string,
) {
  // Valida destino: especialista existente, ativo e da especialidade certa.
  const context = await deps.actorContextService.resolve(
    user,
    toSpecialistId,
    productType,
  );
  return deps.prisma.$transaction(async (tx) => {
    const result = await transferProductSpecialist(tx, {
      productType,
      productId,
      toSpecialistId: context.specialistId,
    });
    await deps.delegatedAudit.record(
      {
        context,
        action: 'PRODUCT_TRANSFER',
        resourceType: productType,
        resourceId: productId,
        metadata: result,
      },
      tx,
    );
    return result;
  });
}
