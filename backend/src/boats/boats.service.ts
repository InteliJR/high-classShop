import { Injectable } from '@nestjs/common';
import { CreateBoatDto } from './dto/create-boat.dto';
import { UpdateBoatDto } from './dto/update-boat.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaginationQueryDto } from 'src/utils/dto/pagination-qery.dto';

@Injectable()
export class BoatsService {
  constructor(private prismaService: PrismaService) {}

  create(createBoatDto: CreateBoatDto) {
    return 'This action adds a new boat';
  }

  async getAllBoats(paginationQueryDto: PaginationQueryDto) {
    const { take = 10, skip = 0 } = paginationQueryDto;

    const [boats, total] = await this.prismaService.$transaction([
      this.prismaService.boats.findMany({
        skip: skip,
        take: take,
      }),
      this.prismaService.boats.count(),
    ]);

    return {
      data: boats,
      count: total,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} boat`;
  }

  update(id: number, updateBoatDto: UpdateBoatDto) {
    return `This action updates a #${id} boat`;
  }

  remove(id: number) {
    return `This action removes a #${id} boat`;
  }
}
