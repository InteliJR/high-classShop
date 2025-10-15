import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CompaniesModule } from './companies/companies.module';
import { AircraftsModule } from './aircrafts/aircrafts.module';
import { BoatsModule } from './boats/boats.module';
import { CarsModule } from './cars/cars.module';


@Module({
  imports: [CompaniesModule, CarsModule, BoatsModule, AircraftsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
