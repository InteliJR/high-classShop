import { Injectable } from '@nestjs/common';
import { CreateBoatDto } from './dto/create-boat.dto';
import { UpdateBoatDto } from './dto/update-boat.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaginationQueryDto } from 'src/utils/dto/pagination-query.dto';

@Injectable()
export class BoatsService {
  constructor(private prismaService: PrismaService) {}

  create(createBoatDto: CreateBoatDto) {
    return 'This action adds a new boat';
  }

  async getAllBoats( { page, perPage }: PaginationQueryDto) {
    // Cálculo das variáveis que serão utilizadas na requisição ao banco de dados
    const take = perPage;
    const skip = (page - 1) * perPage;

    // Agrupamento das operções para serem realizadas no banco de dados
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
