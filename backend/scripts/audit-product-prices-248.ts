/**
 * Read-only audit for issue #248. Run from backend:
 *   npx ts-node scripts/audit-product-prices-248.ts --limit=2000
 * Add --include-records to include every inspected id/type/value/currency.
 *
 * Loads backend/.env without replacing existing environment variables. Uses
 * AUDIT_DATABASE_URL, DIRECT_URL, then DATABASE_URL. Never prints credentials.
 * High prices alone do not establish that a stored price is wrong.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

type PriceRow = {
  product_type: 'CAR' | 'BOAT' | 'AIRCRAFT';
  id: string;
  valor: string;
  currency: string;
};

function findingsFor(row: PriceRow): string[] {
  const findings: string[] = [];
  const decimal = new Prisma.Decimal(row.valor);
  if (!decimal.isFinite()) return ['non_finite_stored_value'];
  if (decimal.lessThanOrEqualTo(0)) findings.push('non_positive_stored_value');
  if (decimal.decimalPlaces() > 2)
    findings.push('more_than_two_decimal_places');
  if (!['BRL', 'USD'].includes(row.currency))
    findings.push('unsupported_currency');

  const numeric = decimal.toNumber();
  if (
    !Number.isFinite(numeric) ||
    !new Prisma.Decimal(numeric).equals(decimal)
  ) {
    findings.push('number_conversion_loses_precision');
  }

  // Reproduce Decimal's actual JSON string, including removal of trailing zeros.
  const apiString = decimal.toJSON();
  const legacyDetailValue = Number(
    apiString.replace(/\./g, '').replace(/,/g, '.'),
  );
  if (!Number.isFinite(legacyDetailValue) || legacyDetailValue !== numeric) {
    findings.push('legacy_detail_display_mismatch');
  }
  return findings;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(
      'Usage: ts-node scripts/audit-product-prices-248.ts [--limit=2000] [--include-records]',
    );
    return;
  }
  if (
    args.some(
      (arg) => arg !== '--include-records' && !/^--limit=\d+$/.test(arg),
    )
  ) {
    throw new Error('INVALID_ARGUMENTS');
  }
  const limit = Number(
    args.find((arg) => arg.startsWith('--limit='))?.slice(8) ?? 2000,
  );
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10000) {
    throw new Error('INVALID_LIMIT');
  }

  const envPath = resolve(__dirname, '../.env');
  if (existsSync(envPath)) loadEnvFile(envPath);
  const source = ['AUDIT_DATABASE_URL', 'DIRECT_URL', 'DATABASE_URL'].find(
    (key) => process.env[key]?.trim(),
  );
  if (!source) throw new Error('MISSING_DATABASE_CONFIGURATION');
  const databaseUrl = new URL(process.env[source]!);
  if (!['postgresql:', 'postgres:'].includes(databaseUrl.protocol)) {
    throw new Error('EXPECTED_POSTGRESQL');
  }
  databaseUrl.searchParams.set('connection_limit', '1');
  databaseUrl.searchParams.set('connect_timeout', '5');
  databaseUrl.searchParams.set('pool_timeout', '5');
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl.toString() } },
    log: [],
  });

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await tx.$executeRaw`SET LOCAL statement_timeout = '10s'`;
        await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`;
        const [mode] = await tx.$queryRaw<{ read_only: string }[]>`
        SELECT current_setting('transaction_read_only') AS read_only
      `;
        if (mode?.read_only !== 'on') throw new Error('READ_ONLY_NOT_ENFORCED');
        const rows = await tx.$queryRaw<PriceRow[]>`
        SELECT product_type, id, valor, currency
        FROM (
          SELECT 'CAR' AS product_type, id::text, valor::text, currency::text FROM "Car"
          UNION ALL
          SELECT 'BOAT', id::text, valor::text, currency::text FROM "Boat"
          UNION ALL
          SELECT 'AIRCRAFT', id::text, valor::text, currency::text FROM "Aircraft"
        ) AS prices
        ORDER BY product_type, id
        LIMIT ${limit + 1}
      `;
        return { rows: rows.slice(0, limit), truncated: rows.length > limit };
      },
      { maxWait: 5000, timeout: 15000, isolationLevel: 'RepeatableRead' },
    );

    const groups: Record<string, number> = {};
    const findingCounts: Record<string, number> = {};
    const findings = result.rows.flatMap((row) => {
      const group = `${row.product_type}/${row.currency}`;
      groups[group] = (groups[group] ?? 0) + 1;
      const reasons = findingsFor(row);
      reasons.forEach((reason) => {
        findingCounts[reason] = (findingCounts[reason] ?? 0) + 1;
      });
      return reasons.length ? [{ ...row, findings: reasons }] : [];
    });
    console.log(
      JSON.stringify(
        {
          issue: 248,
          audited_at: new Date().toISOString(),
          connection_source: source,
          transaction_read_only: true,
          inspected: result.rows.length,
          limit,
          truncated: result.truncated,
          groups,
          finding_counts: findingCounts,
          note: 'Display mismatches do not prove stored corruption. Confirm intended prices separately before any data repair.',
          findings,
          ...(args.includes('--include-records')
            ? { records: result.rows }
            : {}),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Database errors may contain connection details; deliberately omit messages.
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : error instanceof Error && /^[A-Z_]+$/.test(error.message)
        ? error.message
        : 'AUDIT_FAILED';
  console.error(JSON.stringify({ error: code, credentials_omitted: true }));
  process.exitCode = 1;
});
