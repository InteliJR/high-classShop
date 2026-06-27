-- Additive migration for Google Meet OAuth integration (plataforma host único)
-- Safe for existing data: only adds new tables (nenhuma coluna em tabelas existentes)

CREATE TABLE IF NOT EXISTS "GoogleMeetConnection" (
  "id" UUID NOT NULL,
  "connected_by_id" UUID,
  "google_email" TEXT NOT NULL,
  "access_token_encrypted" TEXT NOT NULL,
  "refresh_token_encrypted" TEXT NOT NULL,
  "token_type" TEXT NOT NULL DEFAULT 'Bearer',
  "scope" TEXT,
  "expires_at" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GoogleMeetConnection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GoogleMeetConnection_is_active_idx"
  ON "GoogleMeetConnection"("is_active");
CREATE INDEX IF NOT EXISTS "GoogleMeetConnection_connected_by_id_idx"
  ON "GoogleMeetConnection"("connected_by_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GoogleMeetConnection_connected_by_id_fkey'
  ) THEN
    ALTER TABLE "GoogleMeetConnection"
      ADD CONSTRAINT "GoogleMeetConnection_connected_by_id_fkey"
      FOREIGN KEY ("connected_by_id") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "GoogleMeetOauthState" (
  "id" UUID NOT NULL,
  "admin_id" UUID NOT NULL,
  "state" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GoogleMeetOauthState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GoogleMeetOauthState_state_key"
  ON "GoogleMeetOauthState"("state");
CREATE INDEX IF NOT EXISTS "GoogleMeetOauthState_expires_at_idx"
  ON "GoogleMeetOauthState"("expires_at");
