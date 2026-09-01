# Integridade monetária BRL/USD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Congelar valor e moeda no início da negociação e propagar BRL ou USD, sem conversão, por propostas, notificações e preenchimento do contrato.

**Architecture:** `Process` passa a ser a fonte monetária imutável por meio de um snapshot criado atomicamente na entrada em `NEGOTIATION`. Serviços de produto impedem mudanças monetárias enquanto houver negociação ativa, e propostas/contrato/notificações consomem exclusivamente o snapshot. O frontend recebe moeda e estado dinâmico do mínimo pela API e usa uma única utilidade `pt-BR` para símbolos e valores.

**Tech Stack:** PostgreSQL, Prisma 6.16, NestJS 11, Jest 30, React 19, TypeScript 5.8, Vite 7 e Vitest 4.

## Global Constraints

- Não converter valores entre BRL e USD nem consultar câmbio.
- Formatar com locale `pt-BR`: `R$ 120.000,00` e `US$ 120.000,00`.
- Não adicionar “Produto BRL” ou “Produto USD” a nomes, títulos, marcas, modelos ou identificadores.
- Não alterar template, preview documental nem arquivo final do contrato nesta entrega.
- Não corrigir a migration antiga que adiciona o papel `OFFICE` nesta entrega.
- Não redesenhar a tabela responsiva de gestão de produtos nesta entrega.
- Não usar fallback silencioso para BRL no fluxo de negociação ou contrato.
- Consultar `minimum_proposal_enabled` em cada leitura e envio de proposta.
- Manter `NegotiationProposal.proposed_value` sem coluna de moeda; a moeda vem de `Process.negotiation_currency`.
- Preservar o arquivo local não versionado `PROJECT-OVERVIEW.md`.
- Prefixar comandos de shell com `rtk`.
- Limitar Jest a `--maxWorkers=2` ou `--runInBand` e Vitest a `--maxWorkers=2`.

---

## File map

- `backend/prisma/schema.prisma`: declara os dois campos do snapshot.
- `backend/prisma/migrations/20260901143000_add_process_negotiation_snapshot/migration.sql`: adiciona, valida e preenche o snapshot histórico.
- `backend/src/features/processes/negotiation-snapshot.ts`: única regra para criar e exigir snapshots.
- `backend/src/features/processes/processes.service.ts`: transição manual e associação de produto.
- `backend/src/features/appointments/appointments.service.ts`: transição automática após agendamento.
- `backend/src/features/meetings/meetings.service.ts`: transição automática após conversa.
- `backend/src/features/products/product-monetary-lock.ts`: regra compartilhada de bloqueio monetário.
- `backend/src/features/{cars,boats,aircrafts}/*.service.ts`: aplica o bloqueio antes do update.
- `backend/src/features/proposals/{proposals.service.ts,entities/proposal.entity.ts}`: snapshot, mínimo dinâmico e currency nas notificações.
- `backend/src/shared/utils/format.utils.ts`: formatação backend BRL/USD.
- `backend/src/features/notifications/{dto/notification-email.dto.ts,notification.service.ts}`: payload e conteúdo monetário das notificações.
- `backend/src/features/contracts/{contracts.service.ts,dto/prefill-contract-response.dto.ts}`: prefill derivado do snapshot.
- `frontend/src/lib/{currency.ts,negotiation-money.ts}`: símbolo/formatação e apresentação do mínimo.
- `frontend/src/services/{proposals.service.ts,contracts.service.ts}`: contratos de API.
- `frontend/src/pages/negotiation/NegotiationPage.tsx`: negociação do cliente/especialista.
- `frontend/src/pages/consultant/ConsultantProcessDetailPage.tsx`: negociação do consultor.
- `frontend/src/pages/specialist/{CreateContractPage.tsx,ContractCommissionStep.tsx}`: prefill e comissão na moeda do processo.
- `frontend/src/components/specialist/ProductForm.tsx`: mensagem estável para bloqueio monetário.

---

### Task 1: Persistir e validar o snapshot monetário

**Files:**
- Modify: `backend/prisma/schema.prisma` no model `Process`
- Create: `backend/prisma/migrations/20260901143000_add_process_negotiation_snapshot/migration.sql`
- Create: `backend/src/features/processes/negotiation-snapshot.ts`
- Create: `backend/src/features/processes/negotiation-snapshot.spec.ts`

**Interfaces:**
- Consumes: `ProductCurrency`, `ProductType` e `Prisma.Decimal` de `@prisma/client`.
- Produces: `buildNegotiationSnapshotUpdate(process): Prisma.ProcessUpdateInput` e `requireNegotiationSnapshot(process): { currency: ProductCurrency; productValue: Prisma.Decimal }`.

- [ ] **Step 1: escrever os testes que falham para criação, imutabilidade e inconsistência**

```ts
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, ProductCurrency, ProductType } from '@prisma/client';
import {
  buildNegotiationSnapshotUpdate,
  requireNegotiationSnapshot,
} from './negotiation-snapshot';

const usdCar = {
  product_type: ProductType.CAR,
  negotiation_currency: null,
  negotiation_product_value: null,
  car: { valor: new Prisma.Decimal('120000.00'), currency: ProductCurrency.USD },
  boat: null,
  aircraft: null,
};

describe('negotiation snapshot', () => {
  it('creates a USD snapshot from the associated car', () => {
    expect(buildNegotiationSnapshotUpdate(usdCar)).toEqual({
      negotiation_currency: ProductCurrency.USD,
      negotiation_product_value: new Prisma.Decimal('120000.00'),
    });
  });

  it('does not overwrite an existing snapshot', () => {
    expect(buildNegotiationSnapshotUpdate({
      ...usdCar,
      negotiation_currency: ProductCurrency.BRL,
      negotiation_product_value: new Prisma.Decimal('90000.00'),
    })).toEqual({});
  });

  it('rejects a half-filled snapshot', () => {
    expect(() => buildNegotiationSnapshotUpdate({
      ...usdCar,
      negotiation_currency: ProductCurrency.USD,
    })).toThrow(ConflictException);
  });

  it('requires both fields before monetary operations', () => {
    expect(() => requireNegotiationSnapshot(usdCar)).toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: executar o teste e confirmar a falha esperada**

Run: `cd backend && rtk npm test -- negotiation-snapshot.spec.ts --runInBand`

Expected: FAIL com `Cannot find module './negotiation-snapshot'`.

- [ ] **Step 3: adicionar os campos ao Prisma e implementar a regra compartilhada**

No model `Process`:

```prisma
  negotiation_currency      ProductCurrency?
  negotiation_product_value Decimal?         @db.Decimal(15, 2)
```

Criar `negotiation-snapshot.ts`:

```ts
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, ProductCurrency, ProductType } from '@prisma/client';

type MonetaryProduct = {
  valor: Prisma.Decimal;
  currency: ProductCurrency;
};

export type NegotiationSnapshotSource = {
  product_type: ProductType | null;
  negotiation_currency: ProductCurrency | null;
  negotiation_product_value: Prisma.Decimal | null;
  car?: MonetaryProduct | null;
  boat?: MonetaryProduct | null;
  aircraft?: MonetaryProduct | null;
};

function snapshotError(code: string, message: string) {
  return { success: false, error: { code, message } };
}

function selectedProduct(source: NegotiationSnapshotSource): MonetaryProduct | null {
  if (source.product_type === ProductType.CAR) return source.car ?? null;
  if (source.product_type === ProductType.BOAT) return source.boat ?? null;
  if (source.product_type === ProductType.AIRCRAFT) return source.aircraft ?? null;
  return null;
}

export function buildNegotiationSnapshotUpdate(
  source: NegotiationSnapshotSource,
): Prisma.ProcessUpdateInput {
  const hasCurrency = source.negotiation_currency !== null;
  const hasValue = source.negotiation_product_value !== null;
  if (hasCurrency !== hasValue) {
    throw new ConflictException(snapshotError(
      'PROCESS_NEGOTIATION_SNAPSHOT_INCONSISTENT',
      'O snapshot monetário do processo está inconsistente.',
    ));
  }
  if (hasCurrency && hasValue) return {};

  const product = selectedProduct(source);
  if (!product) return {};
  return {
    negotiation_currency: product.currency,
    negotiation_product_value: product.valor,
  };
}

export function requireNegotiationSnapshot(
  source: Pick<NegotiationSnapshotSource, 'negotiation_currency' | 'negotiation_product_value'>,
): { currency: ProductCurrency; productValue: Prisma.Decimal } {
  if (!source.negotiation_currency || source.negotiation_product_value === null) {
    throw new BadRequestException(snapshotError(
      'PROCESS_NEGOTIATION_SNAPSHOT_MISSING',
      'A negociação não possui valor e moeda congelados.',
    ));
  }
  return {
    currency: source.negotiation_currency,
    productValue: source.negotiation_product_value,
  };
}
```

- [ ] **Step 4: criar a migration com backfill limitado aos processos elegíveis**

```sql
ALTER TABLE "Process"
  ADD COLUMN "negotiation_currency" "ProductCurrency",
  ADD COLUMN "negotiation_product_value" DECIMAL(15,2);

UPDATE "Process" AS p
SET
  "negotiation_product_value" = CASE p."product_type"
    WHEN 'CAR' THEN (SELECT c."valor" FROM "Car" c WHERE c."id" = p."car_id")
    WHEN 'BOAT' THEN (SELECT b."valor" FROM "Boat" b WHERE b."id" = p."boat_id")
    WHEN 'AIRCRAFT' THEN (SELECT a."valor" FROM "Aircraft" a WHERE a."id" = p."aircraft_id")
  END,
  "negotiation_currency" = CASE p."product_type"
    WHEN 'CAR' THEN (SELECT c."currency" FROM "Car" c WHERE c."id" = p."car_id")
    WHEN 'BOAT' THEN (SELECT b."currency" FROM "Boat" b WHERE b."id" = p."boat_id")
    WHEN 'AIRCRAFT' THEN (SELECT a."currency" FROM "Aircraft" a WHERE a."id" = p."aircraft_id")
  END
WHERE
  (
    p."status" IN ('NEGOTIATION', 'PROCESSING_CONTRACT', 'DOCUMENTATION', 'COMPLETED')
    OR (
      p."status" = 'REJECTED'
      AND EXISTS (
        SELECT 1 FROM "NegotiationProposal" np WHERE np."process_id" = p."id"
      )
    )
  )
  AND (
    (p."product_type" = 'CAR' AND p."car_id" IS NOT NULL)
    OR (p."product_type" = 'BOAT' AND p."boat_id" IS NOT NULL)
    OR (p."product_type" = 'AIRCRAFT' AND p."aircraft_id" IS NOT NULL)
  );

ALTER TABLE "Process"
  ADD CONSTRAINT "Process_negotiation_snapshot_complete"
  CHECK (
    ("negotiation_currency" IS NULL AND "negotiation_product_value" IS NULL)
    OR
    ("negotiation_currency" IS NOT NULL AND "negotiation_product_value" IS NOT NULL)
  );
```

- [ ] **Step 5: validar schema, SQL e testes**

Run: `cd backend && rtk npx prisma format && rtk npx prisma validate && rtk npm test -- negotiation-snapshot.spec.ts --runInBand`

Expected: Prisma `schema.prisma is valid` e 4 testes PASS.

- [ ] **Step 6: commit**

```bash
rtk git add backend/prisma/schema.prisma backend/prisma/migrations/20260901143000_add_process_negotiation_snapshot backend/src/features/processes/negotiation-snapshot.ts backend/src/features/processes/negotiation-snapshot.spec.ts
rtk git commit -m "feat: add immutable negotiation money snapshot"
```

---

### Task 2: Criar o snapshot em todos os caminhos de entrada na negociação

**Files:**
- Modify: `backend/src/features/processes/processes.service.ts`
- Modify: `backend/src/features/processes/processes.service.spec.ts`
- Modify: `backend/src/features/appointments/appointments.service.ts`
- Create: `backend/src/features/appointments/appointments.service.spec.ts`
- Modify: `backend/src/features/meetings/meetings.service.ts`
- Modify: `backend/src/features/meetings/meetings.service.spec.ts`

**Interfaces:**
- Consumes: `buildNegotiationSnapshotUpdate()` da Task 1.
- Produces: todas as transições `SCHEDULING -> NEGOTIATION` gravam status, valor e moeda na mesma transação; associação tardia grava FKs, status e snapshot em um único update.

- [ ] **Step 1: adicionar testes de regressão BRL/USD nos três serviços**

Adicionar expectativas equivalentes nos testes de `ProcessesService.update`, `assignProduct`, `AppointmentsService.updateStatus` e `MeetingsService.completeConsultation`:

```ts
expect(prisma.process.update).toHaveBeenCalledWith(expect.objectContaining({
  where: { id: 'process-1' },
  data: expect.objectContaining({
    status: ProcessStatus.NEGOTIATION,
    negotiation_currency: ProductCurrency.USD,
    negotiation_product_value: new Prisma.Decimal('120000.00'),
  }),
}));
```

Para associação tardia, parametrizar os três tipos:

```ts
beforeEach(() => {
  prisma.process.findUnique.mockResolvedValue({
    id: 'process-1',
    specialist_id: 'specialist-1',
    status: ProcessStatus.NEGOTIATION,
    product_type: null,
    car_id: null,
    boat_id: null,
    aircraft_id: null,
    negotiation_currency: null,
    negotiation_product_value: null,
    client: { id: 'client-1' },
    specialist: { id: 'specialist-1' },
  });
});

it.each([
  [ProductType.CAR, 'car_id'],
  [ProductType.BOAT, 'boat_id'],
  [ProductType.AIRCRAFT, 'aircraft_id'],
])('snapshots a late %s assignment', async (productType, foreignKey) => {
  await service.assignProduct('process-1', {
    product_type: productType,
    product_id: 'product-1',
  }, 'specialist-1', UserRole.SPECIALIST);

  expect(prisma.process.update).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({
      [foreignKey]: 'product-1',
      status: ProcessStatus.NEGOTIATION,
      negotiation_currency: ProductCurrency.USD,
      negotiation_product_value: new Prisma.Decimal('120000.00'),
    }),
  }));
});
```

Adicionar um caso que começa com snapshot BRL já preenchido e confirmar que o update não inclui novos valores:

```ts
expect(prisma.process.update.mock.calls[0][0].data).not.toEqual(
  expect.objectContaining({ negotiation_currency: ProductCurrency.USD }),
);
```

- [ ] **Step 2: executar os testes e observar que status muda sem snapshot**

Run: `cd backend && rtk npm test -- processes.service.spec.ts appointments.service.spec.ts meetings.service.spec.ts --runInBand`

Expected: FAIL nas expectativas `negotiation_currency`/`negotiation_product_value`.

- [ ] **Step 3: aplicar a função no update manual e na associação de produto**

No `ProcessesService.update`, dentro da transação e após carregar `existingProcess`:

```ts
const snapshotData =
  updateProcessDto.status === ProcessStatus.NEGOTIATION
    ? buildNegotiationSnapshotUpdate(existingProcess)
    : {};

const process = await tx.process.update({
  where: { id: processId },
  data: {
    status: updateProcessDto.status,
    notes: updateProcessDto.notes,
    updated_at: new Date(),
    ...snapshotData,
  },
});
```

No `assignProduct`, permitir somente `SCHEDULING` ou `NEGOTIATION`; isso mantém o
fluxo atual e também cobre a associação realmente tardia aprovada na spec:

```ts
if (![ProcessStatus.SCHEDULING, ProcessStatus.NEGOTIATION].includes(process.status)) {
  throw new BadRequestException({
    success: false,
    error: {
      code: 400,
      message: 'Produto só pode ser associado antes ou durante a negociação',
      details: { current_status: process.status },
    },
  });
}
```

Mover a leitura do produto e o update do processo para a mesma transação. Dentro
de `this.prismaService.$transaction(async (tx) => ...)`, ler o delegate
correspondente com `tx.car.findUnique`, `tx.boat.findUnique` ou
`tx.aircraft.findUnique`, executar as validações atuais e então gravar:

```ts
const snapshotData = buildNegotiationSnapshotUpdate({
  product_type: productType,
  negotiation_currency: process.negotiation_currency,
  negotiation_product_value: process.negotiation_product_value,
  car: productType === ProductType.CAR ? product : null,
  boat: productType === ProductType.BOAT ? product : null,
  aircraft: productType === ProductType.AIRCRAFT ? product : null,
});

const updated = await tx.process.update({
  where: { id: processId },
  data: {
    product_type: productType,
    car_id: productType === ProductType.CAR ? product.id : null,
    boat_id: productType === ProductType.BOAT ? product.id : null,
    aircraft_id: productType === ProductType.AIRCRAFT ? product.id : null,
    status: ProcessStatus.NEGOTIATION,
    ...snapshotData,
  },
  include: { client: true, specialist: true, car: true, boat: true, aircraft: true },
});
```

- [ ] **Step 4: tornar as transições de appointment e meeting atômicas**

Na transação que grava `NEGOTIATION`, reler o processo com o próprio `tx` para
garantir que produto, valor e moeda pertencem à mesma operação:

```ts
const processForTransition = await tx.process.findUniqueOrThrow({
  where: { id: process.id },
  include: {
    car: { select: { valor: true, currency: true } },
    boat: { select: { valor: true, currency: true } },
    aircraft: { select: { valor: true, currency: true } },
  },
});
const snapshotData = buildNegotiationSnapshotUpdate(processForTransition);
```

Em seguida usar:

```ts
await tx.process.update({
  where: { id: process.id },
  data: {
    status: ProcessStatus.NEGOTIATION,
    notes: nextNotes,
    updated_at: new Date(),
    ...snapshotData,
  },
});
await tx.processStatusHistory.create({
  data: {
    processId: process.id,
    status: ProcessStatus.NEGOTIATION,
    changed_by: userId,
  },
});
```

Em `AppointmentsService.updateStatus`, mover o update do appointment e o bloco de transição do processo para a mesma chamada `this.prisma.$transaction(async (tx) => ...)`. Em `MeetingsService`, manter a transação existente e usar o mesmo `tx` para snapshot, status e histórico.

- [ ] **Step 5: executar testes focados e build**

Run: `cd backend && rtk npm test -- processes.service.spec.ts appointments.service.spec.ts meetings.service.spec.ts --runInBand && rtk npm run build`

Expected: todos PASS e `nest build` termina com exit code 0.

- [ ] **Step 6: commit**

```bash
rtk git add backend/src/features/processes backend/src/features/appointments backend/src/features/meetings
rtk git commit -m "feat: snapshot money on negotiation entry"
```

---

### Task 3: Bloquear mudanças monetárias de produtos em negociação

**Files:**
- Create: `backend/src/features/products/product-monetary-lock.ts`
- Create: `backend/src/features/products/product-monetary-lock.spec.ts`
- Modify: `backend/src/features/cars/cars.service.ts`
- Modify: `backend/src/features/boats/boats.service.ts`
- Modify: `backend/src/features/aircrafts/aircrafts.service.ts`
- Modify: `backend/src/features/cars/cars.service.spec.ts`

**Interfaces:**
- Consumes: PrismaService, `ProductType`, `ProductCurrency`, valor persistido e campos enviados.
- Produces: `assertProductMonetaryFieldsUnlocked(prisma, input): Promise<void>`; erro 409 com código `PRODUCT_MONETARY_FIELDS_LOCKED` somente para mudança efetiva.

- [ ] **Step 1: escrever testes do bloqueio e das permissões**

```ts
import { ConflictException } from '@nestjs/common';
import { Prisma, ProcessStatus, ProductCurrency, ProductType } from '@prisma/client';
import { assertProductMonetaryFieldsUnlocked } from './product-monetary-lock';

const prisma = { process: { findFirst: jest.fn() } } as any;
const base = {
  productType: ProductType.CAR,
  productId: 'car-1',
  currentValue: new Prisma.Decimal('100000.00'),
  currentCurrency: ProductCurrency.BRL,
};

it('blocks an effective value change during negotiation', async () => {
  prisma.process.findFirst.mockResolvedValue({ id: 'process-1' });
  await expect(assertProductMonetaryFieldsUnlocked(prisma, {
    ...base,
    nextValue: 110000,
  })).rejects.toBeInstanceOf(ConflictException);
  expect(prisma.process.findFirst).toHaveBeenCalledWith({
    where: { car_id: 'car-1', status: ProcessStatus.NEGOTIATION },
    select: { id: true },
  });
});

it('does not query when value and currency are unchanged', async () => {
  await assertProductMonetaryFieldsUnlocked(prisma, {
    ...base,
    nextValue: 100000,
    nextCurrency: ProductCurrency.BRL,
  });
  expect(prisma.process.findFirst).not.toHaveBeenCalled();
});

it('allows non-monetary updates and monetary updates without active negotiation', async () => {
  prisma.process.findFirst.mockResolvedValue(null);
  await expect(assertProductMonetaryFieldsUnlocked(prisma, {
    ...base,
    nextCurrency: ProductCurrency.USD,
  })).resolves.toBeUndefined();
});
```

- [ ] **Step 2: executar e confirmar a falha por módulo ausente**

Run: `cd backend && rtk npm test -- product-monetary-lock.spec.ts --runInBand`

Expected: FAIL com `Cannot find module './product-monetary-lock'`.

- [ ] **Step 3: implementar o helper compartilhado**

```ts
import { ConflictException } from '@nestjs/common';
import { Prisma, ProcessStatus, ProductCurrency, ProductType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type MonetaryLockInput = {
  productType: ProductType;
  productId: string;
  currentValue: Prisma.Decimal;
  currentCurrency: ProductCurrency;
  nextValue?: number;
  nextCurrency?: ProductCurrency;
};

export async function assertProductMonetaryFieldsUnlocked(
  prisma: PrismaService,
  input: MonetaryLockInput,
): Promise<void> {
  const changesValue = input.nextValue !== undefined
    && !input.currentValue.equals(new Prisma.Decimal(input.nextValue));
  const changesCurrency = input.nextCurrency !== undefined
    && input.nextCurrency !== input.currentCurrency;
  if (!changesValue && !changesCurrency) return;

  const foreignKey = {
    [ProductType.CAR]: 'car_id',
    [ProductType.BOAT]: 'boat_id',
    [ProductType.AIRCRAFT]: 'aircraft_id',
  }[input.productType];
  const activeProcess = await prisma.process.findFirst({
    where: { [foreignKey]: input.productId, status: ProcessStatus.NEGOTIATION },
    select: { id: true },
  });
  if (activeProcess) {
    throw new ConflictException({
      code: 'PRODUCT_MONETARY_FIELDS_LOCKED',
      message: 'Valor e moeda não podem ser alterados enquanto o produto estiver em negociação.',
    });
  }
}
```

- [ ] **Step 4: chamar o helper antes de cada update**

Em cada serviço, guardar o retorno de `findOne` e chamar antes do `try`:

```ts
const currentProduct = await this.findOne(id);
await assertProductMonetaryFieldsUnlocked(this.prismaService, {
  productType: ProductType.CAR,
  productId: id,
  currentValue: currentProduct.valor,
  currentCurrency: currentProduct.currency,
  nextValue: updateCarDto.valor,
  nextCurrency: updateCarDto.currency,
});
```

Repetir com `ProductType.BOAT`/`updateBoatDto` e `ProductType.AIRCRAFT`/`updateAircraftDto`. Manter o helper fora do `catch` genérico para preservar o `ConflictException` e seu código.

- [ ] **Step 5: executar testes focados e build**

Run: `cd backend && rtk npm test -- product-monetary-lock.spec.ts cars.service.spec.ts --runInBand && rtk npm run build`

Expected: PASS, incluindo update não monetário, e build com exit code 0.

- [ ] **Step 6: commit**

```bash
rtk git add backend/src/features/products backend/src/features/cars backend/src/features/boats backend/src/features/aircrafts
rtk git commit -m "feat: lock product money during negotiation"
```

---

### Task 4: Usar snapshot e mínimo dinâmico nas propostas

**Files:**
- Modify: `backend/src/features/proposals/proposals.service.ts`
- Modify: `backend/src/features/proposals/entities/proposal.entity.ts`
- Create: `backend/src/features/proposals/proposals.service.spec.ts`

**Interfaces:**
- Consumes: `requireNegotiationSnapshot()` da Task 1 e configurações atuais de `SettingsService`.
- Produces: `process.currency: ProductCurrency`, `process.minimum_enabled: boolean`, `process.minimum_value: number | null` e notificações com `currency`.

- [ ] **Step 1: escrever testes de proposta com snapshot e configuração dinâmica**

```ts
it('calculates the enabled minimum from the immutable snapshot', async () => {
  settings.isMinimumProposalEnabled.mockResolvedValue(true);
  settings.getMinimumProposalPercentage.mockResolvedValue(0.8);
  prisma.process.findUnique.mockResolvedValue(processFixture({
    negotiation_currency: ProductCurrency.USD,
    negotiation_product_value: new Prisma.Decimal('100000.00'),
    car: { valor: new Prisma.Decimal('999999.00'), currency: ProductCurrency.BRL },
  }));

  const response = await service.getByProcess('process-1', 'client-1');
  expect(response.process).toMatchObject({
    product_value: 100000,
    currency: ProductCurrency.USD,
    minimum_enabled: true,
    minimum_value: 80000,
  });
});

it('accepts any positive proposal and returns null minimum when disabled', async () => {
  settings.isMinimumProposalEnabled.mockResolvedValue(false);
  prisma.process.findUnique.mockResolvedValue(processFixture({
    negotiation_currency: ProductCurrency.BRL,
    negotiation_product_value: new Prisma.Decimal('100000.00'),
  }));
  await expect(service.create({ process_id: 'process-1', proposed_value: 1 }, 'client-1'))
    .resolves.toBeDefined();
  expect(settings.getMinimumProposalPercentage).not.toHaveBeenCalled();
});

it('reads the setting again for an already-open negotiation', async () => {
  settings.isMinimumProposalEnabled
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false);
  const first = await service.getByProcess('process-1', 'client-1');
  const second = await service.getByProcess('process-1', 'client-1');
  expect(first.process.minimum_enabled).toBe(true);
  expect(second.process).toMatchObject({ minimum_enabled: false, minimum_value: null });
});

it('fails explicitly when a product negotiation has no snapshot', async () => {
  prisma.process.findUnique.mockResolvedValue(processFixture({
    negotiation_currency: null,
    negotiation_product_value: null,
  }));
  await expect(service.getByProcess('process-1', 'client-1'))
    .rejects.toMatchObject({ response: { error: { code: 'PROCESS_NEGOTIATION_SNAPSHOT_MISSING' } } });
});
```

- [ ] **Step 2: executar e confirmar que os testes usam hoje o produto mutável**

Run: `cd backend && rtk npm test -- proposals.service.spec.ts --runInBand`

Expected: FAIL porque `product_value` vem de `product.valor` e mínimo desativado retorna `0`.

- [ ] **Step 3: alterar contrato de resposta e cálculo**

Em `ProposalListResponseEntity`:

```ts
currency: ProductCurrency;
minimum_enabled: boolean;
minimum_value: number | null;
```

Em `create` e `getByProcess`, depois de validar que o produto está associado:

```ts
const { currency, productValue: snapshotValue } = requireNegotiationSnapshot(process);
const productValue = Number(snapshotValue);
const minimumEnabled = await this.settingsService.isMinimumProposalEnabled();
const minimumPercentage = minimumEnabled
  ? await this.settingsService.getMinimumProposalPercentage()
  : null;
const minimumValue = minimumPercentage === null
  ? null
  : productValue * minimumPercentage;
```

Remover `DEFAULT_MINIMUM_PERCENTAGE`: o valor efetivo sempre vem de
`SettingsService` quando a funcionalidade está ligada e não existe fallback
implícito quando está desligada.

Em `create`, validar somente quando não for `null`:

```ts
if (minimumValue !== null && dto.proposed_value < minimumValue) {
  throw new BadRequestException({
    success: false,
    error: {
      code: 400,
      message: `Valor proposto deve ser no mínimo ${Math.round(minimumPercentage! * 100)}% do valor do produto`,
      details: { proposed_value: dto.proposed_value, minimum_value: minimumValue, product_value: productValue },
    },
  });
}
```

Em `getByProcess`:

```ts
product_value: productValue,
currency,
minimum_enabled: minimumEnabled,
minimum_value: minimumValue,
```

Adicionar `currency` aos três payloads de notificação. Nas queries de `accept` e `reject`, selecionar `process: { select: { negotiation_currency: true, negotiation_product_value: true } }`, chamar `requireNegotiationSnapshot()` e enviar `currency` sem fallback.

- [ ] **Step 4: executar testes e build**

Run: `cd backend && rtk npm test -- proposals.service.spec.ts negotiation-snapshot.spec.ts --runInBand && rtk npm run build`

Expected: todos PASS e build com exit code 0.

- [ ] **Step 5: commit**

```bash
rtk git add backend/src/features/proposals
rtk git commit -m "feat: apply snapshot and dynamic proposal minimum"
```

---

### Task 5: Formatar notificações de proposta em BRL ou USD

**Files:**
- Modify: `backend/src/shared/utils/format.utils.ts`
- Create: `backend/src/shared/utils/format.utils.spec.ts`
- Modify: `backend/src/features/notifications/dto/notification-email.dto.ts`
- Modify: `backend/src/features/notifications/notification.service.ts`
- Create: `backend/src/features/notifications/notification.service.spec.ts`

**Interfaces:**
- Consumes: `ProductCurrency` recebido obrigatoriamente pela Task 4.
- Produces: `formatCurrency(value, currency)` e emails HTML/texto sem símbolo fixo.

- [ ] **Step 1: escrever testes de formatação e conteúdo**

```ts
import { ProductCurrency } from '@prisma/client';
import { formatCurrency } from './format.utils';

it.each([
  [ProductCurrency.BRL, 'R$ 120.000,00'],
  [ProductCurrency.USD, 'US$ 120.000,00'],
])('formats %s in pt-BR without conversion', (currency, expected) => {
  expect(formatCurrency(120000, currency).replace(/\u00a0/g, ' ')).toBe(expected);
});
```

No teste do serviço, interceptar `sendEmailSafely` e inspecionar HTML e texto:

```ts
await service.sendProposalReceivedEmail({
  recipientEmail: 'buyer@example.com',
  recipientName: 'Buyer',
  proposerName: 'Seller',
  proposedValue: 90000,
  originalValue: 120000,
  currency: ProductCurrency.USD,
  processId: 'process-1',
});
expect(sendEmailSafely).toHaveBeenCalledWith(expect.objectContaining({
  htmlBody: expect.stringContaining('US$'),
  textBody: expect.stringContaining('US$'),
}));
expect(JSON.stringify(sendEmailSafely.mock.calls[0][0])).not.toContain('R$');
```

Repetir a asserção USD para aceita e rejeitada, e uma asserção BRL para preservar `R$`.

- [ ] **Step 2: executar e confirmar os símbolos fixos atuais**

Run: `cd backend && rtk npm test -- format.utils.spec.ts notification.service.spec.ts --runInBand`

Expected: FAIL por ausência de `formatCurrency` e presença de `R$` em notificações USD.

- [ ] **Step 3: implementar utilidade e DTOs obrigatórios**

```ts
import { ProductCurrency } from '@prisma/client';

export function formatCurrency(
  value: number | null | undefined,
  currency: ProductCurrency,
): string {
  if (value === null || value === undefined || isNaN(value)) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
}

export function formatBRL(value?: number | null): string {
  return formatCurrency(value, ProductCurrency.BRL);
}
```

Adicionar a cada `ProposalReceivedEmailDto`, `ProposalAcceptedEmailDto` e `ProposalRejectedEmailDto`:

```ts
currency: ProductCurrency;
```

- [ ] **Step 4: substituir toda interpolação monetária dos três eventos**

No início de cada método:

```ts
const proposedValue = formatCurrency(data.proposedValue, data.currency);
const originalValue = formatCurrency(data.originalValue, data.currency);
```

Para aceita/rejeitada, usar respectivamente:

```ts
const acceptedValue = formatCurrency(data.acceptedValue, data.currency);
const rejectedValue = formatCurrency(data.rejectedValue, data.currency);
```

Usar essas variáveis no HTML e no texto puro. Não alterar notificações de contrato, pois o documento final está fora do escopo.

- [ ] **Step 5: executar testes, build e busca de regressão**

Run: `cd backend && rtk npm test -- format.utils.spec.ts notification.service.spec.ts proposals.service.spec.ts --runInBand && rtk npm run build && rtk rg -n 'R\\\$' src/features/notifications/notification.service.ts`

Expected: testes/build PASS; o `rg` não encontra `R$` nos métodos `sendProposalReceivedEmail`, `sendProposalAcceptedEmail` ou `sendProposalRejectedEmail`.

- [ ] **Step 6: commit**

```bash
rtk git add backend/src/shared/utils/format.utils.ts backend/src/shared/utils/format.utils.spec.ts backend/src/features/notifications
rtk git commit -m "feat: format proposal notifications by currency"
```

---

### Task 6: Expor snapshot no prefill do contrato

**Files:**
- Modify: `backend/src/features/contracts/dto/prefill-contract-response.dto.ts`
- Modify: `backend/src/features/contracts/contracts.service.ts`
- Modify: `backend/src/features/contracts/contracts.service.spec.ts`

**Interfaces:**
- Consumes: `requireNegotiationSnapshot()` da Task 1.
- Produces: `PrefillContractResponseDto.currency: ProductCurrency` e `product.price` congelado.

- [ ] **Step 1: escrever testes USD e de inconsistência**

```ts
it('prefills price and currency from the process snapshot', async () => {
  prisma.process.findUnique.mockResolvedValue(processFixture({
    negotiation_currency: ProductCurrency.USD,
    negotiation_product_value: new Prisma.Decimal('120000.00'),
    car: { ...carFixture, valor: new Prisma.Decimal('999999.00'), currency: ProductCurrency.BRL },
  }));
  const result = await service.prefillContract('process-1');
  expect(result.currency).toBe(ProductCurrency.USD);
  expect(result.product.price).toBe(120000);
});

it('rejects contract prefill without a negotiation snapshot', async () => {
  prisma.process.findUnique.mockResolvedValue(processFixture({
    negotiation_currency: null,
    negotiation_product_value: null,
  }));
  await expect(service.prefillContract('process-1'))
    .rejects.toMatchObject({ response: { error: { code: 'PROCESS_NEGOTIATION_SNAPSHOT_MISSING' } } });
});
```

- [ ] **Step 2: executar e confirmar que o preço vem hoje do produto**

Run: `cd backend && rtk npm test -- contracts.service.spec.ts --runInBand`

Expected: FAIL com preço `999999` ou `currency` ausente.

- [ ] **Step 3: alterar DTO e serviço**

No DTO:

```ts
import { ProductCurrency, ProductType } from '@prisma/client';
```

Adicionar a propriedade imediatamente depois de `product_type`:

```ts
currency: ProductCurrency;
```

Logo após validar `processData`:

```ts
const { currency, productValue } = requireNegotiationSnapshot(processData);
const frozenProductPrice = Number(productValue);
```

Nos três ramos CAR/BOAT/AIRCRAFT, usar:

```ts
price: frozenProductPrice,
```

E no retorno:

```ts
currency,
```

Não tocar em `buildFormFields`, `formatBRL` do documento, DocuSign ou templates.

Em `resolveCommissionFromTotal`, exigir o snapshot e trocar apenas o fallback
que hoje lê o produto mutável:

```ts
const { productValue: snapshotValue } = requireNegotiationSnapshot(process);
const proposalValue = process.accepted_proposal
  ? Number(process.accepted_proposal.proposed_value)
  : Number(snapshotValue);
```

Adicionar ao teste USD uma chamada ao método privado por meio de
`(service as any).resolveCommissionFromTotal('process-1', 10)` e confirmar que,
sem proposta aceita, a base é `120000`, não o `car.valor` mutável de `999999`.

- [ ] **Step 4: executar teste e build**

Run: `cd backend && rtk npm test -- contracts.service.spec.ts --runInBand && rtk npm run build`

Expected: PASS e build com exit code 0.

- [ ] **Step 5: commit**

```bash
rtk git add backend/src/features/contracts
rtk git commit -m "feat: expose negotiation currency in contract prefill"
```

---

### Task 7: Propagar moeda e mínimo na interface

**Files:**
- Modify: `frontend/src/lib/currency.ts`
- Modify: `frontend/src/lib/currency.test.ts`
- Create: `frontend/src/lib/negotiation-money.ts`
- Create: `frontend/src/lib/negotiation-money.test.ts`
- Modify: `frontend/src/services/proposals.service.ts`
- Modify: `frontend/src/services/contracts.service.ts`
- Modify: `frontend/src/pages/negotiation/NegotiationPage.tsx`
- Modify: `frontend/src/pages/consultant/ConsultantProcessDetailPage.tsx`
- Modify: `frontend/src/pages/specialist/ContractCommissionStep.tsx`
- Modify: `frontend/src/pages/specialist/CreateContractPage.tsx`
- Modify: `frontend/src/components/specialist/ProductForm.tsx`

**Interfaces:**
- Consumes: `minimum_enabled`, `minimum_value`, `currency` das Tasks 4 e 6.
- Produces: `currencySymbol(currency)`, `getMinimumPresentation(process)` e toda UI do escopo formatada por moeda.

- [ ] **Step 1: escrever testes das utilidades de UI**

```ts
import { describe, expect, it } from 'vitest';
import { currencySymbol, formatCurrency } from './currency';
import { getMinimumPresentation } from './negotiation-money';

describe('currency UI', () => {
  it('uses pt-BR symbols without conversion', () => {
    expect(currencySymbol('BRL')).toBe('R$');
    expect(currencySymbol('USD')).toBe('US$');
    expect(formatCurrency(120000, 'USD')).toContain('US$');
  });

  it('hides minimum when the admin disables it', () => {
    expect(getMinimumPresentation({
      currency: 'USD',
      minimum_enabled: false,
      minimum_value: null,
    })).toEqual({ visible: false, formattedValue: null });
  });

  it('formats an enabled minimum in the process currency', () => {
    expect(getMinimumPresentation({
      currency: 'USD',
      minimum_enabled: true,
      minimum_value: 80000,
    })).toEqual({ visible: true, formattedValue: 'US$ 80.000,00' });
  });
});
```

- [ ] **Step 2: executar e confirmar as APIs ausentes**

Run: `cd frontend && rtk npm test -- src/lib/currency.test.ts src/lib/negotiation-money.test.ts --maxWorkers=2`

Expected: FAIL por ausência de `currencySymbol` e `negotiation-money.ts`.

- [ ] **Step 3: implementar utilidades e contratos TypeScript**

Em `currency.ts`:

```ts
export function formatCurrency(
  value: number,
  currency: ProductCurrency,
): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value);
}

export function currencySymbol(currency: ProductCurrency): 'R$' | 'US$' {
  return currency === 'USD' ? 'US$' : 'R$';
}
```

O parâmetro `currency` deixa de ter default para que TypeScript impeça fallback
silencioso nos fluxos de negociação e contrato. Atualizar o teste antigo
“formats BRL by default” para chamar explicitamente `formatCurrency(value,
'BRL')`.

Em `negotiation-money.ts`:

```ts
import { formatCurrency, type ProductCurrency } from './currency';

type MinimumSource = {
  currency: ProductCurrency;
  minimum_enabled: boolean;
  minimum_value: number | null;
};

export function getMinimumPresentation(source: MinimumSource): {
  visible: boolean;
  formattedValue: string | null;
} {
  if (!source.minimum_enabled || source.minimum_value === null) {
    return { visible: false, formattedValue: null };
  }
  return {
    visible: true,
    formattedValue: formatCurrency(source.minimum_value, source.currency),
  };
}
```

Em `NegotiationProcessInfo`:

```ts
minimum_enabled: boolean;
minimum_value: number | null;
```

Em `PrefillContractResponse`:

```ts
currency: ProductCurrency;
```

Importar `ProductCurrency` de `../lib/currency` e remover o helper duplicado `formatBRL` de `contracts.service.ts` depois de migrar seus consumidores.

- [ ] **Step 4: corrigir negociação e tela do consultor**

Nos dois componentes:

```tsx
const minimum = processInfo
  ? getMinimumPresentation(processInfo)
  : { visible: false, formattedValue: null };
```

No prefixo do input:

```tsx
<span className="text-muted">{currencySymbol(processInfo.currency)}</span>
```

Renderizar cabeçalho, dica e erro de mínimo somente com:

```tsx
{minimum.visible && minimum.formattedValue && (
  <p>Valor mínimo aceito: {minimum.formattedValue}</p>
)}
```

Na validação antes de enviar:

```ts
if (
  processInfo.minimum_enabled
  && processInfo.minimum_value !== null
  && numericValue < processInfo.minimum_value
) {
  setError(`O valor mínimo permitido é ${formatCurrency(
    processInfo.minimum_value,
    processInfo.currency,
  )}.`);
  return;
}
```

Manter cabeçalho e histórico usando `formatCurrency(value, processInfo.currency)`.

- [ ] **Step 5: corrigir prefill, comissão e mensagem de produto bloqueado**

Adicionar `currency: ProductCurrency` às props de `ContractCommissionStep` e substituir todas as chamadas:

```tsx
formatCurrency(vehiclePrice, currency)
formatCurrency(totalCommissionValue, currency)
formatCurrency(sellerNetPreviewValue, currency)
```

Em `CreateContractPage`, depois da guarda de carregamento, usar sempre `prefillData.currency`, passar `currency={prefillData.currency}` e substituir cada `formatBRL(value)` por:

```tsx
formatCurrency(value, prefillData.currency)
```

Remover o `<span>R$</span>` fixo do campo de comissão; o valor readonly já deve conter a saída completa de `formatCurrency`.

No catch de `ProductForm`, antes do fallback genérico:

```ts
const domainCode = error.response?.data?.code;
if (domainCode === 'PRODUCT_MONETARY_FIELDS_LOCKED') {
  errorMessage = 'Valor e moeda não podem ser alterados enquanto o produto estiver em negociação.';
} else if (error.response?.data?.message) {
  errorMessage = Array.isArray(error.response.data.message)
    ? error.response.data.message.join(', ')
    : error.response.data.message;
}
```

- [ ] **Step 6: executar testes, busca de símbolos fixos e build**

Run: `cd frontend && rtk npm test -- src/lib/currency.test.ts src/lib/negotiation-money.test.ts src/lib/contract-commission.test.ts --maxWorkers=2 && rtk rg -n 'R\\\$' src/pages/negotiation/NegotiationPage.tsx src/pages/consultant/ConsultantProcessDetailPage.tsx src/pages/specialist/CreateContractPage.tsx src/pages/specialist/ContractCommissionStep.tsx && rtk npm run build`

Expected: testes e build PASS; `rg` não encontra símbolo fixo nos quatro componentes.

- [ ] **Step 7: commit**

```bash
rtk git add frontend/src/lib frontend/src/services/proposals.service.ts frontend/src/services/contracts.service.ts frontend/src/pages/negotiation/NegotiationPage.tsx frontend/src/pages/consultant/ConsultantProcessDetailPage.tsx frontend/src/pages/specialist/CreateContractPage.tsx frontend/src/pages/specialist/ContractCommissionStep.tsx frontend/src/components/specialist/ProductForm.tsx
rtk git commit -m "feat: propagate negotiation currency through frontend"
```

---

### Task 8: Verificar migration, builds e fluxos locais BRL/USD

**Files:**
- Modify only if a verification exposes a defect in files already listed above.
- Do not modify: contract template/document files, the old `OFFICE` migration, responsive products table files or `PROJECT-OVERVIEW.md`.

**Interfaces:**
- Consumes: API e UI completas das Tasks 1–7.
- Produces: evidência reproduzível de aceite para BRL e USD.

- [ ] **Step 1: aplicar a migration no banco local já existente e conferir o backfill**

Run:

```bash
cd backend
rtk npx prisma migrate deploy
rtk npx prisma generate
rtk npx prisma db execute --stdin <<'SQL'
SELECT id, status, negotiation_currency, negotiation_product_value
FROM "Process"
WHERE status IN ('NEGOTIATION','PROCESSING_CONTRACT','DOCUMENTATION','COMPLETED')
ORDER BY updated_at DESC
LIMIT 20;
SQL
```

Expected: migration `20260901143000_add_process_negotiation_snapshot` aplicada; processos elegíveis com produto mostram os dois campos, e processos sem produto mostram ambos nulos. Se `migrate deploy` parar antes na migration conhecida de `OFFICE`, registrar a limitação e validar esta migration em um banco que já tenha o histórico anterior marcado/aplicado, sem editar a migration antiga.

- [ ] **Step 2: executar suites focadas e builds sem concorrência pesada**

Run:

```bash
cd backend
rtk npm test -- negotiation-snapshot.spec.ts processes.service.spec.ts appointments.service.spec.ts meetings.service.spec.ts product-monetary-lock.spec.ts cars.service.spec.ts proposals.service.spec.ts notification.service.spec.ts contracts.service.spec.ts --maxWorkers=2
rtk npm run build
cd ../frontend
rtk npm test -- src/lib/currency.test.ts src/lib/negotiation-money.test.ts src/lib/contract-commission.test.ts --maxWorkers=2
rtk npm run build
```

Expected: todas as suites PASS; os dois builds terminam com exit code 0.

- [ ] **Step 3: reiniciar os servidores locais com a implementação atual**

Run:

```bash
rtk lsof -ti:3000 -ti:5173
cd backend && rtk npm run start:dev
cd frontend && rtk npm run dev -- --host 0.0.0.0
```

Expected: backend saudável em `http://localhost:3000` e frontend em `http://localhost:5173`. Executar cada servidor em seu próprio terminal; não iniciar builds/testes amplos em paralelo com eles.

- [ ] **Step 4: validar o fluxo BRL pelo navegador local**

1. Criar/editar produto com valor `120000` e moeda BRL.
2. Associá-lo a um processo e avançar para `NEGOTIATION`.
3. Confirmar snapshot `BRL/120000` pela API de propostas.
4. Confirmar `R$ 120.000,00` no cabeçalho, histórico, input e mínimo.
5. Enviar proposta, aceitar e abrir o prefill do contrato.
6. Confirmar `R$` em proposta aceita, produto, líquido do vendedor e comissões.
7. Durante a negociação, confirmar erro `PRODUCT_MONETARY_FIELDS_LOCKED` ao mudar valor/moeda e sucesso ao mudar descrição.

Expected: nenhuma tela do fluxo BRL mostra `US$`; nenhum valor original muda após edição posterior permitida.

- [ ] **Step 5: validar o fluxo USD até o prefill do contrato**

1. Criar produto com valor `120000` e moeda USD, sem “USD” no nome.
2. Associá-lo e avançar até `NEGOTIATION`.
3. Confirmar snapshot `USD/120000` na API.
4. Confirmar `US$ 120.000,00` no cabeçalho, histórico, input e mínimo.
5. Desativar `minimum_proposal_enabled` no admin e recarregar a negociação aberta.
6. Confirmar `minimum_enabled:false`, `minimum_value:null`, ausência visual do mínimo e aceitação de proposta abaixo do antigo percentual.
7. Reativar a configuração e confirmar que ela volta a valer imediatamente.
8. Aceitar a proposta e abrir o prefill do contrato.
9. Confirmar `US$` em proposta, produto, líquido do vendedor e todas as parcelas de comissão.

Expected: nenhuma tela do fluxo USD no escopo mostra `R$`; nenhuma conversão altera `120000`.

- [ ] **Step 6: confirmar limites de escopo e estado do git**

Run:

```bash
rtk git diff --name-only HEAD~7..HEAD
rtk git status --short
```

Expected: nenhum arquivo de template/documento final, migration `OFFICE` ou tabela responsiva foi alterado; `PROJECT-OVERVIEW.md` continua apenas como arquivo local não versionado.

- [ ] **Step 7: commit corretivo somente se a verificação exigiu ajuste**

```bash
rtk git diff --check
rtk git add backend frontend
rtk git commit -m "fix: close brl usd verification gaps"
```

Se não houver correção, não criar commit vazio.

---

## Acceptance evidence to retain

- Saída dos testes focados e dos builds backend/frontend.
- Resposta da API de uma negociação BRL e outra USD com snapshot e mínimo.
- Captura da negociação USD com prefixo `US$` e mínimo desativado oculto.
- Captura do prefill do contrato USD com valores e comissão em `US$`.
- Resposta 409 com `PRODUCT_MONETARY_FIELDS_LOCKED` durante negociação.
- Confirmação por `git diff --name-only` de que o documento final do contrato não foi alterado.
