-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "commission_rate" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "commission_rate" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "PlatformCompany" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" VARCHAR(18) NOT NULL,
    "bank" TEXT NOT NULL,
    "agency" VARCHAR(10) NOT NULL,
    "checking_account" VARCHAR(20) NOT NULL,
    "address" TEXT,
    "cep" VARCHAR(9),
    "default_commission_rate" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformCompany_pkey" PRIMARY KEY ("id")
);
