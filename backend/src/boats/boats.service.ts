import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
import { CsvImportService, CsvColumnDefinition } from 'src/shared/services/csv-import.service';
import { CsvImportResponseDto, CsvErrorRow } from 'src/shared/dto/csv-import-response.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class BoatsService {
  // Definição das colunas do CSV para barcos
  private readonly csvColumns: CsvColumnDefinition[] = [
    { name: 'marca', required: true, type: 'string' },
    { name: 'modelo', required: true, type: 'string' },
    { name: 'valor', required: true, type: 'number' },
    { name: 'estado', required: true, type: 'string' },
    { name: 'ano', required: true, type: 'number' },
    { name: 'fabricante', required: false, type: 'string' },
    { name: 'tamanho', required: false, type: 'string' },
    { name: 'estilo', required: false, type: 'string' },
    { name: 'combustivel', required: false, type: 'string' },
    { name: 'motor', required: false, type: 'string' },
    { name: 'ano_motor', required: false, type: 'number' },
    { name: 'tipo_embarcacao', required: false, type: 'string' },
    { name: 'descricao_completa', required: false, type: 'string' },
    { name: 'acessorios', required: false, type: 'string' },
    { name: 'imagem', required: false, type: 'string' }, // URL ou base64
  ];

  constructor(
    private prismaService: PrismaService,
    private s3Service: S3Service,
    private csvImportService: CsvImportService,
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

  /**
   * Retorna o template CSV para importação de barcos
   */
  getCsvTemplate() {
    const requiredColumns = this.csvColumns.filter(c => c.required).map(c => c.name);
    const optionalColumns = this.csvColumns.filter(c => !c.required).map(c => c.name);
    
    const templateHeader = this.csvColumns.map(c => c.name).join(',');
    const exampleRow = 'Azimut,55 Fly,3500000,São Paulo,2022,Azimut,55 pés,Flybridge,Diesel,Volvo Penta D6,2022,Lancha,Embarcação em excelente estado com todos os opcionais,GPS Garmin - Ar condicionado - Gerador,https://example.com/imagem.jpg';

    return {
      template: `${templateHeader}\n${exampleRow}`,
      columns: {
        required: requiredColumns,
        optional: optionalColumns,
      },
      instructions: {
        marca: 'Nome da marca da embarcação (texto)',
        modelo: 'Nome do modelo (texto)',
        valor: 'Preço em reais (número inteiro, sem pontos ou vírgulas)',
        estado: 'Estado onde a embarcação está localizada (texto)',
        ano: 'Ano de fabricação (número)',
        fabricante: 'Nome do fabricante (texto, opcional)',
        tamanho: 'Tamanho em pés ou metros (texto, opcional)',
        estilo: 'Estilo: Flybridge, Sport, Open, etc (opcional)',
        combustivel: 'Tipo de combustível: Diesel, Gasolina (opcional)',
        motor: 'Modelo do motor (texto, opcional)',
        ano_motor: 'Ano do motor (número, opcional)',
        tipo_embarcacao: 'Tipo: Lancha, Veleiro, Iate, Jet Ski, etc (opcional)',
        descricao_completa: 'Descrição detalhada da embarcação (texto, opcional)',
        acessorios: 'Lista de acessórios separados por hífen (opcional)',
        imagem: 'URL da imagem ou string base64 (opcional)',
      },
      example: {
        marca: 'Azimut',
        modelo: '55 Fly',
        valor: 3500000,
        estado: 'São Paulo',
        ano: 2022,
        fabricante: 'Azimut',
        tamanho: '55 pés',
        estilo: 'Flybridge',
        combustivel: 'Diesel',
        motor: 'Volvo Penta D6',
        ano_motor: 2022,
        tipo_embarcacao: 'Lancha',
        descricao_completa: 'Embarcação em excelente estado com todos os opcionais',
        acessorios: 'GPS Garmin - Ar condicionado - Gerador',
        imagem: 'https://example.com/imagem.jpg',
      },
    };
  }

  /**
   * Importa barcos a partir de um CSV
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
        const boatData: any = {
          marca: row.marca,
          modelo: row.modelo,
          valor: Number(row.valor),
          estado: row.estado,
          ano: Number(row.ano),
          specialist_id: user.id,
        };

        // Campos opcionais
        if (row.fabricante) boatData.fabricante = row.fabricante;
        if (row.tamanho) boatData.tamanho = row.tamanho;
        if (row.estilo) boatData.estilo = row.estilo;
        if (row.combustivel) boatData.combustivel = row.combustivel;
        if (row.motor) boatData.motor = row.motor;
        if (row.ano_motor) boatData.ano_motor = Number(row.ano_motor);
        if (row.tipo_embarcacao) boatData.tipo_embarcacao = row.tipo_embarcacao;
        if (row.descricao_completa) boatData.descricao_completa = row.descricao_completa;
        if (row.acessorios) boatData.acessorios = row.acessorios;

        // Validar usando class-validator
        const dto = plainToInstance(CreateBoatDto, boatData);
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

        // Criar o barco
        const boat = await this.prismaService.boat.create({ data: boatData });

        // Processar imagem se fornecida
        if (row.imagem && row.imagem.trim()) {
          try {
            const timestamp = Date.now();
            const key = `boats/${boat.id}/${timestamp}-0.jpg`;
            const imageKey = await this.s3Service.uploadImageAuto(row.imagem, key);

            await this.prismaService.boat_image.create({
              data: {
                boat_id: boat.id,
                image_url: imageKey,
                is_primary: true,
                product_type: 'BOAT',
              },
            });
          } catch (imageError) {
            console.warn(`Erro ao processar imagem para barco ${boat.id}: ${imageError.message}`);
          }
        }

        insertedIds.push(boat.id);
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
