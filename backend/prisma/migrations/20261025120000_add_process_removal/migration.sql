ALTER TABLE "Process"
  ADD COLUMN "removed_at" TIMESTAMP(3),
  ADD COLUMN "removed_by" UUID,
  ADD COLUMN "removal_reason" VARCHAR(1000);

CREATE INDEX "Process_removed_at_idx" ON "Process"("removed_at");
