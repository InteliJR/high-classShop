import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AircraftsModule } from './aircrafts/aircrafts.module';
import { BoatsModule } from './boats/boats.module';
import { CarsModule } from './cars/cars.module';
import { PrismaService } from './prisma/prisma.service';
import { CompaniesModule } from './features/companies/companies.module';
import { ConsultantsModule } from './features/consultants/consultants.module';
import { SpecialistsModule } from './features/specialists/specialists.module';
import { AuthModule } from './auth/auth.module';
import { ConsultantModule } from './consultant/consultant.module';
import { RolesGuard } from './shared/guards/roles.guard';
import { PrismaExceptionFilter } from './shared/filters/prisma-exception.filter';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ProcessesModule } from './processes/processes.module';
import { ContractsModule } from './contracts/contracts.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DocusignModule } from './providers/docusign/docusign.module';
import { UsersModule } from './users/users.module';

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
    ProcessesModule,
    ContractsModule,
    DashboardModule,
    DocusignModule,
    UsersModule,
  ],
  providers: [
    PrismaService,
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
