import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActorContext } from './actor-context.service';

export type DelegatedActionAuditInput = {
  context: ActorContext;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
};

export type DelegatedProposalExecutor = {
  proposalId: string;
  actor: { id: string; role: UserRole; name: string | null };
};

@Injectable()
export class DelegatedActionAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: DelegatedActionAuditInput,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const metadata = JSON.stringify(input.metadata ?? {});
    await client.$executeRaw`
      INSERT INTO "DelegatedActionAudit" (
        "id", "actor_id", "actor_role", "represented_specialist_id",
        "action", "resource_type", "resource_id", "metadata", "created_at"
      ) VALUES (
        ${randomUUID()}::uuid,
        ${input.context.actorId}::uuid,
        ${input.context.actorRole}::"UserRole",
        ${input.context.specialistId}::uuid,
        ${input.action},
        ${input.resourceType},
        ${input.resourceId},
        ${metadata}::jsonb,
        NOW()
      )
    `;
  }

  async listProposalCreators(
    processId: string,
    specialistId: string,
  ): Promise<DelegatedProposalExecutor[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        resource_id: string;
        actor_id: string;
        actor_role: UserRole;
        actor_name: string | null;
      }>
    >`
      SELECT audit."resource_id", audit."actor_id", audit."actor_role",
        CONCAT_WS(' ', actor."name", actor."surname") AS "actor_name"
      FROM "DelegatedActionAudit" audit
      LEFT JOIN "User" actor ON actor."id" = audit."actor_id"
      WHERE audit."represented_specialist_id" = ${specialistId}::uuid
        AND audit."resource_type" = 'PROPOSAL'
        AND audit."action" IN ('PROPOSAL_CREATE', 'PROPOSAL_COUNTER')
        AND audit."metadata"->>'processId' = ${processId}
      ORDER BY audit."created_at" DESC
    `;
    return rows.map((row) => ({
      proposalId: row.resource_id,
      actor: {
        id: row.actor_id,
        role: row.actor_role,
        name: row.actor_name,
      },
    }));
  }

  async listForProcess(
    context: ActorContext,
    processId: string,
    limit = 50,
  ): Promise<
    Array<{
      id: string;
      action: string;
      resourceType: string;
      resourceId: string;
      metadata: Record<string, unknown> | null;
      createdAt: Date;
      actor: { id: string; role: UserRole; name: string | null };
      representedSpecialistId: string;
    }>
  > {
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        actor_id: string;
        actor_role: UserRole;
        actor_name: string | null;
        represented_specialist_id: string;
        action: string;
        resource_type: string;
        resource_id: string;
        metadata: Record<string, unknown> | null;
        created_at: Date;
      }>
    >`
      SELECT audit."id", audit."actor_id", audit."actor_role",
        CONCAT_WS(' ', actor."name", actor."surname") AS "actor_name",
        audit."represented_specialist_id", audit."action",
        audit."resource_type", audit."resource_id", audit."metadata",
        audit."created_at"
      FROM "DelegatedActionAudit" audit
      LEFT JOIN "User" actor ON actor."id" = audit."actor_id"
      WHERE audit."represented_specialist_id" = ${context.specialistId}::uuid
        AND (
          (audit."resource_type" = 'PROCESS' AND audit."resource_id" = ${processId})
          OR audit."metadata"->>'processId' = ${processId}
        )
      ORDER BY audit."created_at" DESC
      LIMIT ${boundedLimit}
    `;
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      metadata: row.metadata,
      createdAt: row.created_at,
      actor: {
        id: row.actor_id,
        role: row.actor_role,
        name: row.actor_name,
      },
      representedSpecialistId: row.represented_specialist_id,
    }));
  }
}
