# Negotiation Card Contact Phones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir no card o telefone da contraparte para cliente e especialista a partir da confirmação do agendamento.

**Architecture:** O backend continuará sendo a autoridade sobre a exposição do telefone. Uma função privada no `ProcessesService` reconhecerá `SCHEDULED` e `COMPLETED` como estados liberados, e os mapeamentos das rotas de listagem incluirão somente o telefone da contraparte quando permitido; o frontend apenas tipará e renderizará o valor recebido.

**Tech Stack:** NestJS 11, Prisma 6, Jest 30, React 19, TypeScript 5, Vite 7.

## Global Constraints

- `PENDING`, `CANCELLED` e ausência de agendamento não podem expor o telefone da contraparte.
- `SCHEDULED` e `COMPLETED` devem expor o telefone cadastrado da contraparte.
- Telefone não cadastrado permanece `null`.
- Admin, consultor e participante que não seja a contraparte permanecem sem o
  telefone nas listagens especializadas.
- Não alterar e-mails, autorização, ciclo do agendamento ou comportamento visual/cópia do card.
- Executar Jest com `--runInBand` ou `--maxWorkers=2` devido ao limite de memória.

---

### Task 1: Política de visibilidade e respostas do backend

**Files:**
- Modify: `backend/src/features/processes/processes.service.ts:64-120,760-1000,1624-1710`
- Modify: `backend/src/features/processes/processes.controller.ts:168-205`
- Test: `backend/src/features/processes/processes.service.spec.ts`
- Test: `backend/src/features/processes/processes.controller.spec.ts`

**Interfaces:**
- Consumes: `StatusAgendamento` e `process.appointment?.status`.
- Produces: `ProcessesService.isAppointmentContactVisible(status): boolean`; projeção condicionada ao solicitante; `client.phone` e `specialist.phone` como `string | null`.

- [ ] **Step 1: Escrever os testes regressivos das listagens**

Adicionar ao final de `processes.service.spec.ts` uma fixture e testes parametrizados:

```ts
describe('ProcessesService — telefone da contraparte após confirmação', () => {
  const clientPhone = '11987654321';
  const specialistPhone = '11912345678';

  function processWithAppointment(status: StatusAgendamento | null) {
    return {
      id: 'process-1',
      status: ProcessStatus.SCHEDULING,
      product_type: ProductType.CAR,
      client_id: clientId,
      specialist_id: specialistId,
      client: {
        id: clientId,
        name: 'Cliente',
        email: 'cliente@example.com',
        phone: clientPhone,
        consultant_id: null,
      },
      specialist: {
        id: specialistId,
        name: 'Especialista',
        email: 'especialista@example.com',
        phone: specialistPhone,
        speciality: ProductType.CAR,
      },
      appointment: status
        ? { status, appointment_datetime: new Date('2026-09-14T15:00:00Z') }
        : null,
      car: { id: productId, marca: 'Porsche', modelo: '911' },
      boat: null,
      aircraft: null,
      created_at: new Date('2026-09-14T12:00:00Z'),
      notes: null,
    };
  }

  function listService(status: StatusAgendamento | null) {
    const prisma = {
      process: {
        findMany: jest.fn().mockResolvedValue([processWithAppointment(status)]),
        count: jest.fn().mockResolvedValue(1),
      },
    } as any;
    return new ProcessesService(prisma, {} as any);
  }

  function detailService(status: StatusAgendamento) {
    const prisma = {
      process: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue(processWithAppointment(status)),
      },
    } as any;
    return new ProcessesService(prisma, {} as any);
  }

  it.each([
    [StatusAgendamento.PENDING, null],
    [StatusAgendamento.SCHEDULED, specialistPhone],
    [StatusAgendamento.COMPLETED, specialistPhone],
    [StatusAgendamento.CANCELLED, null],
    [null, null],
  ])('cliente recebe telefone do especialista em %s: %s', async (status, expected) => {
    const result = await listService(status).getByClientId(
      clientId,
      { page: 1, perPage: 20 } as any,
      clientId,
      UserRole.CUSTOMER,
    );
    expect(result.processes[0].specialist.phone).toBe(expected);
  });

  it.each([
    [StatusAgendamento.PENDING, null],
    [StatusAgendamento.SCHEDULED, clientPhone],
    [StatusAgendamento.COMPLETED, clientPhone],
    [StatusAgendamento.CANCELLED, null],
    [null, null],
  ])('especialista recebe telefone do cliente em %s: %s', async (status, expected) => {
    const result = await listService(status).getBySpecialistIdWithFilters(
      specialistId,
      { page: 1, perPage: 20 },
    );
    expect(result.processes[0].client.phone).toBe(expected);
  });

  it('detalhe oculta o telefone do cliente para especialista em PENDING', async () => {
    const result = await detailService(StatusAgendamento.PENDING).getById(
      'process-1',
      specialistId,
      UserRole.SPECIALIST,
    );
    expect(result.client.phone).toBeNull();
  });

  it('detalhe libera o telefone do especialista para cliente em COMPLETED', async () => {
    const result = await detailService(StatusAgendamento.COMPLETED).getById(
      'process-1',
      clientId,
      UserRole.CUSTOMER,
    );
    expect(result.specialist.phone).toBe(specialistPhone);
  });
});
```

- [ ] **Step 2: Executar os testes e observar a falha esperada**

```bash
cd backend
npm test -- --runInBand src/features/processes/processes.service.spec.ts -t "telefone da contraparte"
```

Expected: FAIL porque os telefones ainda são `undefined` nas listagens.

- [ ] **Step 3: Implementar a política mínima no serviço**

Adicionar próximo aos helpers privados:

```ts
private isAppointmentContactVisible(
  status: StatusAgendamento | null | undefined,
): boolean {
  return (
    status === StatusAgendamento.SCHEDULED ||
    status === StatusAgendamento.COMPLETED
  );
}
```

Fazer `getBySpecialistIdWithFilters` receber o solicitante autenticado:

```ts
requester: Pick<ProcessesRequester, 'id' | 'role'>,
```

Calcular a permissão e completar `client`:

```ts
const canSeeClientPhone =
  requester.role === UserRole.SPECIALIST && requester.id === specialistId;

phone:
  canSeeClientPhone &&
  this.isAppointmentContactVisible(process.appointment?.status)
    ? (process.client?.phone ?? null)
    : null,
```

No controller, encaminhar `{ id: user.id, role: user.role }`. Em
`getByClientId`, liberar apenas para o cliente dono da lista e completar
`specialist`:

```ts
const canSeeSpecialistPhone =
  userRole === UserRole.CUSTOMER && userId === clientId;

phone:
  canSeeSpecialistPhone &&
  this.isAppointmentContactVisible(process.appointment?.status)
    ? (process.specialist.phone ?? null)
    : null,
```

Em `getById`, calcular e usar a mesma regra para a contraparte:

```ts
const contactVisible = this.isAppointmentContactVisible(
  process.appointment?.status,
);
const isClient = userId === process.client_id;
const isSpecialist = userId === process.specialist_id;
const canSeeClientPhone = !isSpecialist || contactVisible;
const canSeeSpecialistPhone = !isClient || contactVisible;
```

Aplicar `canSeeClientPhone` em `client.phone` e `canSeeSpecialistPhone` em `specialist.phone`, sempre usando `?? null`.

- [ ] **Step 4: Executar os testes focados e confirmar sucesso**

```bash
cd backend
npm test -- --runInBand src/features/processes/processes.service.spec.ts -t "telefone da contraparte"
```

Expected: PASS, 12 casos de visibilidade e 0 falhas.

- [ ] **Step 5: Cobrir telefone não cadastrado**

Adicionar o caso abaixo ao mesmo `describe`:

```ts
it('mantém null quando a contraparte não cadastrou telefone', async () => {
  const process = processWithAppointment(StatusAgendamento.SCHEDULED) as any;
  process.specialist.phone = null;
  const prisma = {
    process: {
      findMany: jest.fn().mockResolvedValue([process]),
      count: jest.fn().mockResolvedValue(1),
    },
  } as any;
  const service = new ProcessesService(prisma, {} as any);

  const result = await service.getByClientId(
    clientId,
    { page: 1, perPage: 20 } as any,
    clientId,
    UserRole.CUSTOMER,
  );

  expect(result.processes[0].specialist.phone).toBeNull();
});
```

No mesmo `describe`, adicionar testes que esperem `null` para admin,
consultor e outro especialista na lista do cliente, além de admin na lista do
especialista. Em `processes.controller.spec.ts`, verificar que o controller
encaminha `{ id: specialistId, role: UserRole.SPECIALIST }` como terceiro
argumento do serviço.

- [ ] **Step 6: Executar todo o arquivo de testes do serviço**

```bash
cd backend
npm test -- --runInBand src/features/processes/processes.service.spec.ts
```

Expected: PASS, 53 testes e 0 falhas.

- [ ] **Step 7: Commitar o backend**

```bash
git add backend/src/features/processes/processes.service.ts backend/src/features/processes/processes.service.spec.ts
git commit -m "fix(processes): libera telefones após confirmação"
```

---

### Task 2: Contrato TypeScript da página do cliente

**Files:**
- Modify: `frontend/src/pages/customer/CustomerProcessesPage.tsx:20-43`

**Interfaces:**
- Consumes: `specialist.phone` e `client.phone` opcionais retornados pelo backend.
- Produces: `phone?: string | null` no tipo local `ProcessClient`.

- [ ] **Step 1: Alinhar a tipagem local ao contrato da API**

Adicionar o campo aos dois participantes:

```ts
client?: {
  id: string;
  email?: string;
  name?: string;
  phone?: string | null;
};

specialist?: {
  id: string;
  name?: string;
  especialidade?: string;
  phone?: string | null;
};
```

- [ ] **Step 2: Executar o build do frontend**

```bash
cd frontend
npm run build
```

Expected: PASS com `tsc -b` e `vite build` sem erros.

- [ ] **Step 3: Commitar o frontend**

```bash
git add frontend/src/pages/customer/CustomerProcessesPage.tsx
git commit -m "fix(customer): tipa telefone nos cards de processo"
```

---

### Task 3: Verificação integrada

**Files:**
- Verify: `backend/src/features/processes/processes.service.ts`
- Verify: `backend/src/features/processes/processes.service.spec.ts`
- Verify: `frontend/src/pages/customer/CustomerProcessesPage.tsx`

**Interfaces:**
- Consumes: Tasks 1 e 2.
- Produces: evidência final de teste, build e escopo do diff.

- [ ] **Step 1: Executar o teste regressivo completo**

```bash
cd backend
npm test -- --runInBand src/features/processes/processes.service.spec.ts
```

Expected: PASS, 53 testes e 0 falhas.

- [ ] **Step 2: Executar o build do backend**

```bash
cd backend
npm run build
```

Expected: PASS sem erros TypeScript/NestJS.

- [ ] **Step 3: Executar o build do frontend**

```bash
cd frontend
npm run build
```

Expected: PASS sem erros TypeScript/Vite.

- [ ] **Step 4: Conferir integridade e escopo do diff**

```bash
git diff --check origin/develop...HEAD
git diff --stat origin/develop...HEAD
git status --short --branch
```

Expected: nenhum erro de whitespace; mudanças apenas na especificação, plano, serviço/testes e tipagem da página; branch limpa e à frente de `origin/develop` somente pelos commits da correção.
