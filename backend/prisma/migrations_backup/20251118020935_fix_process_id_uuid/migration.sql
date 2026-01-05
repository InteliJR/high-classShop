/*
  Warnings:

  - The `speciality` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Document` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Proccess` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `product_type` on the `Appointment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('CAR', 'BOAT', 'AIRCRAFT');

-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('SCHEDULING', 'NEGOTIATION', 'DOCUMENTATION', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('PENDING', 'SIGNED');

-- DropForeignKey
ALTER TABLE "public"."Document" DROP CONSTRAINT "Document_process_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."Proccess" DROP CONSTRAINT "fk_proccess_as_client";

-- DropForeignKey
ALTER TABLE "public"."Proccess" DROP CONSTRAINT "fk_proccess_as_specialist";

-- AlterTable
ALTER TABLE "Aircraft" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Aircraft_interest" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "product_type",
ADD COLUMN     "product_type" "ProductType" NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Boat" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Boat_interest" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Car" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Car_interest" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "speciality",
ADD COLUMN     "speciality" "ProductType",
ALTER COLUMN "updated_at" DROP DEFAULT;

-- DropTable
DROP TABLE "public"."Document";

-- DropTable
DROP TABLE "public"."Proccess";

-- DropEnum
DROP TYPE "public"."SpecialityType";

-- DropEnum
DROP TYPE "public"."StatusProcesso";

-- DropEnum
DROP TYPE "public"."UploadTypeDocumento";

-- CreateTable
CREATE TABLE "Process" (
    "id" TEXT NOT NULL,
    "client_id" UUID,
    "specialist_id" UUID,
    "product_type" "ProductType" NOT NULL,
    "status" "ProcessStatus" NOT NULL DEFAULT 'SCHEDULING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "fk_process_as_client" FOREIGN KEY ("client_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "fk_process_as_specialist" FOREIGN KEY ("specialist_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
