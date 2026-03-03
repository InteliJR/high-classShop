-- CreateEnum
CREATE TYPE "CivilState" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED', 'STABLE_UNION');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'CONSULTANT', 'SPECIALIST', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('CAR', 'BOAT', 'AIRCRAFT');

-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('SCHEDULING', 'NEGOTIATION', 'PROCESSING_CONTRACT', 'DOCUMENTATION', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('PENDING', 'REJECTED', 'SIGNED');

-- CreateEnum
CREATE TYPE "SignatureType" AS ENUM ('SIMPLE', 'ADVANCED', 'QUALIFIED');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('created', 'sent', 'delivered', 'completed', 'declined', 'voided', 'timeout', 'error');

-- CreateEnum
CREATE TYPE "ProcessCompletionReason" AS ENUM ('CONTRACT_SIGNED', 'CLIENT_DECLINED', 'CONTRACT_VOIDED', 'CONTRACT_TIMEDOUT');

-- CreateEnum
CREATE TYPE "EstadoProduto" AS ENUM ('novo', 'seminovo', 'colecao');

-- CreateEnum
CREATE TYPE "TipoCategoriaCarro" AS ENUM ('SUV', 'sedan', 'coupe', 'conversivel', 'esportivo', 'supercarro');

-- CreateEnum
CREATE TYPE "TipoEmbarcacaoProduto" AS ENUM ('iate', 'lancha', 'catamara', 'veleiro', 'jet_boat', 'outro');

-- CreateEnum
CREATE TYPE "TipoAeronaveProduto" AS ENUM ('VLJ', 'executivo_medio', 'intercontinental', 'turbohelice', 'helicoptero');

-- CreateEnum
CREATE TYPE "TipoProdutoProcesso" AS ENUM ('car', 'boat', 'aircraft');

-- CreateEnum
CREATE TYPE "TipoProdutoAgendamento" AS ENUM ('car', 'boat', 'aircraft');

-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "UsoPrincipalBoatInterest" AS ENUM ('lazer', 'cruzeiros', 'pesca', 'eventos', 'colecao_investimento');

-- CreateEnum
CREATE TYPE "PreferenciaFocoBoatInterest" AS ENUM ('conforto', 'performance', 'equilibrio');

-- CreateEnum
CREATE TYPE "FaixaValorBoatInterest" AS ENUM ('ate_500k', '500k_1M', 'acima_1M');

-- CreateEnum
CREATE TYPE "StatusBoatInterest" AS ENUM ('nova', 'seminova', 'colecao_raridade');

-- CreateEnum
CREATE TYPE "TipoEmbarcacaoBoatInterest" AS ENUM ('iate', 'lancha', 'catamara', 'veleiro', 'jet_boat', 'outro');

-- CreateEnum
CREATE TYPE "TamanhoEmbarcacao" AS ENUM ('ate_30_pes', '30_50_pes', 'acima_50_pes');

-- CreateEnum
CREATE TYPE "MotorBoatInterest" AS ENUM ('diesel', 'gasolina', 'eletrico_hibrido');

-- CreateEnum
CREATE TYPE "CapacidadePessoasBoat" AS ENUM ('1_4', '5_8', 'mais_8');

-- CreateEnum
CREATE TYPE "CabinePernoiteBoat" AS ENUM ('day_boat', '1_2_cabines', 'mais_2_cabines');

-- CreateEnum
CREATE TYPE "ExperienciaNavegacao" AS ENUM ('nenhuma', 'basica', 'medio_porte', 'iates_grandes');

-- CreateEnum
CREATE TYPE "OperacaoEmbarcacao" AS ENUM ('pessoal', 'com_auxilio', 'apenas_crew_capitao');

-- CreateEnum
CREATE TYPE "MarinaPreferencia" AS ENUM ('possui', 'precisa_indicacao', 'nao_prioridade');

-- CreateEnum
CREATE TYPE "PrazoAquisicaoBoat" AS ENUM ('imediato', 'curto', 'medio', 'longo');

-- CreateEnum
CREATE TYPE "UsoPrincipalAircraftInterest" AS ENUM ('corporativo', 'lazer', 'turismo', 'transporte_familia', 'colecao_investimento');

-- CreateEnum
CREATE TYPE "PreferenciaFocoAircraft" AS ENUM ('conforto_luxo', 'performance', 'equilibrio');

-- CreateEnum
CREATE TYPE "FaixaValorAircraft" AS ENUM ('ate_5M', '5_20M', 'acima_20M');

-- CreateEnum
CREATE TYPE "StatusAircraft" AS ENUM ('nova', 'seminova', 'colecao_raridade');

-- CreateEnum
CREATE TYPE "TipoAeronaveAircraft" AS ENUM ('VLJ', 'executivo', 'intercontinental', 'turbohelice', 'helicoptero', 'outro');

-- CreateEnum
CREATE TYPE "AlcanceAutonomia" AS ENUM ('curta', 'media', 'longa');

-- CreateEnum
CREATE TYPE "CapacidadePassageiros" AS ENUM ('ate_4', '5_8', 'mais_8');

-- CreateEnum
CREATE TYPE "ExperienciaVoo" AS ENUM ('nenhuma', 'aeronaves_leves', 'executivos_turbohelices', 'grandes_intercontinentais');

-- CreateEnum
CREATE TYPE "OperacaoAeronave" AS ENUM ('pilotar_pessoalmente', 'com_auxilio', 'apenas_crew_piloto');

-- CreateEnum
CREATE TYPE "HangarPreferencia" AS ENUM ('possui', 'precisa_indicacao', 'nao_prioridade');

-- CreateEnum
CREATE TYPE "ConfiguracaoCabine" AS ENUM ('executiva', 'passageiros_familia', 'outra');

-- CreateEnum
CREATE TYPE "PrazoAquisicaoAircraft" AS ENUM ('imediato', 'curto', 'medio', 'longo');

-- CreateEnum
CREATE TYPE "Especialidade" AS ENUM ('carros', 'barcos', 'aeronaves');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "rg" VARCHAR(10) NOT NULL,
    "role" "UserRole" NOT NULL,
    "password_hash" TEXT NOT NULL,
    "civil_state" "CivilState",
    "speciality" "ProductType",
    "identification_number" VARCHAR(50),
    "address_id" UUID,
    "consultant_id" UUID,
    "company_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" UUID NOT NULL,
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
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "logo" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Car" (
    "id" SERIAL NOT NULL,
    "specialist_id" UUID,
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Car_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Car_image" (
    "id" SERIAL NOT NULL,
    "product_type" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "car_id" INTEGER,

    CONSTRAINT "Car_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boat" (
    "id" SERIAL NOT NULL,
    "specialist_id" UUID,
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Boat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boat_image" (
    "id" SERIAL NOT NULL,
    "product_type" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "boat_id" INTEGER,

    CONSTRAINT "Boat_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aircraft" (
    "id" SERIAL NOT NULL,
    "specialist_id" UUID,
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Aircraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aircraft_image" (
    "id" SERIAL NOT NULL,
    "product_type" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aircraft_id" INTEGER,

    CONSTRAINT "Aircraft_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "type" "ProductType" NOT NULL,
    "car_id" INTEGER,
    "boat_id" INTEGER,
    "aircraft_id" INTEGER,
    "processId" UUID,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Process" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "specialist_id" UUID NOT NULL,
    "car_id" INTEGER,
    "aircraft_id" INTEGER,
    "boat_id" INTEGER,
    "product_id" UUID,
    "product_type" "ProductType" NOT NULL,
    "active_contract_id" UUID,
    "status" "ProcessStatus" NOT NULL DEFAULT 'SCHEDULING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessStatusHistory" (
    "id" TEXT NOT NULL,
    "processId" UUID NOT NULL,
    "status" "ProcessStatus" NOT NULL DEFAULT 'SCHEDULING',
    "reason" "ProcessCompletionReason",
    "changed_by" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "description" TEXT,
    "provider_name" TEXT,
    "provider_id" TEXT,
    "provider_status" "ProviderStatus",
    "provider_meta" JSONB,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "original_pdf_url" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'PENDING',
    "rejected_reason" TEXT,
    "signed_at" TIMESTAMP(3),
    "signature_type" "SignatureType",
    "uploaded_by_id" UUID NOT NULL,
    "uploaded_by_type" "UserRole" NOT NULL,
    "signed_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" SERIAL NOT NULL,
    "client_id" UUID,
    "specialist_id" UUID,
    "product_type" "ProductType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Car_interest" (
    "id" SERIAL NOT NULL,
    "client_id" UUID,
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Car_interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boat_interest" (
    "id" SERIAL NOT NULL,
    "client_id" UUID,
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Boat_interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aircraft_interest" (
    "id" SERIAL NOT NULL,
    "client_id" UUID,
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
    "updated_at" TIMESTAMP(3) NOT NULL,

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
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_user_id_idx" ON "RefreshToken"("user_id");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Company_cnpj_key" ON "Company"("cnpj");

-- CreateIndex
CREATE INDEX "Car_specialist_id_idx" ON "Car"("specialist_id");

-- CreateIndex
CREATE INDEX "Car_image_car_id_idx" ON "Car_image"("car_id");

-- CreateIndex
CREATE INDEX "Boat_specialist_id_idx" ON "Boat"("specialist_id");

-- CreateIndex
CREATE INDEX "Boat_image_boat_id_idx" ON "Boat_image"("boat_id");

-- CreateIndex
CREATE INDEX "Aircraft_specialist_id_idx" ON "Aircraft"("specialist_id");

-- CreateIndex
CREATE INDEX "Aircraft_image_aircraft_id_idx" ON "Aircraft_image"("aircraft_id");

-- CreateIndex
CREATE INDEX "Product_processId_idx" ON "Product"("processId");

-- CreateIndex
CREATE UNIQUE INDEX "Process_active_contract_id_key" ON "Process"("active_contract_id");

-- CreateIndex
CREATE INDEX "Process_status_idx" ON "Process"("status");

-- CreateIndex
CREATE INDEX "Process_product_type_idx" ON "Process"("product_type");

-- CreateIndex
CREATE INDEX "Process_product_id_idx" ON "Process"("product_id");

-- CreateIndex
CREATE INDEX "Process_created_at_idx" ON "Process"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Process_client_id_specialist_id_car_id_boat_id_aircraft_id_key" ON "Process"("client_id", "specialist_id", "car_id", "boat_id", "aircraft_id");

-- CreateIndex
CREATE INDEX "ProcessStatusHistory_processId_idx" ON "ProcessStatusHistory"("processId");

-- CreateIndex
CREATE INDEX "ProcessStatusHistory_changed_at_idx" ON "ProcessStatusHistory"("changed_at");

-- CreateIndex
CREATE INDEX "Contract_process_id_idx" ON "Contract"("process_id");

-- CreateIndex
CREATE INDEX "Contract_uploaded_by_id_idx" ON "Contract"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "Contract_provider_status_idx" ON "Contract"("provider_status");

-- CreateIndex
CREATE INDEX "Appointment_client_id_idx" ON "Appointment"("client_id");

-- CreateIndex
CREATE INDEX "Appointment_specialist_id_idx" ON "Appointment"("specialist_id");

-- CreateIndex
CREATE INDEX "Appointment_date_idx" ON "Appointment"("date");

-- CreateIndex
CREATE INDEX "Car_interest_client_id_idx" ON "Car_interest"("client_id");

-- CreateIndex
CREATE INDEX "Boat_interest_client_id_idx" ON "Boat_interest"("client_id");

-- CreateIndex
CREATE INDEX "Aircraft_interest_client_id_idx" ON "Aircraft_interest"("client_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_consultant_id_fkey" FOREIGN KEY ("consultant_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Car" ADD CONSTRAINT "Car_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Car_image" ADD CONSTRAINT "Car_image_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boat" ADD CONSTRAINT "Boat_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boat_image" ADD CONSTRAINT "Boat_image_boat_id_fkey" FOREIGN KEY ("boat_id") REFERENCES "Boat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aircraft" ADD CONSTRAINT "Aircraft_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aircraft_image" ADD CONSTRAINT "Aircraft_image_aircraft_id_fkey" FOREIGN KEY ("aircraft_id") REFERENCES "Aircraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_boat_id_fkey" FOREIGN KEY ("boat_id") REFERENCES "Boat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_aircraft_id_fkey" FOREIGN KEY ("aircraft_id") REFERENCES "Aircraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "fk_process_as_client" FOREIGN KEY ("client_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "fk_process_as_specialist" FOREIGN KEY ("specialist_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_active_contract_id_fkey" FOREIGN KEY ("active_contract_id") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessStatusHistory" ADD CONSTRAINT "ProcessStatusHistory_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
