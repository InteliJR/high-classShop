# Post-security concurrency and integrity fix report

Date: 2026-09-04  
Baseline: `82233c10883eb3e41464a21a81f9a2fa288546c7`  
Implementation commit: `1d095daa5d9287d4f6fb76b71116a8eb4a982245`

## Contractual status

`DONE_WITH_CONCERNS`

All four findings in `post-security-fix-brief.md` were implemented in one
coherent TDD wave. A subsequent adversarial review found additional stale
preview, active-envelope, expiry, and test-determinism cases. Those cases were
also taken through RED/GREEN; the final re-review result was `READY`.

## Finding 1 — contract lock and transaction client

### Root cause

`withContractProcessLock` held a PostgreSQL advisory transaction lock on one
Prisma connection, while the callback used the global `PrismaService` and the
generation/send paths opened another transaction. Concurrent waiters could
consume the pool while the lock owner waited for another connection.

### Implementation

- `withContractProcessLock` now passes the lock-owning
  `Prisma.TransactionClient` to its callback.
- Authorization, process reads, active-contract reads, commission/snapshot
  reads, contract creation, and the conditional process claim all use that same
  transaction client.
- `PlatformCompanyService.findOne` and the relevant `SettingsService` reads
  accept an optional transaction client so no hidden global read escapes the
  transaction.
- External-envelope markers remain set until the outer transaction commit
  succeeds; generated-contract notification is queued only after commit.
- `sendContractAfterPreview` revalidates that the process is still in
  `DOCUMENTATION` or `PROCESSING_CONTRACT` before sending and constrains the
  final claim to those statuses, preventing stale previews from regressing a
  terminal process.
- Duplicate send/cancel never voids the active contract's provider envelope.
  Explicit cancellation verifies provider status `created`; automatic loser
  cleanup also refuses to void a non-draft. Voiding a sent envelope remains
  isolated to persistence compensation.
- The real PostgreSQL contract regression runs the public generation path with
  a one-connection pool per contender and a mocked DocuSign provider. It proves
  one external generation, one stored contract, and final
  `PROCESSING_CONTRACT` state without deadlock.

## Finding 2 — observable cancellation and compensation

### Root cause

`DocuSignService.voidDraftEnvelope` logged and swallowed provider errors.
Explicit cancellation could report success, and failed compensation after a DB
failure could leave an external envelope live without an actionable signal.
The frontend also closed and cleared preview state before cancellation was
confirmed; expiry bypassed cancellation entirely.

### Implementation

- `voidDraftEnvelope` rethrows provider failures.
- Persistence compensation logs `processId`, `envelopeId`, the original
  persistence error, and the compensation error. If compensation fails it
  throws `CONTRACT_MANUAL_RECONCILIATION_REQUIRED`, retaining both failures in
  structured details.
- Public commit-time failure regressions verify that an external envelope is
  compensated after the transaction callback succeeds but commit rejects, and
  that a second compensation failure surfaces the manual-reconciliation error.
- The frontend awaits cancellation before clearing preview data. A shared
  single-flight guard blocks confirm/cancel/backdrop/Escape/DocuSign message
  reactions while either send or cancel is pending.
- Cancellation errors render inside the retained modal. Expiry goes through the
  same cancel-before-discard policy; a one-shot expiry gate prevents an
  automatic retry from discarding state after a failed cancellation. The
  expired modal retains the envelope and exposes retry controls.

## Finding 3 — atomic proposal creation

### Root cause

Proposal creation validated status, participants, alternation, negotiation
snapshot, minimum value, and counter target outside its mutation transaction.
A response could commit `DOCUMENTATION` after validation but before insertion.

### Implementation

- Create, accept, reject, and counter-response paths serialize on the same
  process-scoped advisory key: `proposal-process:<processId>`.
- Creation re-reads and validates process status, participants, alternation,
  product/snapshot, minimum settings, and counter target inside the locked
  transaction immediately before mutation.
- Counter claiming remains conditional on proposal id, process id, intended
  recipient, and `PENDING` status.
- Settings reads use the transaction client.
- The PostgreSQL create-vs-accept race waits for the creation path to attempt
  the advisory query, asserts the exact interpolated process lock key, and only
  then releases acceptance. It contains no fixed sleep.

## Finding 4 — product association and atomic creation flows

### Root cause

`ProcessesService.createOnBehalfOfClient` did not run the shared
specialist/product association validator. `AppointmentsService.create`
validated outside a transaction, then wrote Appointment and Process
separately, permitting stale validation and orphan appointments.

### Implementation

- `createOnBehalfOfClient` invokes the shared validator through the transaction
  client before writes.
- `AppointmentsService.create` runs shared association validation, conflict
  detection, Appointment creation, and Process creation in one transaction.
- Duplicated per-product validation was removed. The shared validator returns
  the complete product record so response and notification details are
  preserved.
- Regressions cover inactive and foreign products plus rollback when Process
  creation fails, proving no Appointment is left behind.

## RED evidence

All commands were run with `rtk`; Jest was serial and Vitest used at most two
workers. External providers were mocked.

1. Contracts and provider failure propagation:
   `cd backend && npm test -- --runInBand src/features/contracts/contracts.service.spec.ts src/providers/docusign/docusign.service.spec.ts`
   — RED: 4 failed, 22 passed. Failures exposed a missing transaction client in
   the locked callback, missing compensation behavior, and swallowed DocuSign
   void failure.
2. Frontend cancellation policy:
   `cd frontend && npm test -- --maxWorkers=2 src/lib/contract-preview-cancellation.test.ts`
   — RED: suite failed because the policy module did not exist.
3. Proposal transactional re-read:
   `cd backend && npm test -- --runInBand src/features/proposals/proposals.service.spec.ts -t 're-reads process state'`
   — RED: 1 failed, 18 skipped; creation succeeded from stale pre-transaction
   state even though the transaction fixture reported `DOCUMENTATION`.
4. Process/appointment product integrity:
   `cd backend && npm test -- --runInBand src/features/processes/processes.service.spec.ts src/features/appointments/appointments.service.spec.ts -t 'rejeita produto|rolls back the appointment'`
   — RED: 5 failed, 42 skipped; invalid association was accepted and the
   appointment path did not use a transaction, leaving an orphan fixture.
5. Post-review contract integrity:
   `cd backend && npm test -- --runInBand src/features/contracts/contracts.service.spec.ts`
   — RED: valid regressions showed active cancellation resolving, non-draft
   cancellation resolving, terminal preview sending/persisting, and duplicate
   send voiding the winning envelope. The first run also exposed two test
   fixture errors (`tx.$queryRaw` absent); those fixtures were corrected before
   evaluating production behavior.
6. Non-draft automatic cleanup:
   `cd backend && npm test -- --runInBand src/features/contracts/contracts.service.spec.ts -t 'does not void a sent losing envelope'`
   — RED: 1 failed, 28 skipped; no provider-status check occurred before void.
7. Modal integration state:
   `cd frontend && npm test -- --maxWorkers=2 src/components/contracts/DocuSignPreviewModal.test.tsx`
   — RED: 2 failed; cancellation progress and error were absent from the modal.
8. Expiry policy:
   `cd frontend && npm test -- --maxWorkers=2 src/lib/contract-preview-cancellation.test.ts`
   — RED: 3 failed, 2 passed; expiry cancellation and one-shot policy did not
   exist.

## GREEN evidence

- Focused backend coverage:
  `cd backend && npm test -- --runInBand src/features/contracts/contracts.service.spec.ts src/providers/docusign/docusign.service.spec.ts src/features/proposals/proposals.service.spec.ts src/features/processes/processes.service.spec.ts src/features/appointments/appointments.service.spec.ts src/features/products/product-association-validator.spec.ts`
  — 6 suites, 106/106 passed in the final consolidated run (the contract suite
  contributed 29/29 after the last review case).
- Real PostgreSQL proposal concurrency:
  `POSTGRES_CONCURRENCY_TEST_URL='postgresql://user:password@127.0.0.1:5432/highclass_task8?schema=public' npm test -- --runInBand src/features/proposals/proposals-concurrency.postgres.spec.ts`
  — 3/3 passed, including create-vs-accept with exact lock-key assertion.
- Real PostgreSQL contract concurrency:
  `POSTGRES_CONCURRENCY_TEST_URL='postgresql://user:password@127.0.0.1:5432/highclass_task8?schema=public' npm test -- --runInBand src/features/contracts/contracts-lock.postgres.spec.ts`
  — 1/1 passed; provider mocked, one winner, no status regression/deadlock.
- Frontend full suite:
  `cd frontend && npm test -- --maxWorkers=2`
  — 15 suites, 82/82 passed.
- Backend build: `cd backend && npm run build` — passed.
- Frontend build: `cd frontend && npm run build` — passed, with only the
  existing Rollup chunk-size warning.
- `git diff --check` — clean before the implementation commit.

The broad backend run was also executed serially with the PostgreSQL test URL:
48 suites, 47 passed and 1 failed; 439/440 tests passed. The sole failure is
`backend/src/features/cars/cars.service.spec.ts` (`prisma.$transaction is not a
function`). Neither that spec nor its production path differs from baseline
`82233c1`; it is a stale mock for the pre-existing product monetary-lock
transaction and is outside this brief.

## Files changed

### Backend production

- `backend/src/features/appointments/appointments.service.ts`
- `backend/src/features/contracts/contracts.service.ts`
- `backend/src/features/platform-company/platform-company.service.ts`
- `backend/src/features/processes/processes.service.ts`
- `backend/src/features/products/product-association-validator.ts`
- `backend/src/features/proposals/proposals.service.ts`
- `backend/src/features/settings/settings.service.ts`
- `backend/src/providers/docusign/docusign.service.ts`

### Backend tests

- `backend/src/features/appointments/appointments.service.spec.ts`
- `backend/src/features/contracts/contracts-lock.postgres.spec.ts`
- `backend/src/features/contracts/contracts.service.spec.ts`
- `backend/src/features/processes/processes.service.spec.ts`
- `backend/src/features/proposals/proposals-concurrency.postgres.spec.ts`
- `backend/src/features/proposals/proposals.service.spec.ts`
- `backend/src/providers/docusign/docusign.service.spec.ts`

### Frontend

- `frontend/src/components/contracts/DocuSignPreviewModal.tsx`
- `frontend/src/components/contracts/DocuSignPreviewModal.test.tsx`
- `frontend/src/lib/contract-preview-cancellation.ts`
- `frontend/src/lib/contract-preview-cancellation.test.ts`
- `frontend/src/pages/specialist/CreateContractPage.tsx`

### Report

- `.superpowers/sdd/post-security-fix-report.md`

## Self-review

- Confirmed every locked contract DB access uses the lock-owning transaction;
  no nested Prisma transaction remains in the locked generation/send paths.
- Confirmed provider mutations are either draft-only explicit/loser cleanup or
  clearly identified post-send compensation.
- Confirmed proposal create/response methods share the exact process lock key
  and all required creation validations occur after acquiring it.
- Confirmed appointment/process writes roll back together and product response
  data remains available after removing manual validation.
- Confirmed notification side effects happen after successful transaction
  completion in modified flows.
- Confirmed no AWS/SES/DocuSign provider was called; provider effects in tests
  are mocks.
- Confirmed `PROJECT-OVERVIEW.md` remains the same untracked user file and was
  not staged or edited.
- Independent adversarial re-review after all follow-ups returned `READY`.

## Remaining concerns

1. The unrelated stale mock in `cars.service.spec.ts` keeps the broad backend
   suite from being completely green. It is outside the requested files and
   behavior; focused coverage, real PostgreSQL races, and both builds pass.
2. The frontend production build retains its pre-existing warning for a JS
   chunk larger than 500 kB. It does not fail the build and is unrelated to this
   wave.

---

# Independent-review follow-up (2026-09-04)

This section supersedes the earlier readiness statement. The independent review
of `82233c1..f946d3c` returned `NOT READY`; every Important and
Minor/test-integrity item in that review was addressed in this follow-up.

## Root causes and implementation

### 1. Compensation race and ambiguous commit acknowledgement

Compensation previously ran after releasing `contract-process:<processId>` and
could void an envelope that a retry had already persisted as the active
contract. The compensation path now reacquires the process advisory lock,
re-reads `active_contract_id` and its contract `provider_id`, and refuses to
void the current persisted provider envelope. It also reads the provider state
under the lock before deciding whether automatic compensation is safe.

The public generation and preview-send flows track whether their transaction
callback completed. A rejection after callback completion is treated as an
ambiguous COMMIT acknowledgement and returns the stable
`CONTRACT_MANUAL_RECONCILIATION_REQUIRED` response; it never automatically
voids the envelope. PostgreSQL coverage forces the lost-acknowledgement/retry
ordering and proves that the persisted envelope is not voided.

### 2. Provider partial effects and send ambiguity

The provider draft used to exist before the application learned its id.
`DocuSignService` now invokes `onEnvelopeCreated` immediately after draft
creation, and `EnvelopeEffectError` carries the envelope id plus the typed
effect state `DRAFT_CONFIRMED` or `SEND_INDETERMINATE`. Confirmed drafts are
compensated; an unconfirmable send result is sent to manual reconciliation.
After an update error, the provider status is queried: sent/delivered/completed
is idempotent success, created is a compensable draft, and unavailable or
unexpected state is indeterminate.

Creation requests now include a per-operation DocuSign `transactionId`; the
same request body and transaction id are reused by client-level retries.
Regressions cover the immediate draft marker, partial DocGen failure,
idempotency key, confirmed send after a lost response, and indeterminate send.

### 3. Stale or losing previews already sent externally

The preview-send path now authorizes the caller, validates the process binding,
and inspects provider status before applying terminal/active-contract discard
rules. A stale draft is voided. A stale or losing
sent/delivered/completed envelope produces the explicit safe reconciliation
error instead of being silently logged. The real page keeps preview state and
the modal open for that code, and the modal event tests exercise confirm,
cancel, expiry, progress, and error wiring.

### 4. Product association TOCTOU

The shared association validator now acquires the existing
`product-money:<type>:<id>` transaction-scoped advisory lock before reading the
product. All catalog mutation paths that can deactivate or reassign a product
use the same convention: direct car/boat/aircraft update and remove, import
upserts, and stale-import deactivation. Multi-product deactivation takes locks
in sorted id order. A deterministic PostgreSQL race holds a deactivation after
lock acquisition, queues appointment creation on the same key, and proves the
creator re-reads the inactive row and writes no appointment/process.

### 5. Raw internal errors in HTTP responses

Manual reconciliation and generic contract failures now expose only a stable
public code/message, safe process/envelope ids, and a generated correlation id.
Database/provider messages and stacks remain in structured server logs and the
exception `cause`; they are absent from the HTTP response. Provider fallback
messages are likewise sanitized, including development mode. Regressions use
sentinel raw database/provider text and assert that it is not serialized.

### 6. Idempotent cancellation

After authorization, envelope/process binding, and active-envelope protection,
`cancelPreview` treats provider status `VOIDED` as success. Other non-draft
statuses remain errors and provider cancellation failures still propagate.

### 7. Active-process deduplication

`createOnBehalfOfClient` moved its active-process query into the write
transaction. It acquires a scoped key containing client, specialist and
product/consultancy identity, then re-reads with `tx.process.findFirst` before
creating Appointment, Process and history. A three-connection PostgreSQL test
holds the key until both creators are queued and proves exactly one succeeds.

### 8. Appointment schedule serialization

Appointment creation now acquires `appointment-schedule:<specialistId>` before
the conflict query and insert. A deterministic PostgreSQL test queues two
different products for the same specialist/time behind a held key and proves
one success, one `ConflictException`, and one committed appointment.

### 9. Test integrity

Contract PostgreSQL tests use explicit barriers, one connection per pool, and
exercise the public `sendContractAfterPreview` method as well as generation and
lost-COMMIT acknowledgement. The appointment rollback harness now uses distinct
root and transaction delegates and verifies root writes are not used. Real
React/jsdom tests exercise modal DOM events and the page-level
reconciliation/cancellation lifecycle. The stale car mock called out in the
previous report was corrected to model the monetary-lock transaction.

## RED evidence

All commands were prefixed with `rtk`. Jest ran with `--runInBand`; Vitest was
limited to two workers. Provider clients were mocks.

1. `cd backend && rtk npm test -- --runInBand src/providers/docusign/docusign.service.spec.ts`
   — RED: 3 expected failures. The draft id was not exposed immediately, no
   `transactionId` was sent, and an ambiguous send was returned as an ordinary
   provider error. GREEN for this focused file became 7/7.
2. `cd backend && rtk npm test -- --runInBand src/features/contracts/contracts.service.spec.ts`
   — RED: 6 expected failures. Compensation did not safely re-read the active
   provider, lost COMMIT acknowledgement could enter void compensation, an
   ambiguous send was not reconciled, a sent loser was silently accepted, and
   raw causes appeared in public errors. GREEN became 33/33.
3. `cd backend && rtk npm test -- --runInBand src/features/products/product-association-validator.spec.ts src/features/processes/processes.service.spec.ts src/features/appointments/appointments.service.spec.ts`
   — RED: 3 expected failures across product, dedup and schedule locks; the
   required advisory query was absent from each transaction. The consolidated
   focused group became 57/57 after implementation.
4. `cd frontend && rtk npm test -- --pool=forks --maxWorkers=2 src/pages/specialist/CreateContractPage.test.tsx`
   — RED: the page removed the real modal after
   `CONTRACT_MANUAL_RECONCILIATION_REQUIRED` instead of retaining its envelope
   context. The page test passed after the lifecycle fix.

During test hardening, two fixture-only failures were found and corrected before
production conclusions were drawn: fire-and-forget mocks returned `undefined`
instead of promises, and the appointment transaction/root delegate split was
initially inverted. An unsupported Vitest CLI option was also replaced with
`--maxWorkers=2`. No unexpected production regression remained.

## GREEN evidence

- Required/affected backend unit matrix:
  `cd backend && rtk npm test -- --runInBand src/features/contracts/contracts.service.spec.ts src/features/appointments/appointments.service.spec.ts src/features/processes/processes.service.spec.ts src/providers/docusign/docusign.service.spec.ts src/features/proposals/proposals.service.spec.ts src/features/proposals/proposal-money.spec.ts src/features/products/product-association-validator.spec.ts src/features/cars/cars.service.spec.ts`
  — 8 suites, 120/120 passed.
- Contract PostgreSQL concurrency:
  `POSTGRES_CONCURRENCY_TEST_URL='postgresql://user:password@127.0.0.1:5432/highclass_task8?schema=public' rtk npm test -- --runInBand src/features/contracts/contracts-lock.postgres.spec.ts`
  — 3/3 passed.
- Proposal PostgreSQL regression with unchanged proposal guarantees:
  same environment and Jest options for
  `src/features/proposals/proposals-concurrency.postgres.spec.ts` — 3/3 passed.
- Product association PostgreSQL race:
  same environment and Jest options for
  `src/features/products/product-association-concurrency.postgres.spec.ts` —
  1/1 passed.
- Process deduplication PostgreSQL race:
  same environment and Jest options for
  `src/features/processes/processes-dedup-concurrency.postgres.spec.ts` — 1/1
  passed.
- Appointment schedule PostgreSQL race:
  same environment and Jest options for
  `src/features/appointments/appointments-concurrency.postgres.spec.ts` — 1/1
  passed.
- Existing product monetary-lock PostgreSQL regression:
  same environment and Jest options for
  `src/features/products/product-monetary-lock.postgres.spec.ts` — 1/1 passed.
- Frontend cancellation/modal/page matrix:
  `cd frontend && rtk npm test -- --pool=forks --maxWorkers=2 src/components/contracts/DocuSignPreviewModal.test.tsx src/pages/specialist/CreateContractPage.test.tsx src/lib/contract-preview-cancellation.test.ts`
  — 3 suites, 10/10 passed.
- `cd backend && rtk npm run build` — passed.
- `cd frontend && rtk npm run build` — passed; only the pre-existing Vite chunk
  size warning remains.
- `rtk git diff --check` — clean.

## Files changed in this follow-up

Backend production:

- `backend/src/features/aircrafts/aircrafts.service.ts`
- `backend/src/features/appointments/appointments.service.ts`
- `backend/src/features/boats/boats.service.ts`
- `backend/src/features/cars/cars.service.ts`
- `backend/src/features/contracts/contracts.service.ts`
- `backend/src/features/processes/processes.service.ts`
- `backend/src/features/product-import-jobs/product-import-jobs.service.ts`
- `backend/src/features/products/product-association-validator.ts`
- `backend/src/providers/docusign/docusign.service.ts`
- `backend/src/providers/docusign/dto/request/create-template-envelope.dto.ts`
- `backend/src/providers/docusign/envelope-effect.error.ts`
- `backend/src/shared/exceptions/custom-exceptions.ts`

Backend tests:

- `backend/src/features/appointments/appointments-concurrency.postgres.spec.ts`
- `backend/src/features/appointments/appointments.service.spec.ts`
- `backend/src/features/cars/cars.service.spec.ts`
- `backend/src/features/contracts/contracts-lock.postgres.spec.ts`
- `backend/src/features/contracts/contracts.service.spec.ts`
- `backend/src/features/processes/processes-dedup-concurrency.postgres.spec.ts`
- `backend/src/features/processes/processes.service.spec.ts`
- `backend/src/features/products/product-association-concurrency.postgres.spec.ts`
- `backend/src/features/products/product-association-validator.spec.ts`
- `backend/src/providers/docusign/docusign.service.spec.ts`

Frontend/tests:

- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/src/components/contracts/DocuSignPreviewModal.test.tsx`
- `frontend/src/pages/specialist/CreateContractPage.tsx`
- `frontend/src/pages/specialist/CreateContractPage.test.tsx`

Report:

- `.superpowers/sdd/post-security-fix-report.md`

## Self-review

- Mapped every independent-review item to production code and a focused
  regression; no Important or Minor/test-integrity item was deferred.
- Confirmed every compensation decision is made while holding the same process
  lock and never voids the envelope persisted as the current active provider.
- Confirmed provider mutation ambiguity is never presented as definitive
  success/failure and raw causes stay server-side.
- Confirmed all product validation consumers hold the product lock until their
  write transaction commits, and every direct deactivation/reassignment path
  uses the same key convention.
- Confirmed process dedup and schedule conflict reads occur after their scoped
  advisory locks and before inserts in the same transaction.
- Confirmed notification/provider test doubles were used throughout; no real
  AWS/SES/DocuSign request was made.
- Confirmed all test runners used at most two workers and heavy commands were
  sequential.
- Confirmed `PROJECT-OVERVIEW.md` remains an untracked user file and was neither
  edited nor staged.

## Commit

Implementation commit: `08f643747010be92190156acb4ed46c20e862014`.

The report itself is committed as its immediate successor, following the prior
wave's implementation/report convention.

## Remaining concerns

1. The frontend build still emits the pre-existing warning for a JavaScript
   chunk larger than 500 kB; the build succeeds.
2. Automatic compensation necessarily performs a provider status read and
   possible void while holding a database advisory lock. This favors integrity
   over throughput and may hold the process-scoped lock for the provider
   timeout, but it prevents the reviewed compensation race.

---

# Second-review follow-up — third integrity wave (2026-09-04)

This section supersedes the preceding readiness statement. The second
independent review in `second-fix-review-findings.md` returned `NOT READY` for
`08f6437`; all seven Important and both Minor/test-integrity findings were
verified against the code and addressed in one follow-up from `dfb21b7`.

## Technical resolution

1. **Cross-request provider recovery.** Both public contract DTOs now require a
   caller-owned UUID v4 `operation_id`. The real page creates one UUID, retains
   it across failed preview requests, passes it unchanged as the DocuSign
   `transactionId`, and clears it only after confirmed send or discard.
   `DocuSignService` queries envelopes by exact transaction id before POST,
   recovers after a lost POST response, avoids a second POST when one match
   exists, and produces stable manual reconciliation for zero/ambiguous
   post-failure results or multiple pre-existing matches.
2. **Known external effects before later work.** Provider preflight status is
   registered as `DRAFT_CONFIRMED` or `SEND_CONFIRMED` immediately after the
   status response and before local validations or another provider call.
   Known sent-or-beyond effects never enter automatic draft compensation.
3. **Advanced state preservation.** `sendDraftEnvelope` returns the actual
   `SENT`, `DELIVERED`, or `COMPLETED` status. Persistence maps that exact
   provider status; `COMPLETED` creates a `SIGNED` contract with `signed_at`, a
   completed process and history, while sent/delivered move the process to
   `DOCUMENTATION`. The HTTP result reflects the persisted contract state.
4. **Stable cleanup reconciliation.** Failed or ambiguous void of a stale or
   losing draft retains process/envelope/correlation context and returns
   `CONTRACT_MANUAL_RECONCILIATION_REQUIRED`. The page keeps its real modal and
   operation state on send or cancellation failure.
5. **One dedup invariant for every producer.** A shared
   `process-dedup:<client>:<specialist>:<product-or-consultancy>` transaction
   lock and post-lock active-process recheck protects public process creation,
   on-behalf creation, direct appointment creation, pending appointment
   creation, and legacy process creation during pending confirmation. Product,
   dedup and schedule locks use one consistent acquisition order.
6. **One schedule invariant for every time writer.** Direct create,
   `confirmPending`, `registerCalendlyScheduled`, and the Calendly
   `invitee.created` webhook acquire
   `appointment-schedule:<specialistId>`, re-read mutable appointment state,
   and recheck overlapping pending/scheduled appointments inside the write
   transaction.
7. **Iframe message trust boundary.** The modal accepts messages only when
   `event.source` is the rendered iframe window and `event.origin` exactly
   equals the parsed preview URL origin over HTTPS on an exact DocuSign domain
   or dot-delimited subdomain. Suffix attacks and unrelated windows are
   ignored; trusted send/cancel messages still work.
8. **404 preservation.** Car, boat and aircraft removal rethrow the shared
   helper's `NotFoundException` instead of wrapping it as a generic 500.
9. **PII-safe operations.** DocuSign request bodies, DocGen values, sender-view
   bodies, response bodies, form payloads, void reasons, raw notification
   failures, webhook payloads, raw causes and stacks were removed from logs.
   Operational logs keep only safe ids, counts, status and error type.

## RED evidence

All commands were prefixed with `rtk`; Jest used `--runInBand` and Vitest used
at most two workers. Provider collaborators were mocks, and no real provider
was invoked.

- `cd backend && rtk npm test -- --runInBand src/providers/docusign/docusign.service.spec.ts`
  — RED: 7 failed, 6 passed. Missing transaction recovery, ambiguity handling
  and advanced-state preservation were observed.
- `cd backend && rtk npm test -- --runInBand src/features/contracts/contracts.service.spec.ts`
  — RED: 6 failed, 33 passed. Known effects were not retained early enough,
  advanced provider states were downgraded, and failed stale void lost the
  required reconciliation semantics.
- `cd frontend && rtk npm test -- src/components/contracts/DocuSignPreviewModal.test.tsx src/pages/specialist/CreateContractPage.test.tsx --maxWorkers=2`
  — RED: 2 failed, 4 passed. A suffix origin/wrong source could trigger modal
  actions and public retry did not retain one operation id.
- Focused removal/client privacy tests — RED: 6 expected failures before 404
  preservation and request-payload log redaction.
- `cd backend && rtk npm test -- --runInBand src/features/appointments/appointments.service.spec.ts src/features/processes/processes.service.spec.ts`
  — RED: 8 failed, 44 passed before shared producer locks/rechecks.
- PostgreSQL dedup race spec — RED: 2 failed, 1 passed before public and
  cross-entrypoint creation shared the advisory key.
- PostgreSQL appointment race spec — RED: 3 failed, 1 passed before direct,
  confirmation and Calendly writers shared the schedule key.
- `cd backend && rtk npm test -- --runInBand src/features/appointments/calendly-integration.service.spec.ts`
  — RED: 1 failed because `invitee.created` performed zero transactions; GREEN
  became 1/1 after extending the same schedule invariant to that writer.

Two test-contract adjustments were made after implementation: DTO fixtures
were updated with the newly required operation UUID, and an obsolete
PostgreSQL assertion expecting `PROCESSING_CONTRACT` after provider `SENT` was
updated to the existing webhook-consistent `DOCUMENTATION`. A legacy test that
required raw provider/database messages in server logs was corrected to assert
redacted error types, matching the explicit PII requirement.

## Final GREEN evidence

- Backend focused unit/regression matrix:
  `cd backend && rtk npm test -- --runInBand src/features/contracts/contracts.service.spec.ts src/providers/docusign/docusign.service.spec.ts src/providers/docusign/docusign.client.spec.ts src/features/appointments/appointments.service.spec.ts src/features/appointments/calendly-integration.service.spec.ts src/features/processes/processes.service.spec.ts src/features/products/product-removal-not-found.spec.ts src/features/contracts/dto/preview-contract.dto.spec.ts src/features/proposals/proposals.service.spec.ts src/features/proposals/proposal-money.spec.ts`
  — 10 suites, 165/165 passed.
- Deterministic PostgreSQL matrix with
  `POSTGRES_CONCURRENCY_TEST_URL='postgresql://user:password@127.0.0.1:5432/highclass_task8?schema=public'`:
  `rtk npm test -- --runInBand src/features/contracts/contracts-lock.postgres.spec.ts src/features/products/product-association-concurrency.postgres.spec.ts src/features/products/product-monetary-lock.postgres.spec.ts src/features/processes/processes-dedup-concurrency.postgres.spec.ts src/features/appointments/appointments-concurrency.postgres.spec.ts src/features/proposals/proposals-concurrency.postgres.spec.ts`
  — 6 suites, 15/15 passed.
- Frontend cancellation/modal/page matrix:
  `cd frontend && rtk npm test -- src/lib/contract-preview-cancellation.test.ts src/components/contracts/DocuSignPreviewModal.test.tsx src/pages/specialist/CreateContractPage.test.tsx --maxWorkers=2`
  — 3 suites, 11/11 passed.
- `cd backend && rtk npm run build` — passed.
- `cd frontend && rtk npm run build` — passed; only the pre-existing Vite
  warning for a JavaScript chunk larger than 500 kB remains.
- `rtk git diff --check` — clean.

## Self-review

- Traced every `process.create` producer and confirmed the post-lock active
  query occurs in its write transaction; confirmed every scheduled-time writer
  uses the shared specialist schedule key and conflict semantics.
- Checked provider effect ordering around preflight, create recovery, send,
  persistence failure, lost COMMIT acknowledgement and stale/losing void.
  Definitive advanced states are preserved; uncertain effects always retain a
  stable operation/envelope reconciliation handle.
- Rechecked iframe hostname boundaries, exact origin equality and iframe source
  identity, including attacker suffixes and trusted send/cancel behavior.
- Searched DocuSign/contract operational logging for request/form/DocGen values
  and removed remaining raw payload/error paths; focused tests assert secrets
  and raw causes do not reach logs.
- Confirmed all database tests used the named local PostgreSQL container, every
  external provider was mocked, all heavy commands were sequential, and no
  runner exceeded two workers.
- Confirmed `PROJECT-OVERVIEW.md` remains the same untracked user file and was
  neither edited nor staged.

## Remaining concerns

1. The frontend production build retains its pre-existing chunk-size warning;
   it does not fail the build.
2. Transaction-id recovery depends on DocuSign's transaction-id lookup
   availability. An unavailable or ambiguous lookup deliberately returns the
   stable manual-reconciliation response instead of risking a duplicate POST.
