import { Injectable } from '@nestjs/common';
import { CreateBoatDto } from '../dto/create-boat.dto';
import { UpdateBoatDto } from '../dto/update-boat.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BoatsService {
  constructor( private prisma : PrismaService) {}

  create(createBoatDto: CreateBoatDto) {
    return 'This action adds a new boat';
  }

  findAll() {
    return this.prisma.boats.findMany();
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
