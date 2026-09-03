import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import {
  PrismaClient,
  ProcessStatus,
  ProductCurrency,
  ProductType,
  ProposalStatus,
  UserRole,
} from '@prisma/client';
import { ProposalsService } from './proposals.service';

function bindMember(target: any, property: PropertyKey): any {
  const value = Reflect.get(target, property);
  return typeof value === 'function' ? value.bind(target) : value;
}

function validationBarrier(participants: number) {
  let arrivals = 0;
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  return async () => {
    arrivals += 1;
    if (arrivals === participants) release();
    await released;
  };
}

function synchronizeProposalValidation(
  client: PrismaClient,
  waitForParticipants: () => Promise<void>,
) {
  const wrapNegotiationProposal = (delegate: any) =>
    new Proxy(delegate, {
      get(target, property) {
        if (property === 'findUnique') {
          return async (args: any) => {
            const proposal = await target.findUnique(args);
            await waitForParticipants();
            return proposal;
          };
        }
        return bindMember(target, property);
      },
    });

  const wrapTransaction = (transaction: any) =>
    new Proxy(transaction, {
      get(target, property) {
        if (property === 'negotiationProposal') {
          return wrapNegotiationProposal(target.negotiationProposal);
        }
        return bindMember(target, property);
      },
    });

  return new Proxy(client, {
    get(target, property) {
      if (property === '$transaction') {
        return (
          callback: (transaction: any) => Promise<unknown>,
          options?: any,
        ) =>
          target.$transaction(
            (transaction) => callback(wrapTransaction(transaction)),
            options,
          );
      }
      return bindMember(target, property);
    },
  });
}

const databaseUrl = process.env.POSTGRES_CONCURRENCY_TEST_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres('proposal responses — PostgreSQL concurrency', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const acceptClient = new PrismaClient({
    datasources: { db: { url: databaseUrl! } },
  });
  const rejectClient = new PrismaClient({
    datasources: { db: { url: databaseUrl! } },
  });
  const observer = new PrismaClient({
    datasources: { db: { url: databaseUrl! } },
  });
  const clientId = randomUUID();
  const specialistId = randomUUID();
  const carId = randomUUID();
  const processId = randomUUID();
  const proposalId = randomUUID();

  beforeAll(async () => {
    await observer.user.createMany({
      data: [
        {
          id: clientId,
          name: 'Proposal',
          surname: 'Client',
          email: `proposal-client-${suffix}@example.test`,
          rg: suffix.slice(0, 11),
          role: UserRole.CUSTOMER,
          password_hash: 'not-used',
        },
        {
          id: specialistId,
          name: 'Proposal',
          surname: 'Specialist',
          email: `proposal-specialist-${suffix}@example.test`,
          rg: suffix.slice(11, 22),
          role: UserRole.SPECIALIST,
          speciality: ProductType.CAR,
          password_hash: 'not-used',
        },
      ],
    });
    await observer.car.create({
      data: {
        id: carId,
        specialist_id: specialistId,
        marca: 'Concurrent',
        modelo: 'Proposal',
        identificador: `proposal-${suffix}`,
        valor: 100000,
        currency: ProductCurrency.USD,
        estado: 'SP',
        ano: 2026,
      },
    });
    await observer.process.create({
      data: {
        id: processId,
        client_id: clientId,
        specialist_id: specialistId,
        product_type: ProductType.CAR,
        car_id: carId,
        status: ProcessStatus.NEGOTIATION,
        negotiation_currency: ProductCurrency.USD,
        negotiation_product_value: 100000,
      },
    });
    await observer.negotiationProposal.create({
      data: {
        id: proposalId,
        process_id: processId,
        proposed_by_id: clientId,
        proposed_to_id: specialistId,
        proposed_value: 80000,
      },
    });
  });

  afterAll(async () => {
    await observer.process.updateMany({
      where: { id: processId },
      data: { accepted_proposal_id: null },
    });
    await observer.processStatusHistory.deleteMany({ where: { processId } });
    await observer.negotiationProposal.deleteMany({
      where: { id: proposalId },
    });
    await observer.process.deleteMany({ where: { id: processId } });
    await observer.car.deleteMany({ where: { id: carId } });
    await observer.user.deleteMany({
      where: { id: { in: [clientId, specialistId] } },
    });
    await Promise.all([
      acceptClient.$disconnect(),
      rejectClient.$disconnect(),
      observer.$disconnect(),
    ]);
  });

  it('commits only one concurrent accept/reject and keeps process and proposal consistent', async () => {
    const waitForBothReads = validationBarrier(2);
    const notifications = {
      sendProposalAcceptedEmail: jest.fn().mockResolvedValue(undefined),
      sendProposalRejectedEmail: jest.fn().mockResolvedValue(undefined),
      sendProcessStatusChangedEmail: jest.fn().mockResolvedValue(undefined),
    } as any;
    const acceptService = new ProposalsService(
      synchronizeProposalValidation(acceptClient, waitForBothReads) as any,
      {} as any,
      notifications,
    );
    const rejectService = new ProposalsService(
      synchronizeProposalValidation(rejectClient, waitForBothReads) as any,
      {} as any,
      notifications,
    );

    const outcomes = await Promise.allSettled([
      acceptService.accept(proposalId, specialistId),
      rejectService.reject(proposalId, specialistId),
    ]);

    expect(
      outcomes.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = outcomes.find(({ status }) => status === 'rejected');
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: expect.any(ConflictException),
    });

    const [proposal, process, historyCount] = await Promise.all([
      observer.negotiationProposal.findUniqueOrThrow({
        where: { id: proposalId },
      }),
      observer.process.findUniqueOrThrow({ where: { id: processId } }),
      observer.processStatusHistory.count({ where: { processId } }),
    ]);

    if (proposal.status === ProposalStatus.ACCEPTED) {
      expect(process.status).toBe(ProcessStatus.DOCUMENTATION);
      expect(process.accepted_proposal_id).toBe(proposalId);
      expect(historyCount).toBe(1);
    } else {
      expect(proposal.status).toBe(ProposalStatus.REJECTED);
      expect(process.status).toBe(ProcessStatus.NEGOTIATION);
      expect(process.accepted_proposal_id).toBeNull();
      expect(historyCount).toBe(0);
    }
  }, 15000);
});
