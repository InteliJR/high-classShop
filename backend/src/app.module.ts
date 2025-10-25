import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AircraftsModule } from './aircrafts/aircrafts.module';
import { BoatsModule } from './boats/boats.module';
import { CarsModule } from './cars/cars.module';
import { PrismaService } from './prisma/prisma.service';
import { CompaniesModule } from './features/companies/companies.module';
import { ConsultantsModule } from './features/consultants/consultants.module';
import { SpecialistsModule } from './features/specialists/specialists.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CompaniesModule, ConsultantsModule, SpecialistsModule, CarsModule, BoatsModule, AircraftsModule
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
