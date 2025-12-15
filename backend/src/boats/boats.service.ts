import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBoatDto } from './dto/create-boat.dto';
import { UpdateBoatDto } from './dto/update-boat.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/aws/s3.service';
import { QueryDto } from 'src/shared/dto/query.dto';
import {
  ContainsBoatFilters,
  ExactBoatFilters,
  FiltersBoatMeta,
  RangeBoatFilters,
} from 'src/shared/dto/filters.dto';
import { Boat } from './entity/boat.entity';
import { UserEntity } from 'src/auth/entities/user.entity';

@Injectable()
export class BoatsService {
  constructor(
    private prismaService: PrismaService,
    private s3Service: S3Service,
  ) {}

  async create(createBoatDto: CreateBoatDto) {
    const { images, ...boatData } = createBoatDto;

    try {
      // 1. Criar o barco
      const boat = await this.prismaService.boat.create({ data: boatData });

      // 2. Processar e fazer upload das imagens, se existirem
      if (images && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const image = images[i];

          const timestamp = Date.now();
          const key = `boats/${boat.id}/${timestamp}-${i}.jpg`;

          const imageKey = await this.s3Service.uploadBase64Image(image.data, key);

          await this.prismaService.boat_image.create({
            data: {
              boat_id: boat.id,
              image_url: imageKey,
              is_primary: image.is_primary,
              product_type: 'BOAT',
            },
          });
        }
      }

      // 3. Retornar o barco com as imagens
      return await this.prismaService.boat.findUnique({
        where: { id: boat.id },
        include: { images: true },
      });
    } catch (error) {
      throw new Error(`Erro ao criar lancha: ${error.message}`);
    }
  }

  async getAllBoats({
    page,
    perPage,
    appliedFilters,
  }: QueryDto<FiltersBoatMeta>) {
    // Cálculo das variáveis que serão utilizadas na requisição ao banco de dados
    const take = perPage;
    const skip = page && take ? (page - 1) * take : 0;

    //Exact
    const where: any = {};
    const exacts: ExactBoatFilters = {
      estado: appliedFilters?.estado,
      tipo_embarcacao: appliedFilters?.tipo_embarcacao,
      combustivel: appliedFilters?.combustivel,
      tamanho: appliedFilters?.tamanho,
    };
    // Insere a filtragem na variável where
    for (const [key, value] of Object.entries(exacts)) {
      if (value !== undefined && value !== null) {
        where[key] = value;
      }
    }

    //Contains
    const contains: ContainsBoatFilters = {
      fabricante: appliedFilters?.fabricante,
      marca: appliedFilters?.marca,
      modelo: appliedFilters?.modelo,
      motor: appliedFilters?.motor,
    };
    // Insere a filtragem na variǘel where
    for (const [key, value] of Object.entries(contains)) {
      if (value !== undefined && value !== null) {
        where[key] = { contains: value, mode: 'insensitive' };
      }
    }

    // Range
    const rangeFilter: RangeBoatFilters = {
      ano_max: appliedFilters?.ano_max,
      ano_min: appliedFilters?.ano_min,
      preco_max: appliedFilters?.preco_max,
      preco_min: appliedFilters?.preco_min,
    };
    // Objeto para orientar o where que utiliza gte e lte
    const rangeMap = {
      ano: { gte: rangeFilter.ano_max, lte: rangeFilter.ano_min },
      preco: { gte: rangeFilter.preco_max, lte: rangeFilter.preco_min },
    };
    // Insere a filtragem como um intervalo na variável where
    for (const [key, { gte, lte }] of Object.entries(rangeMap)) {
      const hasGte = gte !== undefined && gte !== null;
      const hasLte = lte !== undefined && lte !== null;
      if (hasGte || hasLte) {
        where[key] = {};
        if (hasGte) where[key].gte = gte;
        if (hasLte) where[key].lte = lte;
      }
    }

    // Filtro por especialista (usado na tela "Meus Produtos")
    if (appliedFilters?.specialist_id) {
      where.specialist_id = appliedFilters.specialist_id;
    }

    // Agrupamento das operções para serem realizadas no banco de dados
    const [boats, total] = await this.prismaService.$transaction([
      this.prismaService.boat.findMany({
        skip: skip,
        take: take,
        where: where,
        include: {
          images: true,
          specialist: true,
        },
      }),
      this.prismaService.boat.count({ where }),
    ]);

    // Converter as keys do S3 em URLs assinadas para cada barco
    const boatEntities: Boat[] = await Promise.all(
      boats.map(async (boat) => {
        let imagesWithUrls: any[] = [];
        if (boat.images && boat.images.length > 0) {
          imagesWithUrls = await Promise.all(
            boat.images.map(async (image) => ({
              ...image,
              image_url: await this.s3Service.getSignedUrl(image.image_url),
            }))
          );
        }

        return {
          ...boat,
          descricao: boat.descricao_completa,
          valor: boat.valor.toNumber(),
          images: imagesWithUrls,
          specialist: boat.specialist
            ? UserEntity.fromPrisma(boat.specialist)
            : null,
        };
      })
    );

    return {
      data: boatEntities,
      count: total,
      filters: appliedFilters,
    };
  }

  async findOne(id: number) {
    const boat = await this.prismaService.boat.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!boat) {
      throw new NotFoundException('Boat not found');
    }

    // Converter as keys do S3 em URLs assinadas
    if (boat.images && boat.images.length > 0) {
      const imagesWithUrls = await Promise.all(
        boat.images.map(async (image) => ({
          ...image,
          image_url: await this.s3Service.getSignedUrl(image.image_url),
        }))
      );
      return { ...boat, images: imagesWithUrls };
    }

    return { ...boat };
  }

  async update(id: number, updateBoatDto: UpdateBoatDto) {
    await this.findOne(id);

    const { images, ...boatData } = updateBoatDto;

    try {
      // 1. Atualizar dados do barco
      await this.prismaService.boat.update({ where: { id }, data: boatData });

      // 2. Se houver novas imagens, processar
      if (images && images.length > 0) {
        // Remover imagens antigas
        await this.prismaService.boat_image.deleteMany({
          where: { boat_id: id },
        });

        // Adicionar novas imagens
        for (let i = 0; i < images.length; i++) {
          const image = images[i];

          const timestamp = Date.now();
          const key = `boats/${id}/${timestamp}-${i}.jpg`;

          const imageKey = await this.s3Service.uploadBase64Image(image.data, key);

          await this.prismaService.boat_image.create({
            data: {
              boat_id: id,
              image_url: imageKey,
              is_primary: image.is_primary,
              product_type: 'BOAT',
            },
          });
        }
      }

      // 3. Retornar o barco atualizado com imagens
      return await this.prismaService.boat.findUnique({
        where: { id },
        include: { images: true },
      });
    } catch (error) {
      throw new Error(`Erro ao atualizar lancha: ${error.message}`);
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    try {
      await this.prismaService.boat.delete({ where: { id } });
      return { ok: true };
    } catch (error) {
      throw new Error(`Erro ao deletar lancha: ${error.message}`);
    }
  }
}
