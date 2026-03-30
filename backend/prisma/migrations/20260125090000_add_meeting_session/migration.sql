-- CreateTable
CREATE TABLE "MeetingSession" (
    "id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "calendar_event_id" TEXT NOT NULL,
    "meet_link" TEXT NOT NULL,
    "started_by_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingSession_process_id_key" ON "MeetingSession"("process_id");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingSession_calendar_event_id_key" ON "MeetingSession"("calendar_event_id");

-- CreateIndex
CREATE INDEX "MeetingSession_started_by_id_idx" ON "MeetingSession"("started_by_id");

-- CreateIndex
CREATE INDEX "MeetingSession_started_at_idx" ON "MeetingSession"("started_at");

-- AddForeignKey
ALTER TABLE "MeetingSession" ADD CONSTRAINT "MeetingSession_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingSession" ADD CONSTRAINT "MeetingSession_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
