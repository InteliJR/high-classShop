/*
  Warnings:

  - You are about to drop the column `commission_agency` on the `Contract` table. All the data in the column will be lost.
  - You are about to drop the column `commission_bank` on the `Contract` table. All the data in the column will be lost.
  - You are about to drop the column `commission_checking_account` on the `Contract` table. All the data in the column will be lost.
  - You are about to drop the column `commission_cpf` on the `Contract` table. All the data in the column will be lost.
  - You are about to drop the column `commission_name` on the `Contract` table. All the data in the column will be lost.
  - You are about to drop the column `commission_value` on the `Contract` table. All the data in the column will be lost.
  - You are about to drop the column `commission_value_written` on the `Contract` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "agency" VARCHAR(10),
ADD COLUMN     "bank" TEXT,
ADD COLUMN     "checking_account" VARCHAR(20);

-- AlterTable
ALTER TABLE "Contract" DROP COLUMN "commission_agency",
DROP COLUMN "commission_bank",
DROP COLUMN "commission_checking_account",
DROP COLUMN "commission_cpf",
DROP COLUMN "commission_name",
DROP COLUMN "commission_value",
DROP COLUMN "commission_value_written",
ADD COLUMN     "office_agency" TEXT,
ADD COLUMN     "office_bank" TEXT,
ADD COLUMN     "office_checking_account" TEXT,
ADD COLUMN     "office_cnpj" VARCHAR(18),
ADD COLUMN     "office_name" TEXT,
ADD COLUMN     "office_value" DECIMAL(15,2),
ADD COLUMN     "office_value_written" VARCHAR(500),
ADD COLUMN     "platform_agency" TEXT,
ADD COLUMN     "platform_bank" TEXT,
ADD COLUMN     "platform_checking_account" TEXT,
ADD COLUMN     "platform_cnpj" VARCHAR(18),
ADD COLUMN     "platform_name" TEXT,
ADD COLUMN     "platform_percentage" DECIMAL(5,2),
ADD COLUMN     "platform_value" DECIMAL(15,2),
ADD COLUMN     "platform_value_written" VARCHAR(500),
ADD COLUMN     "testimonial1_cpf" VARCHAR(14),
ADD COLUMN     "testimonial1_email" TEXT,
ADD COLUMN     "testimonial2_cpf" VARCHAR(14),
ADD COLUMN     "testimonial2_email" TEXT;
