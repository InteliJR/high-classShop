import { Injectable } from '@nestjs/common';
import { CreateAircraftDto } from './dto/create-aircraft.dto';
import { UpdateAircraftDto } from './dto/update-aircraft.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaginationQueryDto } from 'src/utils/dto/pagination-query.dto';

@Injectable()
export class AircraftsService {
  constructor(private prismaService: PrismaService) {}

  create(createAircraftDto: CreateAircraftDto) {
    return 'This action adds a new aircraft';
  }

  async getAllAircrafts( { page, perPage }: PaginationQueryDto) {
    // Cálculo das variáveis que serão utilizadas
    const take = perPage;
    const skip = (page - 1) * perPage;

    //Agrupamento das operações que serão realizadas no banco de dados
    const [aircrafts, total] = await this.prismaService.$transaction([
      this.prismaService.aircraft.findMany({
        skip: skip,
        take: take,
      }),
      this.prismaService.aircraft.count(),
    ]);

    return {
      data: aircrafts,
      count: total,
    };
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
