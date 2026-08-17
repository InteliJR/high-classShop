-- AlterTable
-- Coluna "rg" aceita CPF (11 dígitos) por design (ver DTOs de registro), mas estava
-- limitada a VARCHAR(10), causando P2000 em qualquer CPF de 11 dígitos.
ALTER TABLE "User" ALTER COLUMN "rg" TYPE VARCHAR(11);
