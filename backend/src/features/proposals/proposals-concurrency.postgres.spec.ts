import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
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

function signalAdvisoryLockAttempt(
  client: PrismaClient,
  onAttempt: (queryArguments: any[]) => void,
): PrismaClient {
  const wrapTransaction = (transaction: any) =>
    new Proxy(transaction, {
      get(target, property) {
        if (property === '$queryRaw') {
          const queryRaw = bindMember(target, property);
          return (...args: any[]) => {
            onAttempt(args);
            return queryRaw(...args);
          };
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
      where: { process_id: processId },
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
      reason: expect.any(BadRequestException),
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

  it('commits only one concurrent accept/counterproposal response', async () => {
    await observer.process.update({
      where: { id: processId },
      data: {
        status: ProcessStatus.NEGOTIATION,
        accepted_proposal_id: null,
      },
    });
    await observer.processStatusHistory.deleteMany({ where: { processId } });
    await observer.negotiationProposal.deleteMany({
      where: { process_id: processId, id: { not: proposalId } },
    });
    await observer.negotiationProposal.update({
      where: { id: proposalId },
      data: { status: ProposalStatus.PENDING },
    });

    const waitForBothTransactions = validationBarrier(2);
    const lockKey = `proposal-process:${processId}`;

    const outcomes = await Promise.allSettled([
      rejectClient.$transaction(async (tx) => {
        await waitForBothTransactions();
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS locked
        `;
        const claim = await tx.negotiationProposal.updateMany({
          where: { id: proposalId, status: ProposalStatus.PENDING },
          data: { status: ProposalStatus.COUNTERED },
        });
        if (claim.count !== 1) throw new ConflictException();
        await tx.negotiationProposal.create({
          data: {
            process_id: processId,
            proposed_by_id: specialistId,
            proposed_to_id: clientId,
            proposed_value: 85000,
            counter_to_id: proposalId,
          },
        });
      }),
      acceptClient.$transaction(async (tx) => {
        await waitForBothTransactions();
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS locked
        `;
        const claim = await tx.negotiationProposal.updateMany({
          where: { id: proposalId, status: ProposalStatus.PENDING },
          data: { status: ProposalStatus.ACCEPTED },
        });
        if (claim.count !== 1) throw new ConflictException();
        await tx.process.update({
          where: { id: processId },
          data: {
            status: ProcessStatus.DOCUMENTATION,
            accepted_proposal_id: proposalId,
          },
        });
      }),
    ]);

    expect(
      outcomes.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(outcomes.find(({ status }) => status === 'rejected')).toMatchObject({
      reason: expect.any(ConflictException),
    });

    const original = await observer.negotiationProposal.findUniqueOrThrow({
      where: { id: proposalId },
    });
    const process = await observer.process.findUniqueOrThrow({
      where: { id: processId },
    });
    const counters = await observer.negotiationProposal.count({
      where: { process_id: processId, counter_to_id: proposalId },
    });

    if (original.status === ProposalStatus.ACCEPTED) {
      expect(process.status).toBe(ProcessStatus.DOCUMENTATION);
      expect(counters).toBe(0);
    } else {
      expect(original.status).toBe(ProposalStatus.COUNTERED);
      expect(process.status).toBe(ProcessStatus.NEGOTIATION);
      expect(counters).toBe(1);
    }
  }, 15000);

  it('does not create a proposal after concurrent acceptance moves the process to documentation', async () => {
    await observer.process.update({
      where: { id: processId },
      data: {
        status: ProcessStatus.NEGOTIATION,
        accepted_proposal_id: null,
      },
    });
    await observer.processStatusHistory.deleteMany({ where: { processId } });
    await observer.negotiationProposal.deleteMany({
      where: { process_id: processId, id: { not: proposalId } },
    });
    await observer.negotiationProposal.update({
      where: { id: proposalId },
      data: { status: ProposalStatus.PENDING },
    });

    const acceptanceLocked = validationBarrier(2);
    const releaseAcceptance = validationBarrier(2);
    const acceptance = acceptClient.$transaction(async (tx) => {
      const lockKey = `proposal-process:${processId}`;
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS locked
      `;
      await tx.negotiationProposal.update({
        where: { id: proposalId },
        data: { status: ProposalStatus.ACCEPTED },
      });
      await tx.process.update({
        where: { id: processId },
        data: {
          status: ProcessStatus.DOCUMENTATION,
          accepted_proposal_id: proposalId,
        },
      });
      await acceptanceLocked();
      await releaseAcceptance();
    });
    await acceptanceLocked();

    const settings = {
      isMinimumProposalEnabled: jest.fn().mockResolvedValue(false),
      getMinimumProposalPercentage: jest.fn(),
    } as any;
    const notifications = {
      sendProposalReceivedEmail: jest.fn().mockResolvedValue(undefined),
    } as any;
    let markCreationLockAttempted!: (queryArguments: any[]) => void;
    const creationLockAttempted = new Promise<any[]>((resolve) => {
      markCreationLockAttempted = resolve;
    });
    const signalingCreateClient = signalAdvisoryLockAttempt(
      rejectClient,
      markCreationLockAttempted,
    );
    const createService = new ProposalsService(
      signalingCreateClient as any,
      settings,
      notifications,
    );
    const creation = createService.create(
      { process_id: processId, proposed_value: 81000 },
      clientId,
    );

    let creationSettledBeforeLock: unknown;
    try {
      const queryArguments = await Promise.race([
        creationLockAttempted,
        creation.then(
          () => {
            throw new Error(
              'Proposal creation settled before attempting the process lock',
            );
          },
          (error) => {
            throw error;
          },
        ),
      ]);
      expect(queryArguments[1]).toBe(`proposal-process:${processId}`);
    } catch (error) {
      creationSettledBeforeLock = error;
    }
    await releaseAcceptance();
    await acceptance;
    if (creationSettledBeforeLock) throw creationSettledBeforeLock;

    await expect(creation).rejects.toMatchObject({
      response: {
        error: {
          message: 'Processo não está em fase de negociação',
        },
      },
    });
    await expect(
      observer.negotiationProposal.count({
        where: { process_id: processId, id: { not: proposalId } },
      }),
    ).resolves.toBe(0);
    await expect(
      observer.process.findUniqueOrThrow({ where: { id: processId } }),
    ).resolves.toMatchObject({
      status: ProcessStatus.DOCUMENTATION,
      accepted_proposal_id: proposalId,
    });
  }, 15_000);
});
