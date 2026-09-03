-- Existing legacy rows are not validated here because the historical migration
-- chain has known drift. PostgreSQL still enforces NOT VALID checks for every
-- new or updated row.
ALTER TABLE "Process"
ADD CONSTRAINT "Process_product_association_pair_check"
CHECK (
  ("product_type" IS NULL AND "car_id" IS NULL AND "boat_id" IS NULL AND "aircraft_id" IS NULL)
  OR ("product_type" = 'CAR' AND "car_id" IS NOT NULL AND "boat_id" IS NULL AND "aircraft_id" IS NULL)
  OR ("product_type" = 'BOAT' AND "boat_id" IS NOT NULL AND "car_id" IS NULL AND "aircraft_id" IS NULL)
  OR ("product_type" = 'AIRCRAFT' AND "aircraft_id" IS NOT NULL AND "car_id" IS NULL AND "boat_id" IS NULL)
) NOT VALID;

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_product_association_pair_check"
CHECK (
  ("product_type" IS NULL AND "product_id" IS NULL)
  OR ("product_type" IS NOT NULL AND "product_id" IS NOT NULL)
) NOT VALID;
