/*
  Warnings:

  - You are about to drop the `admins` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `aircraft` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `aircraft_images` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `aircraft_interests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `appointments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `boat_images` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `boat_interests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `boats` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `car_images` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `car_interests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cars` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `clients` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `companies` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `consultants` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `processes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `specialists` table. If the table is not empty, all the data it contains will be lost.

*/


-- CreateEnum
CREATE TYPE "CivilState" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED', 'STABLE_UNION');

-- CreateEnum
CREATE TYPE "SpecialityType" AS ENUM ('CAR', 'BOAT', 'AIRCRAFT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'CONSULTANT', 'SPECIALIST', 'ADMIN');

-- DropForeignKey
ALTER TABLE "public"."aircraft" DROP CONSTRAINT "aircraft_specialist_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."aircraft_interests" DROP CONSTRAINT "aircraft_interests_client_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."appointments" DROP CONSTRAINT "appointments_client_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."appointments" DROP CONSTRAINT "appointments_specialist_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."boat_interests" DROP CONSTRAINT "boat_interests_client_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."boats" DROP CONSTRAINT "boats_specialist_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."car_interests" DROP CONSTRAINT "car_interests_client_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."cars" DROP CONSTRAINT "cars_specialist_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."clients" DROP CONSTRAINT "clients_consultant_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."consultants" DROP CONSTRAINT "consultants_company_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."documents" DROP CONSTRAINT "documents_process_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."processes" DROP CONSTRAINT "processes_client_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."processes" DROP CONSTRAINT "processes_specialist_id_fkey";

-- DropTable
DROP TABLE "public"."admins";

-- DropTable
DROP TABLE "public"."aircraft";

-- DropTable
DROP TABLE "public"."aircraft_images";

-- DropTable
DROP TABLE "public"."aircraft_interests";

-- DropTable
DROP TABLE "public"."appointments";

-- DropTable
DROP TABLE "public"."boat_images";

-- DropTable
DROP TABLE "public"."boat_interests";

-- DropTable
DROP TABLE "public"."boats";

-- DropTable
DROP TABLE "public"."car_images";

-- DropTable
DROP TABLE "public"."car_interests";

-- DropTable
DROP TABLE "public"."cars";

-- DropTable
DROP TABLE "public"."clients";

-- DropTable
DROP TABLE "public"."companies";

-- DropTable
DROP TABLE "public"."consultants";

-- DropTable
DROP TABLE "public"."documents";

-- DropTable
DROP TABLE "public"."processes";

-- DropTable
DROP TABLE "public"."specialists";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "rg" VARCHAR(10) NOT NULL,
    "role" "UserRole" NOT NULL,
    "password_hash" TEXT NOT NULL,
    "civil_state" "CivilState",
    "speciality" "SpecialityType",
    "identification_number" VARCHAR(50),
    "address_id" UUID,
    "consultant_id" UUID,
    "company_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "country" TEXT NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "logo" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Car" (
    "id" SERIAL NOT NULL,
    "specialist_id" TEXT,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "estado" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "descricao" TEXT,
    "cor" TEXT,
    "km" INTEGER,
    "cambio" TEXT,
    "combustivel" TEXT,
    "tipo_categoria" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Car_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boat" (
    "id" SERIAL NOT NULL,
    "specialist_id" TEXT,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "ano" INTEGER NOT NULL,
    "fabricante" TEXT,
    "tamanho" TEXT,
    "estilo" TEXT,
    "combustivel" TEXT,
    "motor" TEXT,
    "ano_motor" INTEGER,
    "descricao_completa" TEXT,
    "acessorios" TEXT,
    "estado" TEXT NOT NULL,
    "tipo_embarcacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Boat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aircraft" (
    "id" SERIAL NOT NULL,
    "specialist_id" TEXT,
    "categoria" TEXT,
    "ano" INTEGER NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "assentos" INTEGER,
    "estado" TEXT NOT NULL,
    "descricao" TEXT,
    "valor" DECIMAL(65,30) NOT NULL,
    "tipo_aeronave" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aircraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Car_image" (
    "id" SERIAL NOT NULL,
    "product_type" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Car_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boat_image" (
    "id" SERIAL NOT NULL,
    "product_type" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Boat_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aircraft_image" (
    "id" SERIAL NOT NULL,
    "product_type" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aircraft_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proccess" (
    "id" SERIAL NOT NULL,
    "client_id" TEXT,
    "specialist_id" TEXT,
    "product_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'agendamento',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" SERIAL NOT NULL,
    "process_id" INTEGER,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_type" TEXT,
    "uploaded_by" INTEGER NOT NULL,
    "uploaded_by_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" SERIAL NOT NULL,
    "client_id" TEXT,
    "specialist_id" TEXT,
    "product_type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Car_interest" (
    "id" SERIAL NOT NULL,
    "client_id" TEXT,
    "uso_principal" TEXT,
    "preferencia_foco" TEXT,
    "faixa_valor" TEXT,
    "status" TEXT,
    "marca_preferida" TEXT,
    "modelo_preferido" TEXT,
    "perfil_veiculo" TEXT,
    "blindagem" BOOLEAN,
    "carroceria" TEXT,
    "fator_importante" TEXT,
    "recursos_indispensaveis" TEXT,
    "estilo_viagem" TEXT,
    "mensagem_imagem" TEXT,
    "prazo_aquisicao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Car_interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boat_interest" (
    "id" SERIAL NOT NULL,
    "client_id" TEXT,
    "uso_principal" TEXT,
    "preferencia_foco" TEXT,
    "faixa_valor" TEXT,
    "status" TEXT,
    "marca_preferida" TEXT,
    "modelo_preferido" TEXT,
    "tipo_embarcacao" TEXT,
    "tamanho_embarcacao" TEXT,
    "motor" TEXT,
    "capacidade_pessoas" TEXT,
    "cabine_pernoite" TEXT,
    "experiencia_navegacao" TEXT,
    "operacao_embarcacao" TEXT,
    "marina_preferencia" TEXT,
    "recursos_indispensaveis" TEXT,
    "prazo_aquisicao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Boat_interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aircraft_interest" (
    "id" SERIAL NOT NULL,
    "client_id" TEXT,
    "uso_principal" TEXT,
    "preferencia_foco" TEXT,
    "faixa_valor" TEXT,
    "status" TEXT,
    "marca_preferida" TEXT,
    "modelo_preferido" TEXT,
    "tipo_aeronave" TEXT,
    "alcance_autonomia" TEXT,
    "capacidade_passageiros" TEXT,
    "experiencia_voo" TEXT,
    "operacao_aeronave" TEXT,
    "hangar_preferencia" TEXT,
    "configuracao_cabine" TEXT,
    "recursos_indispensaveis" TEXT,
    "prazo_aquisicao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aircraft_interest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_cpf_key" ON "User"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "User_rg_key" ON "User"("rg");

-- CreateIndex
CREATE UNIQUE INDEX "User_identification_number_key" ON "User"("identification_number");

-- CreateIndex
CREATE UNIQUE INDEX "Company_cnpj_key" ON "Company"("cnpj");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_consultant_id_fkey" FOREIGN KEY ("consultant_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Car" ADD CONSTRAINT "Car_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boat" ADD CONSTRAINT "Boat_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aircraft" ADD CONSTRAINT "Aircraft_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proccess" ADD CONSTRAINT "fk_proccess_as_client" FOREIGN KEY ("client_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proccess" ADD CONSTRAINT "fk_proccess_as_specialist" FOREIGN KEY ("specialist_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "Proccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "fk_appointment_as_client" FOREIGN KEY ("client_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "fk_appointment_as_specialist" FOREIGN KEY ("specialist_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Car_interest" ADD CONSTRAINT "Car_interest_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boat_interest" ADD CONSTRAINT "Boat_interest_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aircraft_interest" ADD CONSTRAINT "Aircraft_interest_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
