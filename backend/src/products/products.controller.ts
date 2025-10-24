import { Controller, Get, Param } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('api')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('cars/:id')
  getCar(@Param('id') id: string) {
    return this.productsService.getCarById(id);
  }

  @Get('boats/:id')
  getBoat(@Param('id') id: string) {
    return this.productsService.getBoatById(id);
  }

  @Get('aircraft/:id')
  getAircraft(@Param('id') id: string) {
    return this.productsService.getAircraftById(id);
  }
}


