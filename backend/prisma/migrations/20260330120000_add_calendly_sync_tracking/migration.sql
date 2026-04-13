-- CreateEnum
CREATE TYPE "CalendlySyncStatus" AS ENUM ('pending', 'synced', 'failed');

-- AlterTable
ALTER TABLE "Appointment"
ADD COLUMN "calendly_event_uri" VARCHAR(255),
ADD COLUMN "calendly_invitee_uri" VARCHAR(255),
ADD COLUMN "calendly_scheduled_at" TIMESTAMP(3),
ADD COLUMN "calendly_last_sync_at" TIMESTAMP(3),
ADD COLUMN "calendly_sync_status" "CalendlySyncStatus" NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "Appointment_calendly_event_uri_idx" ON "Appointment"("calendly_event_uri");

-- CreateIndex
CREATE INDEX "Appointment_calendly_sync_status_idx" ON "Appointment"("calendly_sync_status");
