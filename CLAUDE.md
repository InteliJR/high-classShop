# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Run everything (recommended)
```bash
npm run dev          # starts backend + frontend concurrently
```

### Backend only
```bash
cd backend
npm run start:dev    # watch mode
npm run build        # production build (nest build + tsc-alias)
npm run lint         # eslint --fix
npm test             # jest unit tests (files: *.spec.ts)
npm run test:e2e     # jest --config ./test/jest-e2e.json
npm run test:cov     # coverage report
npm run seed         # run prisma/seed.ts
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

External integrations encapsulated in `backend/src/providers/docusign/` and `backend/src/aws/` (S3 + SES).

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

- `GET /contracts` and `GET /contracts/:id` don't exist in backend — frontend calls them
- `/aircraft` vs `/aircrafts` route naming inconsistency in some frontend files
- Some backend responses use `"sucess"` (typo) — changing breaks existing clients
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
- AI/dev context (stack, schema, integrations, env vars): `ai/contexts/`
- Bug history + fix log: `ai/contexts/known-issues.md`
- Implementation plans: `ai/plan/`
