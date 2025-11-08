import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AircraftsModule } from './aircrafts/aircrafts.module';
import { BoatsModule } from './boats/boats.module';
import { CarsModule } from './cars/cars.module';
import { PrismaService } from './prisma/prisma.service';
import { CompaniesModule } from './features/companies/companies.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { ConsultantModule } from './consultant/consultant.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
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
