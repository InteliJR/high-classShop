import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
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
import {
  XlsxImportService,
  XlsxColumnDefinition,
} from 'src/shared/services/xlsx-import.service';
import {
  ImportResponseDto,
  ImportErrorRow,
} from 'src/shared/dto/import-response.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class BoatsService {
  private readonly logger = new Logger(BoatsService.name);

  // Definição das colunas da planilha para barcos (sem 'imagens' — agora são embutidas)
  private readonly xlsxColumns: XlsxColumnDefinition[] = [
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
  ];

  constructor(
    private prismaService: PrismaService,
    private s3Service: S3Service,
    private xlsxImportService: XlsxImportService,
  ) {}

  async create(createBoatDto: CreateBoatDto) {
    this.logger.log('[create] Iniciando criação de novo barco');
    const { images, ...boatData } = createBoatDto;

    try {
      // 1. Criar o barco
      this.logger.debug(
        `[create] Criando barco: ${boatData.marca} ${boatData.modelo}`,
      );
      const boat = await this.prismaService.boat.create({ data: boatData });
      this.logger.log(`[create] Barco criado com sucesso - ID: ${boat.id}`);

      // 2. Processar e fazer upload das imagens, se existirem
      if (images && images.length > 0) {
        this.logger.log(
          `[create] Processando ${images.length} imagens para o barco ${boat.id}`,
        );
        for (let i = 0; i < images.length; i++) {
          const image = images[i];

          const timestamp = Date.now();
          const key = `boats/${boat.id}/${timestamp}-${i}.jpg`;

          this.logger.debug(
            `[create] Fazendo upload da imagem ${i + 1}/${images.length} para S3`,
          );
          const imageKey = await this.s3Service.uploadBase64Image(
            image.data,
            key,
          );

          await this.prismaService.boat_image.create({
            data: {
              boat_id: boat.id,
              image_url: imageKey,
              is_primary: image.is_primary,
              product_type: 'BOAT',
            },
          });
          this.logger.debug(`[create] Imagem ${i + 1} salva com sucesso`);
        }
        this.logger.log(
          `[create] Todas as ${images.length} imagens processadas com sucesso`,
        );
      }

      // 3. Retornar o barco com as imagens
      const boatWithImages = await this.prismaService.boat.findUnique({
        where: { id: boat.id },
        include: { images: true },
      });
      if (!boatWithImages) {
        throw new Error('Erro ao buscar barco criado');
      }
      this.logger.log(
        `[create] Barco ${boat.id} criado com sucesso com ${boatWithImages.images.length} imagens`,
      );
      return boatWithImages;
    } catch (error) {
      this.logger.error(
        `[create] Erro ao criar barco: ${error.message}`,
        error.stack,
      );
      throw new Error(`Erro ao criar barco: ${error.message}`);
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
            })),
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
      }),
    );

    return {
      data: boatEntities,
      count: total,
      filters: appliedFilters,
    };
  }

  async findOne(id: number) {
    this.logger.log(`[findOne] Buscando barco - ID: ${id}`);
    const boat = await this.prismaService.boat.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!boat) {
      this.logger.warn(`[findOne] Barco não encontrado - ID: ${id}`);
      throw new NotFoundException('Boat not found');
    }
    this.logger.log(`[findOne] Barco encontrado - ID: ${id}`);

    // Converter as keys do S3 em URLs assinadas
    if (boat.images && boat.images.length > 0) {
      const imagesWithUrls = await Promise.all(
        boat.images.map(async (image) => ({
          ...image,
          image_url: await this.s3Service.getSignedUrl(image.image_url),
        })),
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

          const imageKey = await this.s3Service.uploadBase64Image(
            image.data,
            key,
          );

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
   * Retorna o template XLSX para importação de barcos
   */
  async getXlsxTemplate(): Promise<Buffer> {
    const instructions: Record<string, string> = {
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
    };

    const example: Record<string, any> = {
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
      descricao_completa:
        'Embarcação em excelente estado com todos os opcionais',
      acessorios: 'GPS Garmin - Ar condicionado - Gerador',
    };

    return this.xlsxImportService.generateTemplate(
      this.xlsxColumns,
      example,
      instructions,
    );
  }

  /**
   * Importa barcos a partir de um arquivo XLSX
   */
  async importFromXlsx(
    fileBuffer: Buffer,
    user: UserEntity,
  ): Promise<ImportResponseDto> {
    // 1. Parsear a planilha XLSX (dados + imagens embutidas)
    const { rows, imageMap } =
      await this.xlsxImportService.parseWorkbook(fileBuffer);

    // 2. Validar estrutura
    const structureValidation = this.xlsxImportService.validateStructure(
      rows,
      this.xlsxColumns,
    );

    if (!structureValidation.valid) {
      throw new BadRequestException({
        message: 'Estrutura da planilha inválida',
        errors: structureValidation.errors,
        missingRequired: structureValidation.missingRequired,
        unknownColumns: structureValidation.unknownColumns,
      });
    }

    const insertedIds: number[] = [];
    const updatedIds: number[] = [];
    const errorRows: ImportErrorRow[] = [];
    const warningRows: ImportErrorRow[] = [];

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
        if (row.descricao_completa)
          boatData.descricao_completa = row.descricao_completa;
        if (row.acessorios) boatData.acessorios = row.acessorios;

        // Validar usando class-validator
        const dto = plainToInstance(CreateBoatDto, boatData);
        const validationErrors = await validate(dto, { whitelist: true });

        if (validationErrors.length > 0) {
          const errorMessages = validationErrors.map((err) => {
            const constraints = err.constraints
              ? Object.values(err.constraints)
              : [];
            return `${err.property}: ${constraints.join(', ')}`;
          });

          errorRows.push({
            row: rowNumber,
            reason: errorMessages.join('; '),
            fields: row,
          });
          continue;
        }

        // Verificar se já existe um produto com mesma marca + modelo para este especialista
        const existingBoat = await this.prismaService.boat.findFirst({
          where: {
            marca: row.marca?.trim(),
            modelo: row.modelo?.trim(),
            specialist_id: user.id,
          },
        });

        let boat: any;
        let isUpdate = false;

        if (existingBoat) {
          // Atualizar produto existente
          const { specialist_id, ...updateFields } = boatData;
          boat = await this.prismaService.boat.update({
            where: { id: existingBoat.id },
            data: updateFields,
          });
          isUpdate = true;
        } else {
          // Criar novo produto
          boat = await this.prismaService.boat.create({ data: boatData });
        }

        // Processar imagens embutidas da planilha
        const embeddedImages = imageMap.get(i) || [];

        if (embeddedImages.length > 0) {
          // Se é atualização, remover imagens antigas antes de adicionar novas
          if (isUpdate) {
            await this.prismaService.boat_image.deleteMany({
              where: { boat_id: boat.id },
            });
          }

          const imageErrors: string[] = [];
          let successCount = 0;

          for (let imgIdx = 0; imgIdx < embeddedImages.length; imgIdx++) {
            try {
              const img = embeddedImages[imgIdx];
              const timestamp = Date.now();
              const key = `boats/${boat.id}/${timestamp}-${imgIdx}.${img.extension}`;
              const contentType = `image/${img.extension === 'jpg' ? 'jpeg' : img.extension}`;
              const imageKey = await this.s3Service.uploadBuffer(
                img.buffer,
                key,
                contentType,
              );

              await this.prismaService.boat_image.create({
                data: {
                  boat_id: boat.id,
                  image_url: imageKey,
                  is_primary: imgIdx === 0,
                  product_type: 'BOAT',
                },
              });
              successCount++;
            } catch (imageError) {
              imageErrors.push(
                `Imagem ${imgIdx + 1}: ${imageError.message || 'Erro desconhecido'}`,
              );
            }
          }

          if (imageErrors.length > 0) {
            warningRows.push({
              row: rowNumber,
              reason: `Produto ${isUpdate ? 'atualizado' : 'criado'} (${successCount}/${embeddedImages.length} imagens processadas)`,
              fields: row,
              imageWarnings: imageErrors,
            });
          }
        }

        if (isUpdate) {
          updatedIds.push(boat.id);
        } else {
          insertedIds.push(boat.id);
        }
      } catch (error) {
        errorRows.push({
          row: rowNumber,
          reason: error.message || 'Erro desconhecido ao processar linha',
          fields: row,
        });
      }
    }

    return this.xlsxImportService.createResponse(
      insertedIds,
      errorRows,
      warningRows,
      updatedIds,
    );
  }
}
