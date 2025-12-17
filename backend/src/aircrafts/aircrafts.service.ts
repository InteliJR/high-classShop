import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateAircraftDto } from './dto/create-aircraft.dto';
import { UpdateAircraftDto } from './dto/update-aircraft.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/aws/s3.service';
import { QueryDto } from 'src/shared/dto/query.dto';
import {
  ContainsAircraftFilters,
  ExactAircraftFilters,
  FiltersAircraftMeta,
  RangeAircraftFilters,
} from 'src/shared/dto/filters.dto';
import { Prisma } from '@prisma/client';
import { Aircraft } from './entity/aircraft.entity';
import { UserEntity } from 'src/auth/entities/user.entity';
import { CsvImportService, CsvColumnDefinition } from 'src/shared/services/csv-import.service';
import { CsvImportResponseDto, CsvErrorRow } from 'src/shared/dto/csv-import-response.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class AircraftsService {
  // Definição das colunas do CSV para aeronaves
  private readonly csvColumns: CsvColumnDefinition[] = [
    { name: 'marca', required: true, type: 'string' },
    { name: 'modelo', required: true, type: 'string' },
    { name: 'valor', required: true, type: 'number' },
    { name: 'estado', required: true, type: 'string' },
    { name: 'ano', required: true, type: 'number' },
    { name: 'categoria', required: false, type: 'string' },
    { name: 'assentos', required: false, type: 'number' },
    { name: 'tipo_aeronave', required: false, type: 'string' },
    { name: 'descricao', required: false, type: 'string' },
    { name: 'imagem', required: false, type: 'string' }, // URL ou base64
  ];

  constructor(
    private prismaService: PrismaService,
    private s3Service: S3Service,
    private csvImportService: CsvImportService,
  ) {}

  async create(createAircraftDto: CreateAircraftDto) {
    const { specialist_id, images, ...aircraftData } = createAircraftDto;

    const payload: Prisma.AircraftUncheckedCreateInput = {
      categoria: aircraftData.categoria,
      ano: aircraftData.ano,
      marca: aircraftData.marca,
      modelo: aircraftData.modelo,
      assentos: aircraftData.assentos,
      estado: aircraftData.estado,
      descricao: aircraftData.descricao,
      valor: aircraftData.valor,
      tipo_aeronave: aircraftData.tipo_aeronave,
      specialist_id: specialist_id ?? null,
    };

    try {
      // 1. Criar a aeronave
      const aircraft = await this.prismaService.aircraft.create({ data: payload });

      // 2. Processar e fazer upload das imagens, se existirem
      if (images && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const image = images[i];

          const timestamp = Date.now();
          const key = `aircrafts/${aircraft.id}/${timestamp}-${i}.jpg`;

          const imageKey = await this.s3Service.uploadBase64Image(image.data, key);

          await this.prismaService.aircraft_image.create({
            data: {
              aircraft_id: aircraft.id,
              image_url: imageKey,
              is_primary: image.is_primary,
              product_type: 'AIRCRAFT',
            },
          });
        }
      }

      // 3. Retornar a aeronave com as imagens
      return await this.prismaService.aircraft.findUnique({
        where: { id: aircraft.id },
        include: { images: true },
      });
    } catch (error) {
      throw new Error(`Erro ao criar aeronave: ${error.message}`);
    }
  }

  // async create(data: CreateAircraftDto) {

  //   return this.prismaService.aircraft.create( {data});
  // }

  async getAllAircrafts({
    page,
    perPage,
    appliedFilters,
  }: QueryDto<FiltersAircraftMeta>) {
    // Cálculo das variáveis que serão utilizadas
    const take = perPage;
    const skip = page && take ? (page - 1) * take : 0;

    // Separação dos filtros
    const where: any = {};

    // Exact
    const exacts: ExactAircraftFilters = {
      estado: appliedFilters?.estado,
      tipo_aeronave: appliedFilters?.tipo_aeronave,
    };
    // Insere a filtragem na variável where
    for (const [key, value] of Object.entries(exacts)) {
      if (value !== undefined && value !== null) {
        where[key] = value;
      }
    }

    // Contains
    const contains: ContainsAircraftFilters = {
      categoria: appliedFilters?.categoria,
      marca: appliedFilters?.marca,
      modelo: appliedFilters?.modelo,
    };
    // Insere a filtragem a variável where
    for (const [key, value] of Object.entries(contains)) {
      if (value !== undefined && value !== null) {
        where[key] = { contains: value, mode: 'insensitive' };
      }
    }

    // Range
    const rangeFilters: RangeAircraftFilters = {
      ...appliedFilters,
    };
    // Objeto para orientar o where wu utiliza gte e lte
    const rangeMap = {
      ano: { gte: rangeFilters?.ano_max, lte: rangeFilters?.ano_min },
      preco: { gte: rangeFilters?.preco_max, lte: rangeFilters?.preco_min },
      assento: {
        gte: rangeFilters?.assentos_max,
        lte: rangeFilters?.assentos_min,
      },
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

    //Agrupamento das operações que serão realizadas no banco de dados
    const [aircrafts, total] = await this.prismaService.$transaction([
      this.prismaService.aircraft.findMany({
        skip: skip,
        take: take,
        where: where,
        include: {
          images: true,
          specialist: true,
        },
      }),
      this.prismaService.aircraft.count({ where }),
    ]);

    // Converter as keys do S3 em URLs assinadas para cada aeronave
    const aircraftsEntities: Aircraft[] = await Promise.all(
      aircrafts.map(async (aircraft) => {
        let imagesWithUrls: any[] = [];
        if (aircraft.images && aircraft.images.length > 0) {
          imagesWithUrls = await Promise.all(
            aircraft.images.map(async (image) => ({
              ...image,
              image_url: await this.s3Service.getSignedUrl(image.image_url),
            }))
          );
        }

        return {
          ...aircraft,
          valor: aircraft.valor.toNumber(),
          images: imagesWithUrls,
          specialist: aircraft.specialist
            ? UserEntity.fromPrisma(aircraft.specialist)
            : null,
        };
      })
    );

    return {
      data: aircraftsEntities,
      count: total,
      filters: appliedFilters,
    };
  }

  async findOne(id: number) {
    const aircraft = await this.prismaService.aircraft.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!aircraft) {
      throw new NotFoundException('Car not found');
    }

    // Converter as keys do S3 em URLs assinadas
    if (aircraft.images && aircraft.images.length > 0) {
      const imagesWithUrls = await Promise.all(
        aircraft.images.map(async (image) => ({
          ...image,
          image_url: await this.s3Service.getSignedUrl(image.image_url),
        }))
      );
      return { ...aircraft, images: imagesWithUrls };
    }

    return { ...aircraft };
  }

  // update(id: number, updateAircraftDto: UpdateAircraftDto) {
  //   return `This action updates a #${id} aircraft`;
  // }

  async update(id: number, updateAircraftDto: UpdateAircraftDto) {
    await this.findOne(id);

    const { specialist_id, images, ...aircraftData } = updateAircraftDto;
    const payload: Prisma.AircraftUncheckedUpdateInput = {};

    if (aircraftData.categoria !== undefined) {
      payload.categoria = aircraftData.categoria;
    }
    if (aircraftData.ano !== undefined) {
      payload.ano = aircraftData.ano;
    }
    if (aircraftData.marca !== undefined) {
      payload.marca = aircraftData.marca;
    }
    if (aircraftData.modelo !== undefined) {
      payload.modelo = aircraftData.modelo;
    }
    if (aircraftData.assentos !== undefined) {
      payload.assentos = aircraftData.assentos;
    }
    if (aircraftData.estado !== undefined) {
      payload.estado = aircraftData.estado;
    }
    if (aircraftData.descricao !== undefined) {
      payload.descricao = aircraftData.descricao;
    }
    if (aircraftData.valor !== undefined) {
      payload.valor = aircraftData.valor;
    }
    if (aircraftData.tipo_aeronave !== undefined) {
      payload.tipo_aeronave = aircraftData.tipo_aeronave;
    }
    if (specialist_id !== undefined) {
      payload.specialist_id = specialist_id ?? null;
    }

    try {
      // 1. Atualizar dados da aeronave
      await this.prismaService.aircraft.update({ where: { id }, data: payload });

      // 2. Se houver novas imagens, processar
      if (images && images.length > 0) {
        // Remover imagens antigas
        await this.prismaService.aircraft_image.deleteMany({
          where: { aircraft_id: id },
        });

        // Adicionar novas imagens
        for (let i = 0; i < images.length; i++) {
          const image = images[i];

          const timestamp = Date.now();
          const key = `aircrafts/${id}/${timestamp}-${i}.jpg`;

          const imageKey = await this.s3Service.uploadBase64Image(image.data, key);

          await this.prismaService.aircraft_image.create({
            data: {
              aircraft_id: id,
              image_url: imageKey,
              is_primary: image.is_primary,
              product_type: 'AIRCRAFT',
            },
          });
        }
      }

      // 3. Retornar a aeronave atualizada com imagens
      return await this.prismaService.aircraft.findUnique({
        where: { id },
        include: { images: true },
      });
    } catch (error) {
      throw new Error(`Erro ao atualizar aeronave: ${error.message}`);
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    try {
      await this.prismaService.aircraft.delete({ where: { id } });
      return { ok: true };
    } catch (error) {
      throw new Error(`Erro ao deletar aeronave: ${error.message}`);
    }
  }

  /**
   * Retorna o template CSV para importação de aeronaves
   */
  getCsvTemplate() {
    const requiredColumns = this.csvColumns.filter(c => c.required).map(c => c.name);
    const optionalColumns = this.csvColumns.filter(c => !c.required).map(c => c.name);
    
    const templateHeader = this.csvColumns.map(c => c.name).join(',');
    const exampleRow = 'Embraer,Phenom 300,15000000,São Paulo,2021,Light Jet,8,Jato Executivo,Aeronave com baixas horas de voo e interior renovado,https://example.com/imagem.jpg';

    return {
      template: `${templateHeader}\n${exampleRow}`,
      columns: {
        required: requiredColumns,
        optional: optionalColumns,
      },
      instructions: {
        marca: 'Nome da marca da aeronave (texto)',
        modelo: 'Nome do modelo (texto)',
        valor: 'Preço em reais (número inteiro, sem pontos ou vírgulas)',
        estado: 'Estado onde a aeronave está localizada (texto)',
        ano: 'Ano de fabricação (número)',
        categoria: 'Categoria: Light Jet, Midsize, Large Cabin, etc (opcional)',
        assentos: 'Número de assentos (número, opcional)',
        tipo_aeronave: 'Tipo: Jato Executivo, Turboélice, Helicóptero, etc (opcional)',
        descricao: 'Descrição detalhada da aeronave (texto, opcional)',
        imagem: 'URL da imagem ou string base64 (opcional)',
      },
      example: {
        marca: 'Embraer',
        modelo: 'Phenom 300',
        valor: 15000000,
        estado: 'São Paulo',
        ano: 2021,
        categoria: 'Light Jet',
        assentos: 8,
        tipo_aeronave: 'Jato Executivo',
        descricao: 'Aeronave com baixas horas de voo e interior renovado',
        imagem: 'https://example.com/imagem.jpg',
      },
    };
  }

  /**
   * Importa aeronaves a partir de um CSV
   */
  async importFromCsv(csvContent: string, user: UserEntity): Promise<CsvImportResponseDto> {
    // 1. Validar estrutura do CSV
    const structureValidation = this.csvImportService.validateStructure(csvContent, this.csvColumns);
    
    if (!structureValidation.valid) {
      throw new BadRequestException({
        message: 'Estrutura do CSV inválida',
        errors: structureValidation.errors,
        missingRequired: structureValidation.missingRequired,
        unknownColumns: structureValidation.unknownColumns,
      });
    }

    // 2. Parsear o CSV
    const rows = this.csvImportService.parseCSV(csvContent);
    
    const insertedIds: number[] = [];
    const errorRows: CsvErrorRow[] = [];

    // 3. Processar cada linha
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +2 porque linha 1 é header e arrays começam em 0
      const row = rows[i];

      try {
        // Preparar DTO
        const aircraftData: any = {
          marca: row.marca,
          modelo: row.modelo,
          valor: Number(row.valor),
          estado: row.estado,
          ano: Number(row.ano),
          specialist_id: user.id,
        };

        // Campos opcionais
        if (row.categoria) aircraftData.categoria = row.categoria;
        if (row.assentos) aircraftData.assentos = Number(row.assentos);
        if (row.tipo_aeronave) aircraftData.tipo_aeronave = row.tipo_aeronave;
        if (row.descricao) aircraftData.descricao = row.descricao;

        // Validar usando class-validator
        const dto = plainToInstance(CreateAircraftDto, aircraftData);
        const validationErrors = await validate(dto, { whitelist: true });

        if (validationErrors.length > 0) {
          const errorMessages = validationErrors.map(err => {
            const constraints = err.constraints ? Object.values(err.constraints) : [];
            return `${err.property}: ${constraints.join(', ')}`;
          });
          
          errorRows.push({
            row: rowNumber,
            reason: errorMessages.join('; '),
            fields: row,
          });
          continue;
        }

        // Criar a aeronave
        const aircraft = await this.prismaService.aircraft.create({ 
          data: {
            categoria: aircraftData.categoria,
            ano: aircraftData.ano,
            marca: aircraftData.marca,
            modelo: aircraftData.modelo,
            assentos: aircraftData.assentos,
            estado: aircraftData.estado,
            descricao: aircraftData.descricao,
            valor: aircraftData.valor,
            tipo_aeronave: aircraftData.tipo_aeronave,
            specialist_id: aircraftData.specialist_id ?? null,
          }
        });

        // Processar imagem se fornecida
        if (row.imagem && row.imagem.trim()) {
          try {
            const timestamp = Date.now();
            const key = `aircrafts/${aircraft.id}/${timestamp}-0.jpg`;
            const imageKey = await this.s3Service.uploadImageAuto(row.imagem, key);

            await this.prismaService.aircraft_image.create({
              data: {
                aircraft_id: aircraft.id,
                image_url: imageKey,
                is_primary: true,
                product_type: 'AIRCRAFT',
              },
            });
          } catch (imageError) {
            console.warn(`Erro ao processar imagem para aeronave ${aircraft.id}: ${imageError.message}`);
          }
        }

        insertedIds.push(aircraft.id);
      } catch (error) {
        errorRows.push({
          row: rowNumber,
          reason: error.message || 'Erro desconhecido ao processar linha',
          fields: row,
        });
      }
    }

    return this.csvImportService.createResponse(insertedIds, errorRows);
  }
}
