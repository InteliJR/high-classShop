import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BoatsService } from './boats.service';
import { CreateBoatDto } from '../dto/create-boat.dto';
import { UpdateBoatDto } from '../dto/update-boat.dto';

@Controller('boats')
export class BoatsController {
  constructor(private readonly boatsService: BoatsService) {}

  @Post()
  create(@Body() createBoatDto: CreateBoatDto) {
    return this.boatsService.create(createBoatDto);
  }

  @Get()
  findAll() {
    return this.boatsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.boatsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBoatDto: UpdateBoatDto) {
    return this.boatsService.update(+id, updateBoatDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.boatsService.remove(+id);
  }
}
