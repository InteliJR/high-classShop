-- AlterTable
ALTER TABLE "Car"
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "deactivated_at" TIMESTAMP(3),
ADD COLUMN "deactivated_by_sync_job_id" UUID;

-- AlterTable
ALTER TABLE "Boat"
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "deactivated_at" TIMESTAMP(3),
ADD COLUMN "deactivated_by_sync_job_id" UUID;

-- AlterTable
ALTER TABLE "Aircraft"
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "deactivated_at" TIMESTAMP(3),
ADD COLUMN "deactivated_by_sync_job_id" UUID;

-- AlterTable
ALTER TABLE "ProductImportJob"
ADD COLUMN "deactivated_items" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reactivated_items" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "deactivated_product_ids" JSONB;

-- CreateIndex
CREATE INDEX "Car_specialist_id_is_active_idx" ON "Car"("specialist_id", "is_active");

-- CreateIndex
CREATE INDEX "Boat_specialist_id_is_active_idx" ON "Boat"("specialist_id", "is_active");

-- CreateIndex
CREATE INDEX "Aircraft_specialist_id_is_active_idx" ON "Aircraft"("specialist_id", "is_active");
