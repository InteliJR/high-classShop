# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Run everything (recommended)
```bash
npm run install:all  # install root + frontend + backend deps (first time)
npm run dev          # starts backend + frontend concurrently
```

### Backend only
```bash
cd backend
npm run start:dev          # watch mode
npm run start:debug        # watch mode + node --inspect
npm run build              # production build (nest build + tsc-alias)
npm run lint               # eslint --fix
npm run format             # prettier on src + test
npm test                   # jest unit tests (files: *.spec.ts)
npm test -- <pattern>      # run a single test file (e.g. `npm test -- contracts.service`)
npx jest -t "<test name>"  # run a single test by name
npm run test:e2e           # jest --config ./test/jest-e2e.json
npm run test:cov           # coverage report
npm run seed               # run prisma/seed.ts
```

### Frontend only
```bash
cd frontend
npm run dev          # vite dev server → http://localhost:5173
npm run build        # tsc -b && vite build
npm run lint         # eslint
```

### Database
```bash
cd backend
npx prisma migrate dev          # apply migrations (local dev)
npx prisma db push              # push schema without migration (production/Supabase)
npx prisma studio               # GUI at localhost:5555
```

### Local infra
```bash
docker compose up -d db         # start only PostgreSQL
docker compose up --build -d    # full stack via Docker
```

## Architecture

### Monorepo layout
```
backend/   NestJS API — prefix /api
frontend/  React + Vite + TypeScript
docs/      Docusaurus site (intelijr.github.io/high-classShop)
ai/        AI/dev context files + implementation plans
```

### Backend (`backend/src/`)

Global setup in `main.ts` + `app.module.ts`:
- JWT auth guard applied globally; bypass with `@Public()` decorator
- Role guard via `@Roles()` + `roles.guard.ts`
- Prisma exception filter normalises DB errors
- CORS with credentials enabled

Feature modules live in `backend/src/features/` — one folder per domain:
- **Products**: `cars/`, `boats/`, `aircrafts/` — CRUD, CSV import (async job), Google Drive image import
- **Actors**: `users/`, `consultants/` (admin CRUD), `consultant/` (advisor wallet), `specialists/`, `companies/`
- **Sales flow**: `processes/` → `appointments/` → `proposals/` → `contracts/` → `meetings/`
- **Support**: `dashboard/`, `settings/`, `platform-company/`, `notifications/`, `product-import-jobs/`

External integrations:
- `backend/src/providers/docusign/` — assinatura digital. Env vars: `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_PRIVATE_KEY`, `DOCUSIGN_ENV`, `DOCUSIGN_WEBHOOK_SECRET`, `DOCUSIGN_TEMPLATE_ID`. Setup local exige PEM + JWT — Messias-Olivindo é a referência.
- `backend/src/aws/` — S3 (imagens de produto) + SES (e-mails). Compatível com Cloudflare R2 via `AWS_ENDPOINT` + `forcePathStyle: true`.
- `backend/src/features/appointments/` (Calendly) — OAuth 2.0 + webhook. Tokens armazenados criptografados em `CalendlyConnection`. Env vars: `CALENDLY_OAUTH_CLIENT_ID`, `CALENDLY_OAUTH_CLIENT_SECRET`, `CALENDLY_OAUTH_REDIRECT_URI`, `CALENDLY_TOKEN_ENCRYPTION_KEY`, `CALENDLY_WEBHOOK_CALLBACK_URL`, `CALENDLY_WEBHOOK_SIGNING_KEY`.
- `backend/src/features/meetings/` — videoconferência. Provedor selecionável via `MEETING_PROVIDER`; suporta Google Meet (atual) e Jitsi. Env: `JITSI_BASE_URL`, `MEETING_DEMO_FALLBACK_ENABLED`.
- `backend/src/features/drive-import/` — Google Drive (import de imagens em lote). Env: `GOOGLE_DRIVE_API_KEY`.

#### Process state machine
```
SCHEDULING → NEGOTIATION → PROCESSING_CONTRACT → DOCUMENTATION → COMPLETED | REJECTED
```
`ProcessesModule` orchestrates transitions; each step has its own module.

#### Auth flow
- Login returns `access_token` (Bearer) + sets `refresh_token` in httpOnly cookie
- Refresh: `POST /api/auth/refresh` — client uses cookie, gets new access token
- Four JWT secrets: `JWT_SECRET_ACCESS`, `JWT_SECRET_REFRESH`, `JWT_SECRET_REFERRAL`, `JWT_SECRET_ADVISOR`

#### Notifications (SES)
All email sends are fire-and-forget via `setImmediate()` inside `NotificationService`. Circuit breaker: 5 failures → 60s cutoff. Templates in `backend/src/features/notifications/notification.service.ts`.

#### S3 / Cloudflare R2
Compatible via `AWS_ENDPOINT` + `forcePathStyle: true`. Drive import does full replacement: `deleteAllProductImages()` (batch S3 delete + Prisma `deleteMany`) before inserting new images.

### Frontend (`frontend/src/`)

Entry: `main.tsx` → `RouterProvider` wraps everything; `AuthProvider` + `CookiesProvider` at root.

**Routing** (`routes/routes.tsx`): role-based redirects in `ProtectedRoute.tsx`
- `CUSTOMER` → `/catalog/cars`
- `CONSULTANT` → `/consultant/dashboard`
- `SPECIALIST` → `/specialist/dashboard`
- `ADMIN` → `/admin/dashboard`

**State**: Zustand store in `store/authStateManager.ts` — persists `accessToken` + `user` to localStorage.

**API layer** (`services/api.ts`): axios instance pointing at `VITE_API_BASE_URL`. Interceptors:
- Request: injects Bearer token
- Response 401: auto-refresh token (single in-flight dedup), then retries original request
- Error enrichment: adds `err.friendlyMessage` for 400/401/403/404/409/5xx

**Page structure** (`pages/`): folders by role — `admin/`, `specialist/`, `consultant/`, `customer/`, `advisor/`, `catalog/`, `meetings/`, `negotiation/`, `profile/`, `landing-page/`, `auth/`.

## Known inconsistencies (do not fix without coordinating)

- Supabase production DB has schema drift vs migrations — use `prisma db push` for additive changes in prod; never `migrate deploy` against prod without verifying
- `CustomerAdvisor.customer_id` is `@unique` — one advisor/invite per customer; re-invite uses `upsert`

## Environment setup

Copy `backend/.env.example` to `backend/.env`. Minimum required for local dev:
- `DATABASE_URL` / `DIRECT_URL`
- `JWT_SECRET_ACCESS`, `JWT_SECRET_REFRESH`, `JWT_SECRET_REFERRAL`, `JWT_SECRET_ADVISOR`
- `FRONTEND_URL` (default `http://localhost:5173`)

Frontend env var: `VITE_API_BASE_URL` (defaults to `http://localhost:3000/api/`).

## Documentation

- Full endpoint reference + payloads: `architecture.md`
- Frontend ↔ Backend integration guide: `frontend-integration-guide.md`
- AI/dev context (stack, schema, integrations, env vars): `ai/contexts/`
- Bug history + fix log: `ai/contexts/known-issues.md`
- Architecture decisions (ADRs): `ai/decisoes/`
- Domain glossary: `ai/instrucoes/glossario.md`
- Technical deep dives (SPIKEs, comparativos): `ai/notas-tecnicas/`
- Implementation plans + planejamento (input do cliente): `ai/_private/plan/`, `ai/_private/planejamento/` — **conteúdo privado, não versionado**. Acesso via Drive/Discord do squad.

## CI / PR workflow

- `.github/workflows/restrict_prs.yml` — guarda restrições de merge.
- `.github/workflows/deploy_docusaurus.yml` — deploy automático da documentação em `docs/` para `intelijr.github.io/high-classShop`.
