# Agendamento sem Calendly por e-mail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o pedido de reunião por e-mail com data proposta, composição externa de mensagem, confirmação do especialista, contatos autorizados e fechamento dos vazamentos/atalhos descobertos.

**Architecture:** O backend será a fonte de verdade para capacidade Calendly, autorização, deduplicação e ocupação de agenda. O frontend consumirá contratos discriminados, usará helpers puros para links externos e manterá um painel recuperável após a criação. A confirmação canônica continuará em `ProcessesService.confirmAppointment`, mantendo o processo em `SCHEDULING`.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Jest, React, TypeScript, Vite, Vitest/Testing Library e navegador local controlado.

## Global Constraints

- Não criar migration nem alterar `backend/prisma/schema.prisma`.
- Todo shell do repositório usa prefixo `rtk`.
- Jest roda com `--runInBand` ou no máximo `--maxWorkers=2`; Vitest usa no máximo dois forks.
- `PENDING/EMAIL` com produto é proposta e não ocupa agenda; consultoria sem produto continua aceitando EMAIL sem data.
- Confirmação muda apenas `Appointment` para `SCHEDULED`; `Process` permanece `SCHEDULING`.
- `calendly_scheduling_available` só é verdadeiro com URL HTTPS do domínio Calendly e conexão OAuth ativa.
- E-mail comercial do especialista é público por decisão de produto; documentos, telefone pessoal e dados OAuth nunca são públicos.
- Ações externas só ocorrem depois de persistência confirmada; o navegador não comprova envio de e-mail.
- `pending_expires_at` continua apenas como metadado; esta entrega não implementa expiração automática.

---

### Task 1: Capacidade Calendly e projeção pública segura

**Files:**
- Create: `backend/src/shared/utils/calendly-scheduling-capability.ts`
- Create: `backend/src/shared/utils/calendly-scheduling-capability.spec.ts`
- Create: `backend/src/features/specialists/specialists.controller.spec.ts`
- Modify: `backend/src/features/appointments/calendly-integration.service.ts`
- Modify: `backend/src/features/appointments/calendly-integration.service.spec.ts`
- Modify: `backend/src/features/specialists/specialists.controller.ts`
- Modify: `backend/src/features/specialists/specialists.service.ts`
- Modify: `backend/src/features/specialists/specialists.service.spec.ts`

**Interfaces:**
- Produces: `isCalendlySchedulingAvailable(input: { calendlyUrl: string | null; connectionActive: boolean }): boolean`.
- Produces: `GET /specialists/:id/public-profile` e o tipo de resposta `PublicSpecialistProfile` com allowlist exata.
- Consumes: `CalendlyConnection.is_active` e `me.resource.scheduling_url` do callback OAuth.

- [ ] **Step 1: Write failing capability and projection tests**

```ts
expect(isCalendlySchedulingAvailable({
  calendlyUrl: 'https://calendly.com/especialista/reuniao',
  connectionActive: true,
})).toBe(true);

for (const calendlyUrl of [
  'http://calendly.com/a',
  'https://evilcalendly.com/a',
  'https://calendly.com.evil.test/a',
  'https://calendly.com@evil.test/a',
  'not-a-url',
]) {
  expect(isCalendlySchedulingAvailable({ calendlyUrl, connectionActive: true })).toBe(false);
}

expect(await service.findPublicProfile('specialist-1')).toEqual({
  id: 'specialist-1',
  name: 'Ana',
  surname: 'Silva',
  email: 'ana@example.com',
  speciality: 'CAR',
  calendly_url: 'https://calendly.com/ana/reuniao',
  calendly_scheduling_available: true,
});
```

In the same RED phase, extend `calendly-integration.service.spec.ts` to assert that OAuth callback stores a validated `scheduling_url`, disconnect clears URL/URIs and deactivates the connection in one transaction, access-token expiry with successful refresh remains active, and `invalid_grant` persists `is_active=false` plus `last_error`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
rtk npm --prefix backend test -- --runInBand src/shared/utils/calendly-scheduling-capability.spec.ts src/features/appointments/calendly-integration.service.spec.ts src/features/specialists/specialists.service.spec.ts src/features/specialists/specialists.controller.spec.ts
```

Expected: FAIL because the capability helper, public projection and route do not exist.

- [ ] **Step 3: Implement the domain helper and safe serializer**

```ts
export function isCalendlySchedulingAvailable(input: {
  calendlyUrl: string | null;
  connectionActive: boolean;
}): boolean {
  if (!input.connectionActive || !input.calendlyUrl) return false;
  try {
    const url = new URL(input.calendlyUrl);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' &&
      (host === 'calendly.com' || host.endsWith('.calendly.com'));
  } catch {
    return false;
  }
}
```

Implement `findPublicProfile` with a Prisma `select` allowlisting only `id`, `name`, `surname`, `email`, `speciality`, `calendly_url` and `calendly_connection.is_active`. Declare `@Public()` and `@Get(':id/public-profile')` before `@Get(':id')`. Reuse the serializer in public specialist lists so CPF/CNPJ and RG are never selected.

- [ ] **Step 4: Persist and clear Calendly state consistently**

Update the OAuth callback to validate and store `me.resource.scheduling_url`. Update disconnect so one transaction sets `CalendlyConnection.is_active=false` and clears `calendly_url`, `calendly_user_uri` and `calendly_organization_uri`. Add tests for expired access token with valid refresh and for definitive `invalid_grant` deactivation.

- [ ] **Step 5: Run tests and commit**

```bash
rtk npm --prefix backend test -- --runInBand src/shared/utils/calendly-scheduling-capability.spec.ts src/features/appointments/calendly-integration.service.spec.ts src/features/specialists/specialists.service.spec.ts src/features/specialists/specialists.controller.spec.ts
rtk git add backend/src/shared/utils/calendly-scheduling-capability.ts backend/src/shared/utils/calendly-scheduling-capability.spec.ts backend/src/features/appointments backend/src/features/specialists
rtk git commit -m "feat: centralize Calendly scheduling capability"
```

Expected: all focused tests PASS.

---

### Task 2: Autorizar perfil e impedir IDOR

**Files:**
- Create: `backend/src/features/users/users.controller.spec.ts`
- Modify: `backend/src/features/users/users.controller.ts`
- Modify: `backend/src/features/users/users.service.ts`
- Modify: `backend/src/features/users/users.service.spec.ts`
- Modify: `backend/src/features/users/dto/update-user.dto.ts`
- Modify: `frontend/src/services/specialists.service.ts`
- Modify: `frontend/src/services/specialists.service.test.ts`
- Modify: `frontend/src/pages/catalog/ProductPage.tsx`
- Modify: `frontend/src/pages/catalog/ProductPage.test.tsx`
- Modify: `frontend/src/components/processes/StartProcessForClientModal.tsx`
- Create: `frontend/src/components/processes/StartProcessForClientModal.test.tsx`

**Interfaces:**
- Produces: `GET /users/:id` e `PATCH /users/:id` autorizados para self ou `ADMIN`.
- Produces: `calendly_url?: string | null`; somente `SPECIALIST` pode definir valor não nulo.

- [ ] **Step 1: Write controller authorization tests**

```ts
await expect(controller.getById(targetId, { user: outsider })).rejects.toThrow(ForbiddenException);
await expect(controller.update(targetId, { name: 'X' }, { user: outsider })).rejects.toThrow(ForbiddenException);
expect(usersService.getById).not.toHaveBeenCalled();
expect(usersService.update).not.toHaveBeenCalled();

await expect(controller.getById(self.id, { user: self })).resolves.toMatchObject({ success: true });
await expect(controller.getById(targetId, { user: admin })).resolves.toMatchObject({ success: true });
```

Also validate that a customer cannot submit `calendly_url`, while a specialist can set a valid Calendly URL or remove it with `null`.

- [ ] **Step 2: Run tests and verify RED**

```bash
rtk npm --prefix backend test -- --runInBand src/features/users/users.controller.spec.ts src/features/users/users.service.spec.ts
```

Expected: FAIL because controller methods do not receive/request the authenticated actor and `null` is rejected by the DTO.

- [ ] **Step 3: Implement fail-closed authorization before database access**

```ts
private assertSelfOrAdmin(targetId: string, actor: UserEntity): void {
  if (actor.id !== targetId && actor.role !== UserRole.ADMIN) {
    throw new ForbiddenException('Acesso não autorizado');
  }
}
```

Remove `@Public()` from `GET /users/:id`, read `req.user`, call the guard before the service, and apply the same rule to PATCH. In the service reject a non-null `calendly_url` unless the target role is `SPECIALIST`; normalize empty/null removal to `null`.

- [ ] **Step 4: Migrate public specialist consumers before hardening is committed**

Add `getPublicSpecialistById(id)` to the specialist service using `/specialists/:id/public-profile`. Replace `getUserById` only in ProductPage and StartProcessForClientModal; ProfilePage continues using the authenticated self endpoint. Update their existing mocks without changing scheduling behavior yet.

Before production changes, add `StartProcessForClientModal.test.tsx` asserting that specialist display loads through `getPublicSpecialistById` and never invokes `getUserById`.

- [ ] **Step 5: Run tests and commit**

```bash
rtk npm --prefix backend test -- --runInBand src/features/users/users.controller.spec.ts src/features/users/users.service.spec.ts
rtk npm --prefix frontend test -- --pool=forks --poolOptions.forks.maxForks=2 src/services/specialists.service.test.ts src/pages/catalog/ProductPage.test.tsx src/components/processes/StartProcessForClientModal.test.tsx
rtk git add backend/src/features/users frontend/src/services/specialists.service.ts frontend/src/services/specialists.service.test.ts frontend/src/pages/catalog/ProductPage.tsx frontend/src/pages/catalog/ProductPage.test.tsx frontend/src/components/processes/StartProcessForClientModal.tsx frontend/src/components/processes/StartProcessForClientModal.test.tsx
rtk git commit -m "fix: authorize private user profile access"
```

Expected: tests PASS and outsider cases do not call Prisma/service.

---

### Task 3: Contrato seguro de pedido pendente e consulta própria

**Files:**
- Create: `backend/src/features/appointments/dto/check-existing-appointment.dto.ts`
- Create: `backend/src/features/appointments/appointments.controller.spec.ts`
- Create: `backend/src/features/appointments/appointment-schedule-lock.spec.ts`
- Modify: `backend/src/features/appointments/dto/create-pending-appointment.dto.ts`
- Modify: `backend/src/features/appointments/dto/index.ts`
- Modify: `backend/src/features/appointments/entities/appointment.response.ts`
- Modify: `backend/src/features/appointments/appointments.controller.ts`
- Modify: `backend/src/features/appointments/appointments.service.ts`
- Modify: `backend/src/features/appointments/appointments.service.spec.ts`
- Modify: `backend/src/features/appointments/appointment-schedule-lock.ts`
- Modify: `backend/src/features/processes/process-dedup-lock.ts`
- Modify: `backend/src/features/processes/process-dedup-lock.spec.ts`

**Interfaces:**
- Consumes: `isCalendlySchedulingAvailable` from Task 1.
- Produces: `ExistingAppointmentCheck = { exists: false } | { exists: true; appointment_id; process_id; appointment_status; scheduling_method; appointment_datetime }`.
- Produces: successful pending creation response containing `process_id`.
- Produces: `409/CALENDLY_UNAVAILABLE`, `409/EMAIL_FLOW_UNAVAILABLE` and own-only `409/ACTIVE_PROCESS_EXISTS` snapshot at `error.details.existing_request`. The duplicate snapshot always has `process_id`; appointment fields are nullable because an active process may exist without an appointment.
- Produces: the shared occupation predicate before EMAIL requests can carry a datetime.

- [ ] **Step 1: Write the schedule occupation matrix tests**

Preserve the existing ±1-hour conflict window:

```ts
expect(buildOccupiedScheduleWhere('s1', when)).toMatchObject({
  specialist_id: 's1',
  appointment_datetime: {
    gte: new Date(when.getTime() - 60 * 60 * 1000),
    lte: new Date(when.getTime() + 60 * 60 * 1000),
  },
  OR: [
    { status: StatusAgendamento.SCHEDULED },
    {
      status: StatusAgendamento.PENDING,
      scheduling_method: AppointmentSchedulingMethod.CALENDLY,
      calendly_sync_status: CalendlySyncStatus.SYNCED,
    },
    { status: StatusAgendamento.PENDING, scheduling_method: null },
  ],
});
```

Test exact boundaries at -60 minutes, +60 minutes and one millisecond outside. Assert `PENDING/EMAIL` and unsynced `PENDING/CALENDLY` never match, and conflict errors contain no competing appointment/client/process IDs.

- [ ] **Step 2: Run the predicate test and implement the shared builder**

```bash
rtk npm --prefix backend test -- --runInBand src/features/appointments/appointment-schedule-lock.spec.ts
```

Expected RED: the builder does not exist and the old query includes all PENDING records. Implement `buildOccupiedScheduleWhere` and make `assertSpecialistScheduleAvailable` consume it; rerun until PASS before changing EMAIL creation.

- [ ] **Step 3: Write RED service, dedup and controller tests**

```ts
await expect(service.createPending(productEmailWithoutDate, customer.id, UserRole.CUSTOMER)).rejects.toThrow(BadRequestException);
await expect(service.createPending(productEmailWithPastDate, customer.id, UserRole.CUSTOMER)).rejects.toThrow(BadRequestException);
await expect(service.createPending(consultancyEmailWithoutDate, customer.id, UserRole.CUSTOMER)).resolves.toBeDefined();
await expect(service.createPending(calendlyWithClientDate, customer.id, UserRole.CUSTOMER)).rejects.toThrow(BadRequestException);

expect(await controller.checkExisting(query, customerRequest)).toEqual({
  success: true,
  message: 'Consulta realizada com sucesso',
  data: {
    exists: true,
    appointment_id: 'appointment-1',
    process_id: 'process-1',
    appointment_status: 'PENDING',
    scheduling_method: 'EMAIL',
    appointment_datetime: proposedDate,
  },
});
```

Freeze the duplicate response shape:

```ts
expect((error as ConflictException).getResponse()).toEqual({
  success: false,
  error: {
    code: 'ACTIVE_PROCESS_EXISTS',
    message: expect.any(String),
    details: {
      existing_request: {
        appointment_id: null,
        process_id: 'process-1',
        appointment_status: null,
        scheduling_method: null,
        appointment_datetime: null,
      },
    },
  },
});
```

Add a second case with an attached `PENDING/EMAIL` appointment asserting the same shape with non-null appointment fields, so ProductPage can recover the e-mail panel only for that owned case.

Cover the reciprocal method/capability matrix, mismatched `client_id`, non-customer check calls, atomic rollback and direct `POST /appointments` PLATFORM bypass.

- [ ] **Step 4: Run tests and verify RED**

```bash
rtk npm --prefix backend test -- --runInBand src/features/appointments/appointments.controller.spec.ts src/features/appointments/appointments.service.spec.ts src/features/processes/process-dedup-lock.spec.ts
```

Expected: FAIL on the current EMAIL datetime rejection, arbitrary `client_id`, full Appointment return and direct PLATFORM creation.

- [ ] **Step 5: Implement DTOs and discriminated responses**

```ts
export class CheckExistingAppointmentDto {
  @IsUUID() specialist_id: string;
  @IsEnum(ProductType) product_type: ProductType;
  @IsUUID() product_id: string;
}

export type ExistingAppointmentCheck =
  | { exists: false }
  | {
      exists: true;
      appointment_id: string;
      process_id: string;
      appointment_status: StatusAgendamento;
      scheduling_method: AppointmentSchedulingMethod | null;
      appointment_datetime: Date | null;
    };

export interface ActiveProcessSnapshot {
  process_id: string;
  appointment_id: string | null;
  appointment_status: StatusAgendamento | null;
  scheduling_method: AppointmentSchedulingMethod | null;
  appointment_datetime: Date | null;
}
```

Derive customer ID only from JWT. Require a future datetime only for product EMAIL. Reject client datetime for CALENDLY. Validate method against backend capability. Return `process.id` from the creation transaction and only return an existing snapshot after proving ownership. Update `process-dedup-lock.ts` to select and return the exact snapshot above without PII.

- [ ] **Step 6: Disable the direct PLATFORM path**

No authorized internal caller exists today. In `AppointmentsService.create`, reject the current direct product scheduling path with a stable `403` before locking/inserting; the product UI must use pending EMAIL or CALENDLY.

- [ ] **Step 7: Run tests and commit**

```bash
rtk npm --prefix backend test -- --runInBand src/features/appointments/appointment-schedule-lock.spec.ts src/features/appointments/appointments.controller.spec.ts src/features/appointments/appointments.service.spec.ts src/features/processes/process-dedup-lock.spec.ts
rtk git add backend/src/features/appointments backend/src/features/processes/process-dedup-lock.ts backend/src/features/processes/process-dedup-lock.spec.ts
rtk git commit -m "feat: create dated email appointment requests safely"
```

Expected: all contract tests PASS.

---

### Task 4: Aplicar ocupação compartilhada e confirmação canônica

**Files:**
- Modify: `backend/src/features/appointments/appointments.service.ts`
- Modify: `backend/src/features/processes/processes.service.ts`
- Modify: `backend/src/features/processes/processes.service.spec.ts`
- Modify: `backend/src/features/processes/processes.controller.spec.ts`
- Modify: `backend/src/features/processes/entity/process.response.entity.ts`
- Modify: `backend/src/features/appointments/appointments-concurrency.postgres.spec.ts`

**Interfaces:**
- Consumes: `buildOccupiedScheduleWhere(specialistId, datetime, excludeAppointmentId?)` from Task 3 in every schedule writer.
- Produces: canonical `ProcessesService.confirmAppointment(processId, specialistId, datetime?)` behavior.
- Produces: assigned-specialist-only contact projection in list and detail.

- [ ] **Step 1: Write canonical confirmation/contact RED tests**

Test suggested-time confirmation, changed-time confirmation, future validation, specialist-only authorization, `Appointment=SCHEDULED`, `Process=SCHEDULING`, null reschedule audit fields, proposal/confirmed timestamps in notes, atomic rollback on conflict and idempotent double submission. For both list and detail assert the exact contact matrix: assigned specialist sees client email/phone for `PENDING/EMAIL`, `SCHEDULED` and `COMPLETED`; `PENDING/CALENDLY`, other specialist, OFFICE, CONSULTANT and public/client projections do not receive those contacts early.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
rtk npm --prefix backend test -- --runInBand src/features/appointments/appointment-schedule-lock.spec.ts src/features/processes/processes.service.spec.ts src/features/processes/processes.controller.spec.ts
```

Expected: FAIL because callers do not yet share the new predicate, contact projections differ and confirmation does not preserve all new invariants.

- [ ] **Step 3: Apply the shared predicate and implement the canonical transaction**

Use the same helper in direct creation, confirmation, Calendly callback and reschedule. Confirmation must acquire specialist lock, reread process/appointment in the transaction, validate the chosen future instant, update only the appointment status/date/audit confirmation fields and append notes without setting reschedule audit fields.

- [ ] **Step 4: Add real PostgreSQL concurrency coverage**

Exercise `ProcessesService.confirmAppointment`, not `AppointmentsService.confirmPending`:

```ts
const [first, second] = await Promise.allSettled([
  firstService.confirmAppointment(firstProcessId, specialistId, proposedIso),
  secondService.confirmAppointment(secondProcessId, specialistId, proposedIso),
]);
expect([first, second].filter((result) => result.status === 'fulfilled')).toHaveLength(1);
expect(await prisma.appointment.count({
  where: { specialist_id: specialistId, appointment_datetime: proposedDate, status: 'SCHEDULED' },
})).toBe(1);
```

Also cover two concurrent `PENDING/EMAIL` creations for the same specialist/time both succeeding, two specialists at the same time, double-click on one process and absence of partial writes.

- [ ] **Step 5: Run unit tests and commit**

```bash
rtk npm --prefix backend test -- --runInBand src/features/appointments/appointment-schedule-lock.spec.ts src/features/processes/processes.service.spec.ts src/features/processes/processes.controller.spec.ts
rtk git add backend/src/features/appointments backend/src/features/processes
rtk git commit -m "fix: confirm email proposals under schedule lock"
```

Expected: focused unit tests PASS. PostgreSQL test is executed later with a real URL.

---

### Task 5: Contratos e helpers puros do frontend

**Files:**
- Create: `frontend/src/lib/email-scheduling.ts`
- Create: `frontend/src/lib/email-scheduling.test.ts`
- Create: `frontend/src/lib/whatsapp.ts`
- Create: `frontend/src/lib/whatsapp.test.ts`
- Create: `frontend/src/services/appointments.service.test.ts`
- Create: `frontend/src/hooks/useCheckAppointment.test.tsx`
- Modify: `frontend/src/lib/appointment-datetime.ts`
- Modify: `frontend/src/lib/appointment-datetime.test.ts`
- Modify: `frontend/src/services/appointments.service.ts`
- Modify: `frontend/src/services/specialists.service.ts`
- Modify: `frontend/src/services/specialists.service.test.ts`
- Modify: `frontend/src/hooks/useCheckAppointment.ts`

**Interfaces:**
- Produces: `buildEmailSchedulingLinks(input): { mailtoHref; gmailHref; subject; body }`.
- Produces: `buildWhatsAppHref(phone): string | null`.
- Produces: `isoToLocalDateTimeInput(iso): string`.
- Produces: `useCheckAppointment(specialistId, productType, productId)` returning the discriminated own-request check.
- Consumes: backend DTOs from Tasks 1 and 3.

- [ ] **Step 1: Write helper and service RED tests**

```ts
const links = buildEmailSchedulingLinks({
  recipient: 'especialista@example.com\r\nBcc:evil@example.com',
  specialistName: 'Ana',
  clientName: 'João',
  productLabel: 'Carro A&B?#',
  appointmentDatetime: '2026-10-20T17:30:00.000Z',
  timeZone: 'America/Sao_Paulo',
});
expect(links.mailtoHref).toContain('subject=');
expect(decodeURIComponent(links.mailtoHref)).not.toContain('\r\nBcc:');
expect(links.gmailHref).toMatch(/^https:\/\/mail\.google\.com\/mail\/\?/);

expect(buildWhatsAppHref('(11) 98765-4321')).toBe('https://wa.me/5511987654321');
expect(buildWhatsAppHref('+55 11 98765-4321')).toBe('https://wa.me/5511987654321');
expect(buildWhatsAppHref('123')).toBeNull();
```

Assert that appointment check sends no `client_id`, EMAIL creation requires datetime at type/runtime boundary, CALENDLY rejects a client datetime type, and public specialist service calls `/specialists/:id/public-profile`. Hook tests use fake timers to cover the 500ms debounce, missing parameters, propagated service error, cleanup on unmount and a stale earlier response not overwriting the latest request.

Frontend parsing of duplicates must read exactly `response.data.error.code === 'ACTIVE_PROCESS_EXISTS'` and `response.data.error.details.existing_request`, matching Task 3; other 409 responses remain ordinary errors.

- [ ] **Step 2: Run tests and verify RED**

```bash
rtk npm --prefix frontend test -- --pool=forks --poolOptions.forks.maxForks=2 src/lib/email-scheduling.test.ts src/lib/whatsapp.test.ts src/lib/appointment-datetime.test.ts src/services/appointments.service.test.ts src/services/specialists.service.test.ts src/hooks/useCheckAppointment.test.tsx
```

Expected: FAIL because helpers and discriminated service contracts do not exist.

- [ ] **Step 3: Implement pure helpers and types**

```ts
export type ProductPendingAppointmentInput =
  | (BaseProductRequest & { scheduling_method: 'EMAIL'; appointment_datetime: string })
  | (BaseProductRequest & { scheduling_method: 'CALENDLY'; appointment_datetime?: never });

export function buildWhatsAppHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  const normalized = /^\d{10,11}$/.test(digits)
    ? `55${digits}`
    : /^55\d{10,11}$/.test(digits) ? digits : null;
  return normalized ? `https://wa.me/${normalized}` : null;
}
```

For e-mail, strip CR/LF from recipient and subject, limit subject to 160 and body to 1800 characters, and encode fields separately. Existing check returns a discriminated object and propagates errors rather than converting them to `null`.

Remove `clientId` from the hook signature and dependency list. Use a monotonically increasing request token so only the latest resolved promise can update `existingAppointment`, `isLoading` or `error`.

- [ ] **Step 4: Preserve an unchanged ISO in datetime editing**

Add `isoToLocalDateTimeInput`. Components compare the submitted local value to the initial local value; unchanged sends the original ISO, edited sends `new Date(localValue).toISOString()`.

- [ ] **Step 5: Run tests and commit**

```bash
rtk npm --prefix frontend test -- --pool=forks --poolOptions.forks.maxForks=2 src/lib/email-scheduling.test.ts src/lib/whatsapp.test.ts src/lib/appointment-datetime.test.ts src/services/appointments.service.test.ts src/services/specialists.service.test.ts src/hooks/useCheckAppointment.test.tsx
rtk git add frontend/src/lib frontend/src/services frontend/src/hooks/useCheckAppointment.ts frontend/src/hooks/useCheckAppointment.test.tsx
rtk git commit -m "feat: add safe email scheduling frontend contracts"
```

Expected: focused tests PASS.

---

### Task 6: Unificar ProductPage e painel recuperável de e-mail

**Files:**
- Create: `frontend/src/components/appointments/EmailSchedulingSuccess.tsx`
- Create: `frontend/src/components/appointments/EmailSchedulingSuccess.test.tsx`
- Modify: `frontend/src/components/appointments/NoCalendlySchedulingActions.tsx`
- Modify: `frontend/src/components/appointments/NoCalendlySchedulingActions.test.tsx`
- Modify: `frontend/src/pages/catalog/ProductPage.tsx`
- Modify: `frontend/src/pages/catalog/ProductPage.test.tsx`

**Interfaces:**
- Consumes: helpers/services from Task 5 and backend capability/check contracts.
- Produces: one CTA `Solicitar reunião` when capability is false and persistent success fallbacks.

- [ ] **Step 1: Write EmailSchedulingSuccess RED tests**

```tsx
render(<EmailSchedulingSuccess {...props} autoOpen openMailClient={openMailClient} />);
expect(screen.getByRole('status')).toBeInTheDocument();
expect(screen.getByRole('link', { name: /gmail/i })).toHaveAttribute('rel', 'noopener noreferrer');
await waitFor(() => expect(openMailClient).toHaveBeenCalledTimes(1));
rerender(<EmailSchedulingSuccess {...props} autoOpen openMailClient={openMailClient} />);
expect(openMailClient).toHaveBeenCalledTimes(1);
```

Cover clipboard success/failure, selectable fallback address, heading focus, `autoOpen=false` and session key `email-request-opened:<appointmentId>`.

- [ ] **Step 2: Write ProductPage RED tests**

Cover stale URL + capability false, capability true, dated EMAIL payload, no `createPlatformAppointment`, no opener before 201, generic 409 staying an error, own `ACTIVE_PROCESS_EXISTS` reconstruction without auto-open, reload reconstruction, existing CALENDLY/SCHEDULED messaging and double-submit busy behavior.

- [ ] **Step 3: Run tests and verify RED**

```bash
rtk npm --prefix frontend test -- --pool=forks --poolOptions.forks.maxForks=2 src/components/appointments/EmailSchedulingSuccess.test.tsx src/components/appointments/NoCalendlySchedulingActions.test.tsx src/pages/catalog/ProductPage.test.tsx
```

Expected: FAIL on the current split EMAIL/PLATFORM UI and eager mail opening.

- [ ] **Step 4: Implement the unified flow**

Fetch the public specialist projection. Gate only on `calendly_scheduling_available`. For no Calendly, open `AppointmentDateTimeModal`, create `PENDING/EMAIL` with ISO, render success, then schedule the one-shot external attempt. Recover the same panel from own existing check/duplicate snapshots with `autoOpen=false`.

- [ ] **Step 5: Run tests and commit**

```bash
rtk npm --prefix frontend test -- --pool=forks --poolOptions.forks.maxForks=2 src/components/appointments/EmailSchedulingSuccess.test.tsx src/components/appointments/NoCalendlySchedulingActions.test.tsx src/pages/catalog/ProductPage.test.tsx
rtk git add frontend/src/components/appointments frontend/src/pages/catalog/ProductPage.tsx frontend/src/pages/catalog/ProductPage.test.tsx
rtk git commit -m "feat: unify no-Calendly email request flow"
```

Expected: focused tests PASS.

---

### Task 7: Confirmar proposta, WhatsApp e remoção real do Calendly

**Files:**
- Modify: `frontend/src/components/appointments/AppointmentDateTimeModal.tsx`
- Modify: `frontend/src/components/appointments/AppointmentDateTimeModal.test.tsx`
- Modify: `frontend/src/components/processes/ProcessCard.tsx`
- Modify: `frontend/src/components/processes/ProcessCard.test.tsx`
- Modify: `frontend/src/components/processes/StartProcessForClientModal.tsx`
- Create: `frontend/src/components/processes/StartProcessForClientModal.test.tsx`
- Modify: `frontend/src/pages/customer/ConsultoriaPage.tsx`
- Create: `frontend/src/pages/customer/ConsultoriaPage.test.tsx`
- Modify: `frontend/src/pages/profile/ProfilePage.tsx`
- Create: `frontend/src/pages/profile/ProfilePage.test.tsx`
- Modify: `frontend/src/services/users.service.ts`

**Interfaces:**
- Consumes: `buildWhatsAppHref`, public Calendly capability and `confirmAppointment`.
- Produces: `AppointmentDateTimeModal.initialValue?: string` and distinct confirm/change actions.

- [ ] **Step 1: Write modal and ProcessCard RED tests**

```tsx
expect(screen.getByRole('button', { name: 'Confirmar horário' })).toBeEnabled();
expect(screen.getByRole('button', { name: 'Alterar e confirmar' })).toBeEnabled();
await user.click(screen.getByRole('button', { name: 'Confirmar horário' }));
expect(confirmAppointment).toHaveBeenCalledWith(process.id, process.appointment_datetime);
expect(rescheduleAppointment).not.toHaveBeenCalled();
```

Assert changed confirmation uses the modal initial value, a 409 opens/keeps it with inline `role=alert`, busy disables both actions, invalid phone has no `wa.me`, and `SCHEDULED + SCHEDULING` keeps meeting actions.

- [ ] **Step 2: Write capability/profile regression RED tests**

Consultoria and StartProcess use the boolean, not stale URL. Consultoria without product can create EMAIL without date. Profile specialist clearing input sends `calendly_url: null`; customer never sends that field.

- [ ] **Step 3: Run tests and verify RED**

```bash
rtk npm --prefix frontend test -- --pool=forks --poolOptions.forks.maxForks=2 src/components/appointments/AppointmentDateTimeModal.test.tsx src/components/processes/ProcessCard.test.tsx src/components/processes/StartProcessForClientModal.test.tsx src/pages/customer/ConsultoriaPage.test.tsx src/pages/profile/ProfilePage.test.tsx
```

Expected: FAIL because confirmation is a single action, modal lacks initial value and profile omits empty Calendly URL.

- [ ] **Step 4: Implement specialist actions and contact links**

Direct confirmation sends the stored ISO. Alteration opens the modal with `initialValue` and calls the same confirmation endpoint. Do not call reschedule before initial confirmation. Render WhatsApp only from `buildWhatsAppHref`, with `target="_blank" rel="noopener noreferrer"`, while preserving the textual/copyable phone.

- [ ] **Step 5: Align remaining capability consumers and profile payload**

Replace raw `calendly_url` gates with the backend boolean in Consultoria and StartProcess. Extend `UpdateUserData.calendly_url` to `string | null` and send null for an emptied specialist field.

- [ ] **Step 6: Run tests and commit**

```bash
rtk npm --prefix frontend test -- --pool=forks --poolOptions.forks.maxForks=2 src/components/appointments/AppointmentDateTimeModal.test.tsx src/components/processes/ProcessCard.test.tsx src/components/processes/StartProcessForClientModal.test.tsx src/pages/customer/ConsultoriaPage.test.tsx src/pages/profile/ProfilePage.test.tsx
rtk git add frontend/src/components frontend/src/pages frontend/src/services/users.service.ts
rtk git commit -m "feat: confirm proposed times and expose WhatsApp safely"
```

Expected: focused tests PASS.

---

### Task 8: Stack local, E2E real, revisão adversarial e PR

**Files:**
- Create: `backend/prisma/seed-email-scheduling-e2e.ts`
- Create: `backend/test/email-scheduling.e2e-spec.ts`
- Modify: `backend/package.json`
- Modify: `docs/docs/agendamento-sem-calendly.md`

**Interfaces:**
- Consumes: the complete backend/frontend behavior from Tasks 1–7.
- Produces: repeatable local fixtures, HTTP assertions, browser evidence and the PR to `develop`.

- [ ] **Step 1: Add idempotent E2E fixtures and HTTP tests**

The seed removes only its known deterministic records, never truncates. It creates one customer with phone, assigned specialist without Calendly, another specialist/user and two assigned products. Credentials come from test environment variables. HTTP tests prove own check shape, IDOR rejection, pending creation, assigned contact projection and confirmation state.

Add the script `"seed:email-scheduling-e2e": "ts-node prisma/seed-email-scheduling-e2e.ts"`. Do not execute it until the database health check and migrations in Step 2 succeed.

- [ ] **Step 2: Start stack and execute PostgreSQL concurrency test for real**

```bash
rtk free -h
rtk docker compose up -d db
rtk docker compose exec -T db sh -lc 'until pg_isready -U user -d bmfluxdb; do sleep 1; done'
rtk env DATABASE_URL='postgresql://user:password@localhost:5432/bmfluxdb?schema=public' DIRECT_URL='postgresql://user:password@localhost:5432/bmfluxdb?schema=public' npm --prefix backend exec -- prisma migrate deploy
rtk env DATABASE_URL='postgresql://user:password@localhost:5432/bmfluxdb?schema=public' npm --prefix backend run seed:email-scheduling-e2e
rtk env POSTGRES_CONCURRENCY_TEST_URL='postgresql://user:password@localhost:5432/bmfluxdb?schema=public' node -e "if (!process.env.POSTGRES_CONCURRENCY_TEST_URL) process.exit(1)"
rtk env POSTGRES_CONCURRENCY_TEST_URL='postgresql://user:password@localhost:5432/bmfluxdb?schema=public' npm --prefix backend test -- --runInBand --runTestsByPath src/features/appointments/appointments-concurrency.postgres.spec.ts --json --outputFile=/tmp/high-class-shop-email-scheduling-jest.json
rtk node -e "const r=require('/tmp/high-class-shop-email-scheduling-jest.json');if(!r.success||r.numPendingTests!==0)process.exit(1)"
```

Expected: database is healthy, migrations/seed succeed, and the focused concurrency command executes with zero skipped tests and PASS. Keep the existing `describe.skip` behavior when the URL is absent so ordinary unit suites remain independent of PostgreSQL; the explicit precheck and URL in this dedicated gate prevent an accidental skip here.

- [ ] **Step 3: Run HTTP E2E and browser scenarios**

```bash
rtk env DATABASE_URL='postgresql://user:password@localhost:5432/bmfluxdb?schema=public' JWT_SECRET_ACCESS='local-e2e-access-secret' JWT_SECRET_REFRESH='local-e2e-refresh-secret' JWT_SECRET_REFERRAL='local-e2e-referral-secret' JWT_SECRET_ADVISOR='local-e2e-advisor-secret' JWT_SECRET_PASSWORD_RESET='local-e2e-reset-secret' npm --prefix backend run test:e2e -- --runInBand --runTestsByPath test/email-scheduling.e2e-spec.ts
```

Start backend and frontend from the checked-out source in separate terminal sessions, using the same local-only environment values and `VITE_API_BASE_URL=http://localhost:3000/api`. This avoids stale application images; Docker is used only for PostgreSQL.

In independent browser contexts:

1. Customer creates Product A request and inspect mailto/Gmail href without asserting external send.
2. Reload and verify fallbacks persist without another auto-open.
3. Assigned specialist sees proposal/email/phone/WhatsApp, changes and confirms; appointment becomes `SCHEDULED`, process remains `SCHEDULING`, meeting controls remain and reschedule audit stays null.
4. Product B repeats confirmation without change.
5. Unassigned user cannot read contacts, confirm, or access another private GET/PATCH user profile.
6. Repeat the critical request path on mobile viewport and by keyboard.

Capture request/response status and payloads for creation, check and confirmation. After each confirmation, use a read-only Prisma/SQL query against the deterministic fixture IDs to assert appointment status/date, process status, null reschedule audit fields and exact appointment/process cardinality. Browser-visible assertions alone are insufficient for these database postconditions.

- [ ] **Step 4: Run full verification sequentially**

```bash
rtk free -h
rtk git diff --check
rtk npm --prefix backend test -- --maxWorkers=2
rtk npm --prefix backend run test:e2e -- --runInBand
rtk npm --prefix backend run build
rtk npm --prefix frontend test -- --pool=forks --poolOptions.forks.maxForks=2
rtk npm --prefix frontend run lint
rtk npm --prefix frontend run build
rtk rg -n 'client_id' frontend/src backend/src/features/appointments | rtk rg 'appointments/check' || true
```

Expected: all tests/builds PASS, no schema/migration diff, and no check request sends client identity.

- [ ] **Step 5: Update documentation and commit E2E evidence code**

Document the final manual flow, external e-mail limitation, confirmation semantics and contacts. Commit only source/tests/docs, never screenshots containing PII or local credentials.

```bash
rtk git add backend/package.json backend/prisma/seed-email-scheduling-e2e.ts backend/test docs/docs/agendamento-sem-calendly.md
rtk git commit -m "test: cover no-Calendly email scheduling end to end"
```

- [ ] **Step 6: Run adversarial review and resolve every CRITICAL/HIGH**

Use the `adversarial-review` skill across business rules, authorization/PII, concurrency, frontend UX/accessibility and E2E fidelity. Apply accepted fixes with their own RED/GREEN cycle and repeat affected verification.

- [ ] **Step 7: Sync with develop, reverify and open PR**

Fetch `origin/develop`, use `safe-main-sync` if it diverged materially, rerun affected suites/builds, push `codex/fix-no-calendly-email-flow` and create a PR targeting `develop`. Attach the created PR to the task.
