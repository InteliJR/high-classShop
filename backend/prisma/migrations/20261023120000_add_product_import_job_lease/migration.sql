ALTER TABLE "ProductImportJob"
ADD COLUMN "processing_lease_token" UUID,
ADD COLUMN "processing_lease_expires_at" TIMESTAMP(3);

CREATE INDEX "ProductImportJob_status_processing_lease_expires_at_idx"
ON "ProductImportJob"("status", "processing_lease_expires_at");
