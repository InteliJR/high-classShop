# Seed de dados fake pra demo de comissão — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Estender `backend/prisma/seed.ts` pra criar processos/propostas/contratos ponta-a-ponta que exercitam o split de comissão aninhado — com e sem escritório — mais um funil de processos em vários status, pra popular a tela de visualização de comissão e o dashboard.

**Architecture:** O seed atual cria PlatformCompany + 3 empresas + 6 usuários + produtos, mas **nenhum** processo/contrato. Adicionamos um bloco no fim do seed que: (1) define `commission_rate` nos especialistas e o override da plataforma na empresa; (2) cria N processos com proposta aceita e contrato assinado cujos valores de split são computados pelo **mesmo modelo aninhado** (`computeNestedCommissionSplit` do Plano 1), garantindo que a viz mostre números coerentes; (3) cria processos de funil em status intermediários e um rejeitado.

**Tech Stack:** Prisma, ts-node (`npm run seed`), bcrypt (já instalado).

## Global Constraints

- Especialista = PJ: `cpf` guarda CNPJ (14 dígitos).
- `commission_rate` do especialista = **fatia % do bolo**; `Company.commission_rate` = **fatia % do restante**; `PlatformCompany.default_commission_rate` = fallback.
- Split sempre soma exatamente o bolo (usar o helper puro).
- Rodar migração/schema antes: `npx prisma db push` (DB de demo) → `npx prisma generate` → `npm run seed`.
- Não commitar sem o usuário pedir.

## Dependência

Task 1 do **Plano 1** (`commission-split.ts` com `computeNestedCommissionSplit`) precisa existir — o seed importa esse helper pra computar os valores do contrato. Se o Plano 1 ainda não rodou, faça a Task 1 dele primeiro (é só a função pura + teste).

---

### Task 1: Habilitar login dos usuários de mock

**Files:**
- Modify: `backend/prisma/seed.ts` (bloco de criação de usuários)

**Interfaces:**
- Consumes: `bcrypt` (dependência existente).

- [ ] **Step 1: Hashear a senha demo no seed**

O seed hoje usa `password_hash = process.env.MOCK_PASSWORD_HASH || ''` (sem hash → login bloqueado). No topo de `seed.ts` adicionar:

```ts
import * as bcrypt from 'bcrypt';

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'demo1234';
const demoHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
```

E, onde os `mockUsers` são criados, sobrescrever o hash:

```ts
password_hash: demoHash,
```

(Todos os usuários de demo passam a logar com a mesma senha `demo1234`.)

- [ ] **Step 2: Rodar o seed e conferir que não quebra**

Run: `cd backend && npm run seed`
Expected: termina sem erro; usuários criados com hash bcrypt.

---

### Task 2: Configurar as fatias de comissão nos cadastros

**Files:**
- Modify: `backend/prisma/seed.ts` (após criação de empresas/usuários)

- [ ] **Step 1: Setar as fatias**

Depois que empresas e usuários existem, adicionar:

```ts
// Fatias de comissão (modelo aninhado)
// Especialista com escritório: Carlos (CAR) na empresa Genius
await prisma.user.update({
  where: { email: 'carlos.car@example.com' },
  data: { commission_rate: 70 }, // 70% do bolo
});
// Especialistas sem escritório
await prisma.user.update({
  where: { email: 'marina.boat@example.com' },
  data: { commission_rate: 65, company_id: null },
});
await prisma.user.update({
  where: { email: 'pedro.aircraft@example.com' },
  data: { commission_rate: 60, company_id: null },
});
// Escritório Genius: fica com 40% do RESTANTE; plataforma leva os 60% restantes
const genius = await prisma.company.findFirstOrThrow({
  where: { name: { contains: 'Genius' } },
});
await prisma.company.update({
  where: { id: genius.id },
  data: { commission_rate: 40 },
});
```

> Ajuste os emails/nome da empresa aos mocks reais (`src/mocks/user.mock.ts`) se diferirem.

- [ ] **Step 2: Rodar o seed**

Run: `cd backend && npm run seed`
Expected: sem erro.

---

### Task 3: Helper de criação de venda completa (processo → proposta → contrato)

**Files:**
- Modify: `backend/prisma/seed.ts`

**Interfaces:**
- Consumes: `computeNestedCommissionSplit` de `../src/features/contracts/commission-split` (Plano 1).
- Produces: função local `seedCompletedSale(...)` usada na Task 4.

- [ ] **Step 1: Importar o helper e a função de venda**

No topo:

```ts
import { computeNestedCommissionSplit } from '../src/features/contracts/commission-split';
```

Adicionar a função (antes do `main().then(...)`):

```ts
async function seedCompletedSale(params: {
  client: { id: string };
  specialist: { id: string; name: string; cpf: string | null; commission_rate: number };
  company: { name: string; cnpj: string; commission_rate: number } | null;
  platformDefaultRate: number;
  productType: 'CAR' | 'BOAT' | 'AIRCRAFT';
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

  const productFk =
    params.productType === 'CAR'
      ? { car_id: params.productId }
      : params.productType === 'BOAT'
        ? { boat_id: params.productId }
        : { aircraft_id: params.productId };

  const process = await prisma.process.create({
    data: {
      client_id: params.client.id,
      specialist_id: params.specialist.id,
      product_type: params.productType,
      status: 'COMPLETED',
      ...productFk,
    },
  });

  const proposal = await prisma.negotiationProposal.create({
    data: {
      process_id: process.id,
      proposed_by_id: params.client.id,
      proposed_to_id: params.specialist.id,
      proposed_value: params.saleValue,
      status: 'ACCEPTED',
    },
  });
  await prisma.process.update({
    where: { id: process.id },
    data: { accepted_proposal_id: proposal.id },
  });

  const effRate = (v: number) => Math.round((v / params.saleValue) * 100 * 100) / 100;
  const contract = await prisma.contract.create({
    data: {
      process_id: process.id,
      uploaded_by_id: params.specialist.id,
      uploaded_by_type: 'SPECIALIST',
      status: 'SIGNED',
      signed_at: new Date('2026-07-01T12:00:00Z'),
      vehicle_price: params.saleValue,
      platform_value: split.platformValue,
      platform_percentage: effRate(split.platformValue),
      platform_name: 'High-Class Platform',
      office_value: params.company ? split.officeValue : null,
      office_name: params.company?.name ?? null,
      office_cnpj: params.company?.cnpj ?? null,
      specialist_commission_value: split.specialistValue,
      specialist_commission_rate: effRate(split.specialistValue),
      specialist_name: params.specialist.name,
      specialist_document: params.specialist.cpf,
    },
  });
  await prisma.process.update({
    where: { id: process.id },
    data: { active_contract_id: contract.id },
  });

  return { process, contract, split };
}
```

> `signed_at` usa data fixa de propósito — o seed não pode depender de `new Date()` variável pra ser reproduzível.

- [ ] **Step 2: Compilar**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: sem erros de tipo no seed (ajustar nomes de status/enum se o schema divergir).

---

### Task 4: Criar as vendas de demo + funil

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Buscar atores e produtos e criar as vendas**

No `main()`, após as Tasks 2/3:

```ts
const platform = await prisma.platformCompany.findFirstOrThrow();
const joao = await prisma.user.findFirstOrThrow({ where: { email: 'joao.cliente@example.com' } });
const carlos = await prisma.user.findFirstOrThrow({ where: { email: 'carlos.car@example.com' } });
const marina = await prisma.user.findFirstOrThrow({ where: { email: 'marina.boat@example.com' } });
const geniusCo = await prisma.company.findFirstOrThrow({ where: { name: { contains: 'Genius' } } });
const car = await prisma.car.findFirstOrThrow({ where: { specialist_id: carlos.id } });
const boat = await prisma.boat.findFirstOrThrow({ where: { specialist_id: marina.id } });

// Venda COM escritório
await seedCompletedSale({
  client: joao,
  specialist: { id: carlos.id, name: `${carlos.name} ${carlos.surname}`, cpf: carlos.cpf, commission_rate: 70 },
  company: { name: geniusCo.name, cnpj: geniusCo.cnpj, commission_rate: 40 },
  platformDefaultRate: Number(platform.default_commission_rate),
  productType: 'CAR',
  productId: car.id,
  saleValue: 100_000,
  totalCommissionRate: 10,
});

// Venda SEM escritório
await seedCompletedSale({
  client: joao,
  specialist: { id: marina.id, name: `${marina.name} ${marina.surname}`, cpf: marina.cpf, commission_rate: 65 },
  company: null,
  platformDefaultRate: Number(platform.default_commission_rate),
  productType: 'BOAT',
  productId: boat.id,
  saleValue: 250_000,
  totalCommissionRate: 8,
});

// Funil: processos em status intermediários (sem contrato)
for (const status of ['SCHEDULING', 'NEGOTIATION', 'PROCESSING_CONTRACT', 'DOCUMENTATION'] as const) {
  await prisma.process.create({
    data: { client_id: joao.id, specialist_id: carlos.id, product_type: 'CAR', car_id: car.id, status },
  });
}
```

- [ ] **Step 2: Rodar o seed completo**

Run: `cd backend && npm run seed`
Expected: sem erro; 2 processos COMPLETED com contrato + 4 de funil criados.

- [ ] **Step 3: Self-check dos valores no banco**

Run (Prisma Studio ou query rápida):
```bash
cd backend && npx prisma studio
```
Conferir no Contract da venda de R$100.000: `specialist_commission_value = 7000`, `office_value = 1200`, `platform_value = 1800` (soma = 10.000). Na venda sem escritório (R$250.000, total 8% → bolo 20.000, especialista 65% = 13.000): `office_value = null`, `platform_value = 7000`, `specialist_commission_value = 13000`.

- [ ] **Step 4: Commit** (só se autorizado)

```bash
git add backend/prisma/seed.ts
git commit -m "chore(seed): vendas de demo com split de comissão aninhado"
```

## Notas

- **Idempotência:** o seed atual só faz `deleteMany` de imagens/produtos/usuários/empresas. Pra re-rodar sem erro de FK, adicionar no início do bloco de limpeza (antes de deletar usuários): anular `active_contract_id`/`accepted_proposal_id` dos processos, depois `contract.deleteMany`, `negotiationProposal.deleteMany`, `process.deleteMany`, `appointment.deleteMany`, `customerAdvisor.deleteMany`. Sem isso a 2ª execução falha.
- **S3:** o seed sobe imagens dos produtos pro S3; sem `AWS_*` válidos ele só avisa e segue — os produtos são criados mesmo assim, o que basta pra demo de comissão.
