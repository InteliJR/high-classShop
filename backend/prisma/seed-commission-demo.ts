/**
 * Seed ADITIVO e IDEMPOTENTE de dados de demonstração de comissão.
 *
 * NÃO apaga nada (nenhum deleteMany). Só cria/atualiza entidades claramente
 * rotuladas como DEMO, pra popular a visualização de comissão por venda com os
 * dois cenários: venda COM escritório e venda SEM escritório.
 *
 * Rodar:
 *   npx ts-node prisma/seed-commission-demo.ts
 * (usa DATABASE_URL do ambiente/.env)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { computeNestedCommissionSplit } from '../src/features/contracts/commission-split';

// Usa a conexão direta (porta 5432) em vez do pgbouncer — mais confiável para
// transações interativas ($transaction). Cai no DATABASE_URL se DIRECT_URL não existir.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

const DEMO_PASSWORD = 'demo1234';
const CLIENT_EMAIL = 'demo.cliente@highclass.demo';
const CARLOS_EMAIL = 'demo.carlos@highclass.demo'; // especialista COM escritório
const MARINA_EMAIL = 'demo.marina@highclass.demo'; // especialista SEM escritório
const COMPANY_CNPJ = '99900000000010';

async function upsertUser(data: {
  email: string;
  name: string;
  surname: string;
  rg: string;
  cpf: string;
  role: 'CUSTOMER' | 'SPECIALIST';
  commission_rate?: number;
  company_id?: string | null;
  passwordHash: string;
}) {
  return prisma.user.upsert({
    where: { email: data.email },
    update: {
      commission_rate: data.commission_rate ?? null,
      company_id: data.company_id ?? null,
    },
    create: {
      email: data.email,
      name: data.name,
      surname: data.surname,
      rg: data.rg,
      cpf: data.cpf,
      role: data.role,
      password_hash: data.passwordHash,
      commission_rate: data.commission_rate ?? null,
      company_id: data.company_id ?? null,
    },
  });
}

async function findOrCreateProduct(
  kind: 'car' | 'boat',
  specialistId: string,
  data: { marca: string; modelo: string; valor: number; estado: string; ano: number },
) {
  const model = kind === 'car' ? prisma.car : prisma.boat;
  const existing = await (model as any).findFirst({
    where: { specialist_id: specialistId, modelo: data.modelo },
  });
  if (existing) return existing;
  return (model as any).create({
    data: { ...data, specialist_id: specialistId },
  });
}

async function createSale(params: {
  client: { id: string };
  specialist: { id: string; name: string; cpf: string; commission_rate: number };
  company: { name: string; cnpj: string; commission_rate: number } | null;
  productType: 'CAR' | 'BOAT';
  productId: number;
  saleValue: number;
  totalCommissionRate: number;
}) {
  const officeShareRate = params.company ? params.company.commission_rate : 0;
  const split = computeNestedCommissionSplit({
    proposalValue: params.saleValue,
    totalCommissionRate: params.totalCommissionRate,
    specialistShareRate: params.specialist.commission_rate,
    officeShareRate,
  });
  const effRate = (v: number) =>
    Math.round((v / params.saleValue) * 100 * 100) / 100;

  const productFk =
    params.productType === 'CAR'
      ? { car_id: params.productId }
      : { boat_id: params.productId };

  await prisma.$transaction(async (tx) => {
    const process = await tx.process.create({
      data: {
        client_id: params.client.id,
        specialist_id: params.specialist.id,
        product_type: params.productType,
        status: 'COMPLETED',
        ...productFk,
      },
    });
    const proposal = await tx.negotiationProposal.create({
      data: {
        process_id: process.id,
        proposed_by_id: params.client.id,
        proposed_to_id: params.specialist.id,
        proposed_value: params.saleValue,
        status: 'ACCEPTED',
      },
    });
    const contract = await tx.contract.create({
      data: {
        process_id: process.id,
        uploaded_by_id: params.specialist.id,
        uploaded_by_type: 'SPECIALIST',
        status: 'SIGNED',
        signed_at: new Date('2026-07-01T12:00:00Z'),
        vehicle_price: params.saleValue,
        platform_value: split.platformValue,
        platform_percentage: effRate(split.platformValue),
        platform_name: 'High-Class Platform (DEMO)',
        office_value: params.company ? split.officeValue : null,
        office_name: params.company?.name ?? null,
        office_cnpj: params.company?.cnpj ?? null,
        specialist_commission_value: split.specialistValue,
        specialist_commission_rate: effRate(split.specialistValue),
        specialist_name: params.specialist.name,
        specialist_document: params.specialist.cpf,
      },
    });
    await tx.process.update({
      where: { id: process.id },
      data: { accepted_proposal_id: proposal.id, active_contract_id: contract.id },
    });
  });

  return split;
}

async function main() {
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  // Escritório DEMO (fica com 40% do restante)
  const company = await prisma.company.upsert({
    where: { cnpj: COMPANY_CNPJ },
    update: { commission_rate: 40 },
    create: { name: 'DEMO — Escritório Genius', cnpj: COMPANY_CNPJ, commission_rate: 40 },
  });

  const client = await upsertUser({
    email: CLIENT_EMAIL, name: 'Demo', surname: 'Cliente',
    rg: 'DEMOCLI001', cpf: '99988877701', role: 'CUSTOMER', passwordHash,
  });
  const carlos = await upsertUser({
    email: CARLOS_EMAIL, name: 'Demo', surname: 'Carlos (c/ escritório)',
    rg: 'DEMOSPE001', cpf: '99900000000101', role: 'SPECIALIST',
    commission_rate: 70, company_id: company.id, passwordHash,
  });
  const marina = await upsertUser({
    email: MARINA_EMAIL, name: 'Demo', surname: 'Marina (s/ escritório)',
    rg: 'DEMOSPE002', cpf: '99900000000202', role: 'SPECIALIST',
    commission_rate: 65, company_id: null, passwordHash,
  });

  const car = await findOrCreateProduct('car', carlos.id, {
    marca: 'DEMO Ferrari', modelo: 'DEMO 488 GTB', valor: 100_000, estado: 'SP', ano: 2022,
  });
  const boat = await findOrCreateProduct('boat', marina.id, {
    marca: 'DEMO Azimut', modelo: 'DEMO Grande 60', valor: 250_000, estado: 'SP', ano: 2021,
  });

  // Idempotência: se o cliente demo já tem processo, não recria vendas.
  const already = await prisma.process.findFirst({
    where: { client_id: client.id },
  });
  if (already) {
    console.log('Dados de demo já existem — nada a criar. (idempotente)');
    return;
  }

  const s1 = await createSale({
    client, specialist: { id: carlos.id, name: `${carlos.name} ${carlos.surname}`, cpf: carlos.cpf!, commission_rate: 70 },
    company: { name: company.name, cnpj: company.cnpj, commission_rate: 40 },
    productType: 'CAR', productId: car.id, saleValue: 100_000, totalCommissionRate: 10,
  });
  const s2 = await createSale({
    client, specialist: { id: marina.id, name: `${marina.name} ${marina.surname}`, cpf: marina.cpf!, commission_rate: 65 },
    company: null,
    productType: 'BOAT', productId: boat.id, saleValue: 250_000, totalCommissionRate: 8,
  });

  // Funil: processos em status intermediários (sem contrato)
  for (const status of ['SCHEDULING', 'NEGOTIATION', 'PROCESSING_CONTRACT', 'DOCUMENTATION'] as const) {
    await prisma.process.create({
      data: { client_id: client.id, specialist_id: carlos.id, product_type: 'CAR', car_id: car.id, status },
    });
  }

  console.log('Vendas DEMO criadas:');
  console.log('  COM escritório  →', s1);
  console.log('  SEM escritório  →', s2);
  console.log('Login demo:', CLIENT_EMAIL, '/', CARLOS_EMAIL, '/', MARINA_EMAIL, '(senha:', DEMO_PASSWORD + ')');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
