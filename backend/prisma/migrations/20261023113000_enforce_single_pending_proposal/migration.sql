CREATE UNIQUE INDEX "NegotiationProposal_one_pending_per_process_idx"
    ON "NegotiationProposal"("process_id")
    WHERE "status" = 'PENDING';
