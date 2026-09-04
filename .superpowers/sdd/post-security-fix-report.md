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
