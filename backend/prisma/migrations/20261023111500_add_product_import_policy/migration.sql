ALTER TABLE "ProductImportJob"
    ADD COLUMN "created_by_id" UUID,
    ADD COLUMN "mode" VARCHAR(20) NOT NULL DEFAULT 'ADDITIVE',
    ADD COLUMN "sync_confirmed" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ProductImportJob_created_by_id_idx"
    ON "ProductImportJob"("created_by_id");

ALTER TABLE "ProductImportJob"
    ADD CONSTRAINT "ProductImportJob_mode_check"
    CHECK ("mode" IN ('ADDITIVE', 'SYNCHRONIZE'));
