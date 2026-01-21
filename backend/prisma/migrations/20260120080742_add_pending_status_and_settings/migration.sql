/*
  Warnings:

  - Made the column `user_clicked_at` on table `Appointment` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "status" SET DEFAULT 'pending',
ALTER COLUMN "user_clicked_at" SET NOT NULL;
