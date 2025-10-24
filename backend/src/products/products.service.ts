import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCarById(id: number) {
    const car = await this.prisma.cars.findUnique({ where: { id } });
    if (!car) throw new NotFoundException('Car not found');

    const images = await this.prisma.car_images.findMany({ where: { car_id: id } });

    return {
      id: car.id,
      model: car.modelo,
      year: car.ano,
      status: car.estado,
      description: car.descricao,
      price: car.valor,
      images: images.map((i: { image_url: string; is_primary: boolean }) => ({ url: i.image_url, isPrimary: i.is_primary })),
    };
  }

  async getBoatById(id: number) {
    const boat = await this.prisma.boats.findUnique({ where: { id } });
    if (!boat) throw new NotFoundException('Boat not found');

    const images = await this.prisma.boat_images.findMany({ where: { boat_id: id } });

    return {
      id: boat.id,
      model: boat.modelo,
      year: boat.ano,
      status: boat.estado,
      description: boat.descricao_completa,
      price: boat.valor,
      images: images.map((i: { image_url: string; is_primary: boolean }) => ({ url: i.image_url, isPrimary: i.is_primary })),
    };
  }

  async getAircraftById(id: number) {
    const aircraft = await this.prisma.aircraft.findUnique({ where: { id } });
    if (!aircraft) throw new NotFoundException('Aircraft not found');

    const images = await this.prisma.aircraft_images.findMany({ where: { aircraft_id: id } });

    return {
      id: aircraft.id,
      model: aircraft.modelo,
      year: aircraft.ano,
      status: aircraft.estado,
      description: aircraft.descricao,
      price: aircraft.valor,
      images: images.map((i: { image_url: string; is_primary: boolean }) => ({ url: i.image_url, isPrimary: i.is_primary })),
    };
  }
}


