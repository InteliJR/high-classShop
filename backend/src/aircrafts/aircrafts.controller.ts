import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AircraftsService } from './aircrafts.service';
import { CreateAircraftDto } from '../dto/create-aircraft.dto';
import { UpdateAircraftDto } from '../dto/update-aircraft.dto';

@Controller('aircrafts')
export class AircraftsController {
  constructor(private readonly aircraftsService: AircraftsService) {}

  @Post()
  create(@Body() createAircraftDto: CreateAircraftDto) {
    return this.aircraftsService.create(createAircraftDto);
  }

  @Get()
  findAll() {
    return this.aircraftsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aircraftsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAircraftDto: UpdateAircraftDto) {
    return this.aircraftsService.update(+id, updateAircraftDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aircraftsService.remove(+id);
  }
}
