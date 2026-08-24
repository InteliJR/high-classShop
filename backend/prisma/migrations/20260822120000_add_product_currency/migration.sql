-- CreateEnum
CREATE TYPE "ProductCurrency" AS ENUM ('BRL', 'USD');

-- Existing products are priced in reais. New products may opt into USD.
ALTER TABLE "Car" ADD COLUMN "currency" "ProductCurrency" NOT NULL DEFAULT 'BRL';
ALTER TABLE "Boat" ADD COLUMN "currency" "ProductCurrency" NOT NULL DEFAULT 'BRL';
ALTER TABLE "Aircraft" ADD COLUMN "currency" "ProductCurrency" NOT NULL DEFAULT 'BRL';
