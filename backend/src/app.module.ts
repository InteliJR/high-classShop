import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AircraftsModule } from './features/aircrafts/aircrafts.module';
import { BoatsModule } from './features/boats/boats.module';
import { CarsModule } from './features/cars/cars.module';
import { PrismaService } from './prisma/prisma.service';
import { CompaniesModule } from './features/companies/companies.module';
import { ConsultantsModule } from './features/consultants/consultants.module';
import { SpecialistsModule } from './features/specialists/specialists.module';
import { AuthModule } from './auth/auth.module';
import { ConsultantModule } from './features/consultant/consultant.module';
import { RolesGuard } from './shared/guards/roles.guard';
import { PrismaExceptionFilter } from './shared/filters/prisma-exception.filter';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ProcessesModule } from './features/processes/processes.module';
import { ContractsModule } from './features/contracts/contracts.module';
import { DashboardModule } from './features/dashboard/dashboard.module';
import { DocusignModule } from './providers/docusign/docusign.module';
import { UsersModule } from './features/users/users.module';
import { AuthGuard } from './auth/auth.guard';
import { AppointmentsModule } from './features/appointments/appointments.module';
import { ProposalsModule } from './features/proposals/proposals.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HealthModule,
    ConsultantsModule,
    SpecialistsModule,
    CompaniesModule,
    CarsModule,
    BoatsModule,
    AircraftsModule,
    AuthModule,
    ConsultantModule,
    ProcessesModule,
    AppointmentsModule,
    ProposalsModule,
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
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
