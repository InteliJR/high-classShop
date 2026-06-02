-- Migration: OFFICE role + soft-delete consultor + ConsultantInviteJob (batch CSV)
-- Aplicar em produção via `prisma db push` (não destrutivo, ver CLAUDE.md)

-- ─── UserRole: adicionar OFFICE ─────────────────────────────────────────────
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'OFFICE';

-- ─── User: soft-delete consultor ────────────────────────────────────────────
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "is_active"      BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "deactivated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deactivated_by" UUID;

-- ─── Constraint: 1 OFFICE por Company (índice parcial) ─────────────────────
-- Garante que cada Company tenha no máximo 1 gerente OFFICE.
CREATE UNIQUE INDEX IF NOT EXISTS "one_office_per_company"
  ON "User" ("company_id")
  WHERE "role" = 'OFFICE' AND "company_id" IS NOT NULL;

-- ─── Enums novos ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "ConsultantInviteJobStatus" AS ENUM (
    'PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ConsultantInviteItemStatus" AS ENUM (
    'PENDING', 'PROCESSING', 'SENT', 'ACCEPTED', 'FAILED', 'DUPLICATE'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── ConsultantInviteJob ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ConsultantInviteJob" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id"     UUID NOT NULL,
  "created_by"     UUID NOT NULL,
  "status"          "ConsultantInviteJobStatus" NOT NULL DEFAULT 'PENDING',
  "total_items"    INTEGER NOT NULL DEFAULT 0,
  "processed_items" INTEGER NOT NULL DEFAULT 0,
  "success_items"  INTEGER NOT NULL DEFAULT 0,
  "failed_items"   INTEGER NOT NULL DEFAULT 0,
  "duplicate_items" INTEGER NOT NULL DEFAULT 0,
  "started_at"     TIMESTAMP(3),
  "finished_at"    TIMESTAMP(3),
  "error_message"  TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConsultantInviteJob_company_fk"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "ConsultantInviteJob_creator_fk"
    FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ConsultantInviteJob_company_idx"    ON "ConsultantInviteJob"("company_id");
CREATE INDEX IF NOT EXISTS "ConsultantInviteJob_created_by_idx" ON "ConsultantInviteJob"("created_by");
CREATE INDEX IF NOT EXISTS "ConsultantInviteJob_status_idx"     ON "ConsultantInviteJob"("status");
CREATE INDEX IF NOT EXISTS "ConsultantInviteJob_created_idx"    ON "ConsultantInviteJob"("created_at");

-- ─── ConsultantInviteJobItem ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ConsultantInviteJobItem" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_id"         UUID NOT NULL,
  "row_number"     INTEGER NOT NULL,
  "name"           TEXT NOT NULL,
  "email"          TEXT NOT NULL,
  "status"         "ConsultantInviteItemStatus" NOT NULL DEFAULT 'PENDING',
  "token"          TEXT UNIQUE,
  "consultant_id"  UUID,
  "error_message"  TEXT,
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "processed_at"   TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConsultantInviteJobItem_job_fk"
    FOREIGN KEY ("job_id") REFERENCES "ConsultantInviteJob"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ConsultantInviteJobItem_job_idx"    ON "ConsultantInviteJobItem"("job_id");
CREATE INDEX IF NOT EXISTS "ConsultantInviteJobItem_status_idx" ON "ConsultantInviteJobItem"("status");
CREATE INDEX IF NOT EXISTS "ConsultantInviteJobItem_email_idx"  ON "ConsultantInviteJobItem"("email");
