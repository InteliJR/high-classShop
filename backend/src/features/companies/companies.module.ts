import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { AwsModule } from '../../aws/aws.module';

@Module({
  // Importa o módulo AWS para permitir o upload de ficheiros para o S3.
  imports: [AwsModule],
  // Regista os controllers que pertencem a este módulo.
  controllers: [CompaniesController],
  // Regista os serviços que pertencem a este módulo.
  providers: [CompaniesService, PrismaService],
})
export class CompaniesModule {}
