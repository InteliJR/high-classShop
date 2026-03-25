-- AlterTable
ALTER TABLE "MeetingSession"
ADD COLUMN "ended_by_id" UUID,
ADD COLUMN "ended_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MeetingSession_ended_by_id_idx" ON "MeetingSession"("ended_by_id");

-- CreateIndex
CREATE INDEX "MeetingSession_ended_at_idx" ON "MeetingSession"("ended_at");

-- AddForeignKey
ALTER TABLE "MeetingSession"
ADD CONSTRAINT "MeetingSession_ended_by_id_fkey"
FOREIGN KEY ("ended_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
