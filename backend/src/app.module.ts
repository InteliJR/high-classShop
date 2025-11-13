import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AircraftsModule } from './aircrafts/aircrafts.module';
import { BoatsModule } from './boats/boats.module';
import { CarsModule } from './cars/cars.module';
import { ConsultantsModule } from './features/consultants/consultants.module';
import { SpecialistsModule } from './features/specialists/specialists.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { ConsultantModule } from './consultant/consultant.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ConsultantsModule,
    SpecialistsModule,
    CompaniesModule,
    CarsModule,
    BoatsModule,
    AircraftsModule,
    AuthModule,
    ConsultantModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
