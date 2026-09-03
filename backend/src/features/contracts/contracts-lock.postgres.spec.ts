import { PrismaClient } from '@prisma/client';
import { ContractsService } from './contracts.service';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function withApplicationName(url: string, name: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}application_name=${encodeURIComponent(name)}`;
}

const databaseUrl = process.env.POSTGRES_CONCURRENCY_TEST_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres('contract process lock — PostgreSQL concurrency', () => {
  const first = new PrismaClient({
    datasources: { db: { url: withApplicationName(databaseUrl!, 'contract-lock-a') } },
  });
  const second = new PrismaClient({
    datasources: { db: { url: withApplicationName(databaseUrl!, 'contract-lock-b') } },
  });

  afterAll(async () => {
    await Promise.all([first.$disconnect(), second.$disconnect()]);
  });

  it('allows only one contract side effect at a time for a process', async () => {
    const acquired = deferred();
    const release = deferred();
    let secondEntered = false;
    const serviceA = new ContractsService(
      first as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const serviceB = new ContractsService(
      second as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const firstRun = (serviceA as any).withContractProcessLock(
      '11111111-1111-4111-8111-111111111111',
      async () => {
        acquired.resolve();
        await release.promise;
      },
    );
    await acquired.promise;

    const secondRun = (serviceB as any).withContractProcessLock(
      '11111111-1111-4111-8111-111111111111',
      async () => {
        secondEntered = true;
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(secondEntered).toBe(false);
    release.resolve();
    await Promise.all([firstRun, secondRun]);
    expect(secondEntered).toBe(true);
  });
});
