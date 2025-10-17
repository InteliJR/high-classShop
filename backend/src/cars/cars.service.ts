import { Injectable } from '@nestjs/common';
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaginationQueryDto } from 'src/utils/dto/pagination-qery.dto';

@Injectable()
export class CarsService {
  constructor(private prismaService: PrismaService) {}

  create(createCarDto: CreateCarDto) {
    return 'This action adds a new car';
  }

  async getAllCars(paginationQueryDto: PaginationQueryDto) {
    const { take = 10, skip = 0 } = paginationQueryDto;

    const [cars, total] = await this.prismaService.$transaction([
      this.prismaService.cars.findMany({
        skip: skip,
        take: take,
      }),
      this.prismaService.cars.count(),
    ]);

    return {
      data: cars,
      count: total,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} car`;
  }

  update(id: number, updateCarDto: UpdateCarDto) {
    return `This action updates a #${id} car`;
  }

  remove(id: number) {
    return `This action removes a #${id} car`;
  }
}
