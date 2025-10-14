-- CreateEnum
CREATE TYPE "Especialidade" AS ENUM ('carros', 'barcos', 'aeronaves');

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
CREATE TYPE "StatusProcesso" AS ENUM ('agendamento', 'negociacao', 'documentacao', 'concluido');

-- CreateEnum
CREATE TYPE "UploadTypeDocumento" AS ENUM ('client', 'specialist');

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

-- CreateTable
CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "logo" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultants" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER,
    "name" TEXT NOT NULL,
    "identification_number" TEXT NOT NULL,
    "rg" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "cargo" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "consultant_id" INTEGER,
    "name" TEXT NOT NULL,
    "rg" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "estado_civil" TEXT,
    "cep" TEXT,
    "endereco" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialists" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "rg" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "especialidade" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "specialists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cars" (
    "id" SERIAL NOT NULL,
    "specialist_id" INTEGER,
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

    CONSTRAINT "cars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boats" (
    "id" SERIAL NOT NULL,
    "specialist_id" INTEGER,
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

    CONSTRAINT "boats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aircraft" (
    "id" SERIAL NOT NULL,
    "specialist_id" INTEGER,
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

    CONSTRAINT "aircraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "car_images" (
    "id" SERIAL NOT NULL,
    "product_type" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "car_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boat_images" (
    "id" SERIAL NOT NULL,
    "product_type" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boat_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aircraft_images" (
    "id" SERIAL NOT NULL,
    "product_type" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aircraft_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processes" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER,
    "specialist_id" INTEGER,
    "product_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'agendamento',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" SERIAL NOT NULL,
    "process_id" INTEGER,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_type" TEXT,
    "uploaded_by" INTEGER NOT NULL,
    "uploaded_by_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER,
    "specialist_id" INTEGER,
    "product_type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "car_interests" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER,
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

    CONSTRAINT "car_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boat_interests" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER,
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

    CONSTRAINT "boat_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aircraft_interests" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER,
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

    CONSTRAINT "aircraft_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_cnpj_key" ON "companies"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "consultants_cpf_key" ON "consultants"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "consultants_email_key" ON "consultants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_cpf_key" ON "clients"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "clients_email_key" ON "clients"("email");

-- CreateIndex
CREATE UNIQUE INDEX "specialists_cpf_key" ON "specialists"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "specialists_email_key" ON "specialists"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- AddForeignKey
ALTER TABLE "consultants" ADD CONSTRAINT "consultants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_consultant_id_fkey" FOREIGN KEY ("consultant_id") REFERENCES "consultants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cars" ADD CONSTRAINT "cars_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "specialists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boats" ADD CONSTRAINT "boats_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "specialists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aircraft" ADD CONSTRAINT "aircraft_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "specialists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "specialists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "specialists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "car_interests" ADD CONSTRAINT "car_interests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_interests" ADD CONSTRAINT "boat_interests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aircraft_interests" ADD CONSTRAINT "aircraft_interests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
