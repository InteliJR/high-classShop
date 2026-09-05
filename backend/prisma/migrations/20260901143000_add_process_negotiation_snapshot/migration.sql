ALTER TABLE "Process"
  ADD COLUMN "negotiation_currency" "ProductCurrency",
  ADD COLUMN "negotiation_product_value" DECIMAL(15,2);

UPDATE "Process" AS p
SET
  "negotiation_product_value" = CASE p."product_type"
    WHEN 'CAR' THEN (SELECT c."valor" FROM "Car" c WHERE c."id" = p."car_id")
    WHEN 'BOAT' THEN (SELECT b."valor" FROM "Boat" b WHERE b."id" = p."boat_id")
    WHEN 'AIRCRAFT' THEN (SELECT a."valor" FROM "Aircraft" a WHERE a."id" = p."aircraft_id")
  END,
  "negotiation_currency" = CASE p."product_type"
    WHEN 'CAR' THEN (SELECT c."currency" FROM "Car" c WHERE c."id" = p."car_id")
    WHEN 'BOAT' THEN (SELECT b."currency" FROM "Boat" b WHERE b."id" = p."boat_id")
    WHEN 'AIRCRAFT' THEN (SELECT a."currency" FROM "Aircraft" a WHERE a."id" = p."aircraft_id")
  END
WHERE
  (
    p."status" IN ('NEGOTIATION', 'PROCESSING_CONTRACT', 'DOCUMENTATION', 'COMPLETED')
    OR (
      p."status" = 'REJECTED'
      AND EXISTS (
        SELECT 1 FROM "NegotiationProposal" np WHERE np."process_id" = p."id"
      )
    )
  )
  AND (
    (p."product_type" = 'CAR' AND p."car_id" IS NOT NULL)
    OR (p."product_type" = 'BOAT' AND p."boat_id" IS NOT NULL)
    OR (p."product_type" = 'AIRCRAFT' AND p."aircraft_id" IS NOT NULL)
  );

ALTER TABLE "Process"
  ADD CONSTRAINT "Process_negotiation_snapshot_complete"
  CHECK (
    ("negotiation_currency" IS NULL AND "negotiation_product_value" IS NULL)
    OR
    ("negotiation_currency" IS NOT NULL AND "negotiation_product_value" IS NOT NULL)
  );
