UPDATE "Settings"
SET
  "value" = 'false',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'minimum_proposal_enabled';
