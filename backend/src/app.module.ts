import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CompaniesModule } from './companies/companies.module';
import { ProductsModule } from './products/products.module';


@Module({
  imports: [CompaniesModule, ProductsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
