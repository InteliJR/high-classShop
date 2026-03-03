/*
  Warnings:

  - A unique constraint covering the columns `[accepted_proposal_id]` on the table `Process` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED');

-- AlterTable
ALTER TABLE "Process" ADD COLUMN     "accepted_proposal_id" UUID;

-- CreateTable
CREATE TABLE "NegotiationProposal" (
    "id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "proposed_by_id" UUID NOT NULL,
    "proposed_to_id" UUID NOT NULL,
    "proposed_value" DECIMAL(15,2) NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "message" VARCHAR(500),
    "counter_to_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NegotiationProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NegotiationProposal_process_id_idx" ON "NegotiationProposal"("process_id");

-- CreateIndex
CREATE INDEX "NegotiationProposal_proposed_by_id_idx" ON "NegotiationProposal"("proposed_by_id");

-- CreateIndex
CREATE INDEX "NegotiationProposal_proposed_to_id_idx" ON "NegotiationProposal"("proposed_to_id");

-- CreateIndex
CREATE INDEX "NegotiationProposal_status_idx" ON "NegotiationProposal"("status");

-- CreateIndex
CREATE INDEX "NegotiationProposal_created_at_idx" ON "NegotiationProposal"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Process_accepted_proposal_id_key" ON "Process"("accepted_proposal_id");

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_accepted_proposal_id_fkey" FOREIGN KEY ("accepted_proposal_id") REFERENCES "NegotiationProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationProposal" ADD CONSTRAINT "NegotiationProposal_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationProposal" ADD CONSTRAINT "NegotiationProposal_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationProposal" ADD CONSTRAINT "NegotiationProposal_proposed_to_id_fkey" FOREIGN KEY ("proposed_to_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationProposal" ADD CONSTRAINT "NegotiationProposal_counter_to_id_fkey" FOREIGN KEY ("counter_to_id") REFERENCES "NegotiationProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
