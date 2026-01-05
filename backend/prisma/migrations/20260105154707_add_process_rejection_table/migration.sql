-- AlterEnum
ALTER TYPE "ProcessStatus" ADD VALUE 'REJECTED';

-- CreateTable
CREATE TABLE "ProcessRejection" (
    "id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "rejected_by_id" UUID NOT NULL,
    "rejection_reason" TEXT NOT NULL,
    "rejected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessRejection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessRejection_process_id_idx" ON "ProcessRejection"("process_id");

-- CreateIndex
CREATE INDEX "ProcessRejection_rejected_by_id_idx" ON "ProcessRejection"("rejected_by_id");

-- CreateIndex
CREATE INDEX "ProcessRejection_rejected_at_idx" ON "ProcessRejection"("rejected_at");

-- AddForeignKey
ALTER TABLE "ProcessRejection" ADD CONSTRAINT "ProcessRejection_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRejection" ADD CONSTRAINT "ProcessRejection_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
