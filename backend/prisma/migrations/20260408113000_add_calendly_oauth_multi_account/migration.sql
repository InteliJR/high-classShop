-- Additive migration for per-specialist Calendly OAuth integration
-- Safe for existing data: only adds nullable columns and new tables

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "calendly_user_uri" TEXT,
ADD COLUMN IF NOT EXISTS "calendly_organization_uri" TEXT;

CREATE TABLE IF NOT EXISTS "CalendlyConnection" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "access_token_encrypted" TEXT NOT NULL,
  "refresh_token_encrypted" TEXT NOT NULL,
  "token_type" TEXT NOT NULL DEFAULT 'Bearer',
  "scope" TEXT,
  "expires_at" TIMESTAMP(3),
  "calendly_user_uri" TEXT NOT NULL,
  "calendly_organization_uri" TEXT,
  "webhook_uri" TEXT,
  "webhook_subscription_uri" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_sync_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CalendlyConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CalendlyConnection_user_id_key"
  ON "CalendlyConnection"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "CalendlyConnection_calendly_user_uri_key"
  ON "CalendlyConnection"("calendly_user_uri");
CREATE INDEX IF NOT EXISTS "CalendlyConnection_user_id_idx"
  ON "CalendlyConnection"("user_id");
CREATE INDEX IF NOT EXISTS "CalendlyConnection_is_active_idx"
  ON "CalendlyConnection"("is_active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CalendlyConnection_user_id_fkey'
  ) THEN
    ALTER TABLE "CalendlyConnection"
      ADD CONSTRAINT "CalendlyConnection_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CalendlyOauthState" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "state" TEXT NOT NULL,
  "code_verifier" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CalendlyOauthState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CalendlyOauthState_state_key"
  ON "CalendlyOauthState"("state");
CREATE INDEX IF NOT EXISTS "CalendlyOauthState_user_id_idx"
  ON "CalendlyOauthState"("user_id");
CREATE INDEX IF NOT EXISTS "CalendlyOauthState_expires_at_idx"
  ON "CalendlyOauthState"("expires_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CalendlyOauthState_user_id_fkey'
  ) THEN
    ALTER TABLE "CalendlyOauthState"
      ADD CONSTRAINT "CalendlyOauthState_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
