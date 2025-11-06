import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { CompaniesService } from './companies.service';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  findAll() {
    return this.companiesService.findAll();
  }

  @Post()
  create(@Body() body: { name: string; cnpj: string }) {
    return this.companiesService.create(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; cnpj: string; logo: string; description: string }>,
  ) {
    return this.companiesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
