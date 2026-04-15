-- CreateEnum
CREATE TYPE "ProductImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

-- CreateEnum
CREATE TYPE "ProductImportItemStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED');

-- CreateTable
CREATE TABLE "ProductImportJob" (
    "id" UUID NOT NULL,
    "product_type" "ProductType" NOT NULL,
    "specialist_id" UUID NOT NULL,
    "status" "ProductImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "processed_items" INTEGER NOT NULL DEFAULT 0,
    "success_items" INTEGER NOT NULL DEFAULT 0,
    "warning_items" INTEGER NOT NULL DEFAULT 0,
    "failed_items" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImportJobItem" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "status" "ProductImportItemStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "folder_url" TEXT,
    "product_id" INTEGER,
    "action" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "warnings" JSONB,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductImportJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductImportJob_specialist_id_idx" ON "ProductImportJob"("specialist_id");

-- CreateIndex
CREATE INDEX "ProductImportJob_status_idx" ON "ProductImportJob"("status");

-- CreateIndex
CREATE INDEX "ProductImportJob_product_type_idx" ON "ProductImportJob"("product_type");

-- CreateIndex
CREATE INDEX "ProductImportJob_created_at_idx" ON "ProductImportJob"("created_at");

-- CreateIndex
CREATE INDEX "ProductImportJobItem_job_id_idx" ON "ProductImportJobItem"("job_id");

-- CreateIndex
CREATE INDEX "ProductImportJobItem_status_idx" ON "ProductImportJobItem"("status");

-- CreateIndex
CREATE INDEX "ProductImportJobItem_row_number_idx" ON "ProductImportJobItem"("row_number");

-- AddForeignKey
ALTER TABLE "ProductImportJob" ADD CONSTRAINT "ProductImportJob_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImportJobItem" ADD CONSTRAINT "ProductImportJobItem_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "ProductImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
