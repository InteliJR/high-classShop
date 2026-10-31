-- Importação mínima (issue #254): produto pode ser cadastrado sem ano.
ALTER TABLE "Car" ALTER COLUMN "ano" DROP NOT NULL;
ALTER TABLE "Boat" ALTER COLUMN "ano" DROP NOT NULL;
ALTER TABLE "Aircraft" ALTER COLUMN "ano" DROP NOT NULL;
