import { Injectable } from '@nestjs/common';
import { CreateAircraftDto } from '../dto/create-aircraft.dto';
import { UpdateAircraftDto } from '../dto/update-aircraft.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AircraftsService {
  constructor( private prisma: PrismaService) {}

  create(createAircraftDto: CreateAircraftDto) {
    return 'This action adds a new aircraft';
  }

  findAll() {
    return this.prisma.aircraft.findMany();
  }

  findOne(id: number) {
    return `This action returns a #${id} aircraft`;
  }

  update(id: number, updateAircraftDto: UpdateAircraftDto) {
    return `This action updates a #${id} aircraft`;
  }

  remove(id: number) {
    return `This action removes a #${id} aircraft`;
  }
}
