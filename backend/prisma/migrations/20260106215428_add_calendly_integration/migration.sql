/*
  Warnings:

  - The primary key for the `Appointment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `date` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `time` on the `Appointment` table. All the data in the column will be lost.
  - The `status` column on the `Appointment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[appointment_id]` on the table `Process` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `appointment_datetime` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `product_id` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `Appointment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `client_id` on table `Appointment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `specialist_id` on table `Appointment` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."Appointment" DROP CONSTRAINT "fk_appointment_as_client";

-- DropForeignKey
ALTER TABLE "public"."Appointment" DROP CONSTRAINT "fk_appointment_as_specialist";

-- DropIndex
DROP INDEX "public"."Appointment_date_idx";

-- AlterTable
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_pkey",
DROP COLUMN "date",
DROP COLUMN "time",
ADD COLUMN     "appointment_datetime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "product_id" INTEGER NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "client_id" SET NOT NULL,
ALTER COLUMN "specialist_id" SET NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "StatusAgendamento" NOT NULL DEFAULT 'scheduled',
ADD CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Process" ADD COLUMN     "appointment_id" UUID;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "calendly_url" TEXT;

-- CreateIndex
CREATE INDEX "Appointment_appointment_datetime_idx" ON "Appointment"("appointment_datetime");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_product_type_idx" ON "Appointment"("product_type");

-- CreateIndex
CREATE UNIQUE INDEX "Process_appointment_id_key" ON "Process"("appointment_id");

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "fk_appointment_as_client" FOREIGN KEY ("client_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "fk_appointment_as_specialist" FOREIGN KEY ("specialist_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
