import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AircraftsModule } from './aircrafts/aircrafts.module';
import { BoatsModule } from './boats/boats.module';
import { CarsModule } from './cars/cars.module';
import { PrismaService } from './prisma/prisma.service';
import { CompaniesModule } from './features/companies/companies.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CompaniesModule, CarsModule, BoatsModule, AircraftsModule, AuthModule, 
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
