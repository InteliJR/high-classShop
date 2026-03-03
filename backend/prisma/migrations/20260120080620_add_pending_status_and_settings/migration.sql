-- Add PENDING value to StatusAgendamento enum
-- Note: In PostgreSQL, new enum values must be committed before being used as defaults
ALTER TYPE "StatusAgendamento" ADD VALUE IF NOT EXISTS 'pending';

-- CreateTable Settings first (no dependency on enum)
CREATE TABLE IF NOT EXISTS "Settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Settings_key_key" ON "Settings"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Settings_key_idx" ON "Settings"("key");

-- AlterTable - Add new columns to Appointment (without changing default yet)
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "confirmed_by_id" UUID,
ADD COLUMN IF NOT EXISTS "pending_expires_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "user_clicked_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Make appointment_datetime nullable
ALTER TABLE "Appointment" ALTER COLUMN "appointment_datetime" DROP NOT NULL;

-- Insert default settings
INSERT INTO "Settings" ("id", "key", "value", "description", "created_at", "updated_at")
VALUES 
  (gen_random_uuid(), 'minimum_proposal_enabled', 'true', 'Ativa validação de valor mínimo em propostas de negociação', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'minimum_proposal_percentage', '0.8', 'Porcentagem mínima do valor do produto para propostas (0.8 = 80%)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;
