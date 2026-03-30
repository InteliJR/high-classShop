import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProcessDTO } from './dto/create-process.dto';
import {
  ProcessResponse,
  ProcessWithProducts,
  Product,
} from './entity/process.response.entity';
import { QueryDto } from 'src/shared/dto/query.dto';
import { ProcessStatus, StatusAgendamento } from '@prisma/client';
import { ProcessesByStatus } from 'src/shared/dto/summary.dto';
import { UpdateProcessDto } from './dto/update-process.dto';
import { ProcessWithHistory } from './entity/process-history.response';
import { NotificationService } from 'src/features/notifications/notification.service';

@Injectable()
export class ProcessesService {
  private readonly logger = new Logger(ProcessesService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Cria um objeto "product" de acordo com o processo enviado
   *
   * @param {ProcessWithProducts} process - processo com o produto car, boats ou aircraft
   * @returns  {Product | null} - retorna o produto específico
   */
  private buildProduct(process: ProcessWithProducts): Product | null {
    // Mapa de acordo com o tipo de produtos existente
    const productMap = {
      CAR: 'car',
      BOAT: 'boat',
      AIRCRAFT: 'aircraft',
    } as const;

    // Consultoria: processo sem produto_type
    if (!process.product_type) return null;

    // Obtém qual é a relação de produto no process
    const relation = productMap[process.product_type];
    if (!relation) return null;

    // Obtém as informações do produto
    const product = process[relation];
    if (!product) return null;

    return {
      id: product.id,
      marca: product.marca,
      modelo: product.modelo,
    };
  }

  /**
   * Helper: Retorna o product_id (car_id, boat_id ou aircraft_id) do processo
   *
   * @param {ProcessWithProducts} process - processo com os produtos includos
   * @returns {number | null} - ID do produto ou null se for consultoria
   */
  private getProductId(process: ProcessWithProducts | any): number | null {
    if (!process.product_type) return null;

    // Retorna o ID específico baseado no tipo de produto
    switch (process.product_type) {
      case 'CAR':
        return process.car_id || null;
      case 'BOAT':
        return process.boat_id || null;
      case 'AIRCRAFT':
        return process.aircraft_id || null;
      default:
        return null;
    }
  }

  /**
   * Helper: Retorna descrição formatada do produto para emails
   *
   * @param process - processo com produto incluído
   * @returns string formatada "Marca Modelo"
   */
  private getProductDetails(process: any): string {
    const productMap: Record<string, string> = {
      CAR: 'car',
      BOAT: 'boat',
      AIRCRAFT: 'aircraft',
    };

    const relation = productMap[process.product_type];
    if (!relation || !process[relation]) {
      return 'Produto não especificado';
    }

    const product = process[relation];
    return `${product.marca || ''} ${product.modelo || ''}`.trim() || 'Produto';
  }

  /**
   * Cria um processo, normalmente no status de agendamento
   *
   * @param {CreateProcessDTO} createProcessDto - Dto para criar o processo
   * @returns {Promise<ProcessResponse>} - Entidade do processo
   */
  async create(createProcessDto: CreateProcessDTO): Promise<ProcessResponse> {
    this.logger.log(
      `[create] Iniciando criação de processo para cliente ${createProcessDto.client_id}`,
    );
    const { product_id, client_id, specialist_id, ...dataToSave } =
      createProcessDto;

    // Map para os produtos existentes
    const productMap = {
      CAR: 'car',
      BOAT: 'boat',
      AIRCRAFT: 'aircraft',
    } as const;

    // Para processo com produto (não consultoria)
    const hasProduct =
      createProcessDto.product_type && createProcessDto.product_id;

    // Atribuir o produto correto passado pela req
    const fieldName = hasProduct
      ? productMap[createProcessDto.product_type!]
      : null;

    // Verificar se o processo já existe (apenas para processos com produto)
    if (hasProduct) {
      // TODO: Trocar para string quando o id for colocado como UUID
      // Construção do where usando computed property
      const whereClause: {
        client_id: string;
        specialist_id: string;
        aircraft_id?: number;
        boat_id?: number;
        car_id?: number;
      } = {
        client_id,
        specialist_id,
        [`${fieldName}_id`]: Number(createProcessDto.product_id),
      };

      // Verificar se o processo já existe
      this.logger.debug('[create] Verificando se processo já existe');
      const processAlreadyExists = await this.prismaService.process.findFirst({
        where: whereClause,
      });
      if (processAlreadyExists) {
        this.logger.warn(
          `[create] Processo já existe para cliente ${client_id} e produto ${product_id}`,
        );
        throw new BadRequestException();
      }
    }

    // Criação de um objeto para incluir na response do processo
    const include = {
      client: true,
      specialist: true,
      aircraft: false,
      car: false,
      boat: false,
    };
    // TODO: trocar para string quando for trocado para UUID
    const finalProduct: {
      aircraft_id: number | null;
      boat_id: number | null;
      car_id: number | null;
    } = {
      aircraft_id: null,
      boat_id: null,
      car_id: null,
    };

    // Preenchimento do id e o include do produto de acordo com o tipo dele
    switch (createProcessDto.product_type) {
      case 'AIRCRAFT':
        finalProduct.aircraft_id = Number(createProcessDto.product_id);
        include.aircraft = true;
        break;
      case 'CAR':
        finalProduct.car_id = Number(createProcessDto.product_id);
        include.car = true;
        break;
      case 'BOAT':
        finalProduct.boat_id = Number(createProcessDto.product_id);
        include.boat = true;
        break;
    }

    // Criar o processo e adiciona os status inicial dele na tabela de histórico
    const processCreated = await this.prismaService.$transaction(async (tx) => {
      const process = await tx.process.create({
        data: { specialist_id, client_id, ...dataToSave, ...finalProduct },
        include,
      });

      await tx.processStatusHistory.create({
        data: {
          processId: process.id,
          status: process.status,
          changed_at: new Date(),
        },
      });

      return process;
    });

    return {
      id: processCreated.id,
      status: processCreated.status,
      product_type: processCreated.product_type,
      product_id: this.getProductId(processCreated),
      client: {
        id: processCreated.client_id,
        email: processCreated.client?.email,
        name: processCreated.client?.name,
      },
      specialist: {
        especialidade: processCreated.specialist.speciality,
        id: processCreated.specialist.id,
        name: processCreated.specialist.name,
      },
      product: this.buildProduct(processCreated),
      created_at: processCreated.created_at,
      notes: processCreated.notes,
    };
  }

  /**
   * Retorna os processos de com a contagem total de elementos no banco de dados
   *
   * @param {QueryDto} - Parâmetros de paginação
   * @returns {Promise<{
   *  count: number,
   *  processes: ProcessResponse[],
   *  byStatus: Record<ProcessStatus, number>
   * }>} - Objeto com numero total de elementos, array de processos e contagem de processos por status
   */
  async getAll({
    page,
    perPage,
    status,
    search,
    sortBy = 'created_at',
    order = 'desc',
  }: QueryDto & {
    status?: ProcessStatus;
    search?: string;
    sortBy?: 'created_at' | 'updated_at' | 'status';
    order?: 'asc' | 'desc';
  }): Promise<{
    count: number;
    processes: ProcessResponse[];
    byStatus: Record<ProcessStatus, number>;
  }> {
    // Criação de variáveis para a paginação
    const take = perPage;
    const skip = page && take ? (page - 1) * take : 0;

    // Construir filtros WHERE
    const where: any = {};

    // Filtro de status
    if (status) {
      where.status = status;
    }

    // Filtro de busca textual (nome cliente, email, marca/modelo produto)
    if (search && search.trim()) {
      where.OR = [
        {
          client: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        {
          car: {
            OR: [
              { marca: { contains: search, mode: 'insensitive' } },
              { modelo: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        {
          boat: {
            OR: [
              { marca: { contains: search, mode: 'insensitive' } },
              { modelo: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        {
          aircraft: {
            OR: [
              { marca: { contains: search, mode: 'insensitive' } },
              { modelo: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    // Construir ordenação
    const orderBy: any = {};
    orderBy[sortBy] = order;

    // Buscar os processos, a quantidade total e a quantidade por status de processo
    const [processes, count, rawStatusCount] =
      await this.prismaService.$transaction([
        this.prismaService.process.findMany({
          where,
          skip,
          take,
          orderBy,
          include: {
            client: true,
            aircraft: true,
            boat: true,
            car: true,
            specialist: true,
            appointment: { select: { status: true } },
          },
        }),
        this.prismaService.process.count({ where }),
        this.prismaService.process.groupBy({
          by: ['status'],
          orderBy: {
            status: 'asc',
          },
          _count: {
            id: true,
          },
        }),
      ]);

    //Adequar a contagem de status na tipagem correta
    // Deixa ela mais curta
    const statusCount = rawStatusCount.reduce((acc: any, item: any) => {
      const id = item._count?.id ?? 0;
      acc[item.status] = id;
      return acc;
    }, {} as ProcessesByStatus);

    // Adequa a resposta de acordo com a tipagem
    const processEntities: ProcessResponse[] = processes.map(
      (process: any) => ({
        id: process.id,
        status: process.status,
        appointment_status: process.appointment?.status ?? null,
        product_type: process.product_type,
        product_id: this.getProductId(process),
        client: {
          id: process.client_id,
          email: process.client?.email,
          name: process.client?.name,
        },
        specialist: {
          especialidade: process.specialist.speciality,
          id: process.specialist.id,
          name: process.specialist.name,
        },
        product: this.buildProduct(process),
        created_at: process.created_at,
        notes: process.notes,
      }),
    );

    return {
      count,
      processes: processEntities,
      byStatus: statusCount,
    };
  }

  /**
   * Get a single process by its ID
   *
   * @param {string} processId - The ID of the process to retrieve
   * @returns {Promise<ProcessResponse>} - The process with all related data
   * @throws {NotFoundException} - Process not found with the given ID
   */
  async getById(processId: string): Promise<ProcessResponse> {
    try {
      const process = await this.prismaService.process.findUniqueOrThrow({
        where: { id: processId },
        include: {
          client: true,
          car: true,
          boat: true,
          aircraft: true,
          specialist: true,
          appointment: { select: { status: true } },
        },
      });

      return {
        id: process.id,
        status: process.status,
        appointment_status: process.appointment?.status ?? null,
        product_type: process.product_type,
        product_id: this.getProductId(process),
        client: {
          id: process.client_id,
          email: process.client?.email || '',
          name: process.client?.name || '',
        },
        specialist: {
          especialidade: process.specialist.speciality,
          id: process.specialist.id,
          name: process.specialist.name,
        },
        product: this.buildProduct(process),
        created_at: process.created_at,
        notes: process.notes,
      };
    } catch (err) {
      if (err.code === 'P2025') {
        throw new NotFoundException('Processo não encontrado');
      }
      throw new InternalServerErrorException('Erro ao buscar processo');
    }
  }

  /**
   * Get all processes created by a specific specialist
   *
   * @param {string} specialistId - The ID of the specialist
   * @param {QueryDto} queryDto - Query parameters (page, perPage)
   * @returns {Promise<{processes: ProcessResponse[], count: number}>} - Paginated list of specialist's processes
   */
  async getBySpecialistId(
    specialistId: string,
    { page, perPage }: QueryDto,
  ): Promise<{
    processes: ProcessResponse[];
    count: number;
  }> {
    // Ensure page and perPage are numbers
    const pageNum = Number(page) || 1;
    const perPageNum = Number(perPage) || 20;
    const skip = (pageNum - 1) * perPageNum;

    // Fetch processes and count in parallel
    const [processes, count] = await Promise.all([
      this.prismaService.process.findMany({
        where: {
          specialist_id: specialistId, // CRUCIAL FILTER
        },
        include: {
          client: true,
          car: true,
          boat: true,
          aircraft: true,
          specialist: true,
          appointment: { select: { status: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: perPageNum,
      }),
      this.prismaService.process.count({
        where: {
          specialist_id: specialistId,
        },
      }),
    ]);

    // Map processes to response entities
    const processEntities: ProcessResponse[] = processes.map(
      (process: any) => ({
        id: process.id,
        status: process.status,
        appointment_status: process.appointment?.status ?? null,
        product_type: process.product_type,
        product_id: this.getProductId(process),
        client: {
          id: process.client_id,
          email: process.client?.email,
          name: process.client?.name,
        },
        specialist: {
          especialidade: process.specialist.speciality,
          id: process.specialist.id,
          name: process.specialist.name,
        },
        product: this.buildProduct(process),
        created_at: process.created_at,
        notes: process.notes,
      }),
    );

    return {
      processes: processEntities,
      count,
    };
  }

  /**
   * Get all processes by specialist with filters
   *
   * @param {string} specialistId - The ID of the specialist
   * @param options - Filter options: page, perPage, status, search, sortBy, order
   * @returns {Promise<{processes: ProcessResponse[], count: number}>} - Filtered paginated list
   */
  async getBySpecialistIdWithFilters(
    specialistId: string,
    options: {
      page?: number;
      perPage?: number;
      status?: string;
      search?: string;
      sortBy?: string;
      order?: 'asc' | 'desc';
    },
  ): Promise<{
    processes: ProcessResponse[];
    count: number;
  }> {
    const pageNum = Number(options.page) || 1;
    const perPageNum = Number(options.perPage) || 20;
    const skip = (pageNum - 1) * perPageNum;
    const sortBy = options.sortBy || 'created_at';
    const order = options.order || 'desc';

    // Build where clause
    const where: any = {
      specialist_id: specialistId,
    };

    // Add status filter
    if (options.status) {
      where.status = options.status;
    }

    // Add search filter (client name/email, product marca/modelo)
    if (options.search && options.search.trim()) {
      const searchTerm = options.search.trim();
      where.OR = [
        { client: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { client: { email: { contains: searchTerm, mode: 'insensitive' } } },
        { car: { marca: { contains: searchTerm, mode: 'insensitive' } } },
        { car: { modelo: { contains: searchTerm, mode: 'insensitive' } } },
        { boat: { marca: { contains: searchTerm, mode: 'insensitive' } } },
        { boat: { modelo: { contains: searchTerm, mode: 'insensitive' } } },
        { aircraft: { marca: { contains: searchTerm, mode: 'insensitive' } } },
        { aircraft: { modelo: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    this.logger.log(
      `[getBySpecialistIdWithFilters] Buscando processos com filtros: ${JSON.stringify(options)}`,
    );

    // Fetch processes and count in parallel
    const [processes, count] = await Promise.all([
      this.prismaService.process.findMany({
        where,
        include: {
          client: true,
          car: true,
          boat: true,
          aircraft: true,
          specialist: true,
          appointment: { select: { status: true } },
        },
        orderBy: { [sortBy]: order },
        skip,
        take: perPageNum,
      }),
      this.prismaService.process.count({ where }),
    ]);

    // Map processes to response entities
    const processEntities: ProcessResponse[] = processes.map(
      (process: any) => ({
        id: process.id,
        status: process.status,
        appointment_status: process.appointment?.status ?? null,
        product_type: process.product_type,
        product_id: this.getProductId(process),
        client: {
          id: process.client_id,
          email: process.client?.email,
          name: process.client?.name,
        },
        specialist: {
          especialidade: process.specialist.speciality,
          id: process.specialist.id,
          name: process.specialist.name,
        },
        product: this.buildProduct(process),
        created_at: process.created_at,
        notes: process.notes,
      }),
    );

    return {
      processes: processEntities,
      count,
    };
  }

  /**
   * Atualiza os status de um processo
   *
   * @param {string} processId - id do processo para ser atualizado
   * @param {UpdateProcessDto} updateProcessDto - dto para atualizar os status de um process
   * @returns {Promise<ProcessWithHistory>} - Processo com o histórico
   * @throws {NotFoundException} - Não existe nenhum processo com o id passado
   * @throws {BadRequestException} - Request com status já aplicado
   * @throws {InternalServerErrorException} - Erro desconhecido
   */
  async update(
    processId: string,
    updateProcessDto: UpdateProcessDto,
  ): Promise<ProcessWithHistory> {
    try {
      // Transction para atualizar o processo, adicionar mais uma linha sobre o histórico de status do processo, e obter o histórico atualizado
      const [updatedProcess, updatedStatusHistory] =
        await this.prismaService.$transaction(async (tx) => {
          // Verificar se o processo realmente existe
          const existingProcess = await tx.process.findUniqueOrThrow({
            where: { id: processId },
          });
          //Verificar se ele já está com o status atualizado
          if (existingProcess.status === updateProcessDto.status) {
            throw new BadRequestException();
          }
          const process = await tx.process.update({
            data: {
              status: updateProcessDto.status,
              notes: updateProcessDto.notes,
              updated_at: new Date(),
            },
            where: {
              id: processId,
            },
          });
          await tx.processStatusHistory.create({
            data: {
              processId,
              status: updateProcessDto.status,
              changed_at: process.updated_at,
            },
          });
          const statusHistory = await tx.processStatusHistory.findMany({
            where: { processId },
          });
          return [process, statusHistory];
        });

      // Formar o response
      return {
        id: updatedProcess.id,
        notes: updatedProcess.notes,
        status: updatedProcess.status,
        updated_at: updatedProcess.updated_at,
        status_history: updatedStatusHistory,
      };
      // Tratamento de erros
    } catch (err) {
      if (err.code === 'P2002') {
        throw new NotFoundException();
      }
      if (err.status === 400) {
        throw new BadRequestException();
      }
      throw new InternalServerErrorException();
    }
  }

  /**
   * Associa um produto a um processo de consultoria
   * Usado quando especialista seleciona o produto após reunião com cliente
   *
   * @param processId - ID do processo de consultoria
   * @param dto - Dados do produto (product_type e product_id)
   * @param userId - ID do usuário que está fazendo a associação
   * @param userRole - Role do usuário
   * @returns Processo atualizado com produto
   * @throws NotFoundException - Processo não encontrado
   * @throws BadRequestException - Processo não está em SCHEDULING ou já tem produto
   * @throws ForbiddenException - Usuário não tem permissão
   */
  async assignProduct(
    processId: string,
    dto: { product_type: string; product_id: number },
    userId: string,
    userRole: string,
  ): Promise<ProcessResponse> {
    this.logger.log(
      `[assignProduct] Iniciando associação de produto ao processo ${processId}`,
    );

    // 1. Buscar processo
    const process = await this.prismaService.process.findUnique({
      where: { id: processId },
      include: {
        client: true,
        specialist: true,
        car: true,
        boat: true,
        aircraft: true,
      },
    });

    if (!process) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 404,
          message: 'Processo não encontrado',
          details: { process_id: processId },
        },
      });
    }

    // 2. Verificar permissão: apenas especialista do processo ou ADMIN
    if (process.specialist_id !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 403,
          message: 'Apenas o especialista do processo pode associar um produto',
          details: { specialist_id: process.specialist_id, user_id: userId },
        },
      });
    }

    // 3. Verificar que processo está em SCHEDULING
    if (process.status !== 'SCHEDULING') {
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message:
            'Produto só pode ser associado em processos no status SCHEDULING',
          details: { current_status: process.status },
        },
      });
    }

    // 4. Verificar que processo não tem produto (é consultoria)
    if (
      process.product_type ||
      process.car_id ||
      process.boat_id ||
      process.aircraft_id
    ) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message: 'Este processo já possui um produto associado',
          details: {
            product_type: process.product_type,
            car_id: process.car_id,
            boat_id: process.boat_id,
            aircraft_id: process.aircraft_id,
          },
        },
      });
    }

    // 5. Validar que produto existe
    const productType = dto.product_type as 'CAR' | 'BOAT' | 'AIRCRAFT';
    let product: any = null;

    switch (productType) {
      case 'CAR':
        product = await this.prismaService.car.findUnique({
          where: { id: dto.product_id },
        });
        break;
      case 'BOAT':
        product = await this.prismaService.boat.findUnique({
          where: { id: dto.product_id },
        });
        break;
      case 'AIRCRAFT':
        product = await this.prismaService.aircraft.findUnique({
          where: { id: dto.product_id },
        });
        break;
      default:
        throw new BadRequestException({
          success: false,
          error: {
            code: 400,
            message: 'Tipo de produto inválido',
            details: { product_type: dto.product_type },
          },
        });
    }

    if (!product) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 404,
          message: 'Produto não encontrado',
          details: { product_type: productType, product_id: dto.product_id },
        },
      });
    }

    // 6. Verificar que produto pertence ao especialista
    if (product.specialist_id !== process.specialist_id) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 403,
          message: 'O produto deve pertencer ao especialista do processo',
          details: {
            product_specialist_id: product.specialist_id,
            process_specialist_id: process.specialist_id,
          },
        },
      });
    }

    // 7. Verificar se agendamento foi confirmado pelo especialista
    // Regra de negócio: processo só avança para NEGOTIATION no momento da atribuição do produto,
    // desde que o appointment já esteja confirmado (SCHEDULED ou COMPLETED).
    let shouldAdvanceToNegotiation = false;
    if (process.appointment_id) {
      const appointment = await this.prismaService.appointment.findUnique({
        where: { id: process.appointment_id },
      });

      if (!appointment) {
        throw new NotFoundException({
          success: false,
          error: {
            code: 404,
            message: 'Agendamento não encontrado para este processo',
            details: { appointment_id: process.appointment_id },
          },
        });
      }

      if (
        appointment.status === StatusAgendamento.SCHEDULED ||
        appointment.status === StatusAgendamento.COMPLETED
      ) {
        shouldAdvanceToNegotiation = true;
        this.logger.log(
          `[assignProduct] Appointment ${appointment.id} confirmado (${appointment.status}) - processo avançará para NEGOTIATION`,
        );
      } else {
        throw new BadRequestException({
          success: false,
          error: {
            code: 400,
            message:
              'É necessário confirmar a reunião antes de associar o produto',
            details: {
              appointment_status: appointment.status,
              required_statuses: [
                StatusAgendamento.SCHEDULED,
                StatusAgendamento.COMPLETED,
              ],
            },
          },
        });
      }
    } else {
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message: 'Processo sem agendamento associado',
          details: { process_id: processId },
        },
      });
    }

    // 8. Atualizar processo com produto em transação
    const productField =
      productType === 'CAR'
        ? 'car_id'
        : productType === 'BOAT'
          ? 'boat_id'
          : 'aircraft_id';

    const updateData: any = {
      product_type: productType,
      [productField]: dto.product_id,
      notes: `${process.notes || ''}\n[${new Date().toISOString()}] Produto associado: ${product.marca} ${product.modelo}`,
      updated_at: new Date(),
    };

    // Se appointment já foi confirmado, avançar para NEGOTIATION
    if (shouldAdvanceToNegotiation) {
      updateData.status = 'NEGOTIATION';
      updateData.notes += `\n[AUTO] Avançado para NEGOTIATION (produto atribuído após confirmação da reunião)`;
    }

    const nextStatus = (updateData.status ?? process.status) as ProcessStatus;

    const [updatedProcess] = await this.prismaService.$transaction([
      this.prismaService.process.update({
        where: { id: processId },
        data: updateData,
        include: {
          client: true,
          specialist: true,
          car: true,
          boat: true,
          aircraft: true,
        },
      }),
      this.prismaService.processStatusHistory.create({
        data: {
          processId,
          status: nextStatus,
          changed_by: userId,
          changed_at: new Date(),
        },
      }),
    ]);

    this.logger.log(
      `[assignProduct] Produto ${productType}/${dto.product_id} associado ao processo ${processId}${shouldAdvanceToNegotiation ? ' - Avançado para NEGOTIATION' : ''}`,
    );

    // 8. Retornar processo atualizado
    return {
      id: updatedProcess.id,
      status: updatedProcess.status,
      product_type: updatedProcess.product_type,
      product_id: this.getProductId(updatedProcess),
      client: {
        id: updatedProcess.client_id,
        email: updatedProcess.client?.email,
        name: updatedProcess.client?.name,
      },
      specialist: {
        especialidade: updatedProcess.specialist.speciality,
        id: updatedProcess.specialist.id,
        name: updatedProcess.specialist.name,
      },
      product: this.buildProduct(updatedProcess),
      created_at: updatedProcess.created_at,
      notes: updatedProcess.notes,
    };
  }

  /**
   * Obtém a razão de conclusão de um processo
   *
   * @param {string} processId - Id do processo
   * @returns {Promise<string | null>} - Razão de conclusão ou null
   * @throws {NotFoundException} - Processo não encontrado
   */
  async getProcessCompletionReason(processId: string): Promise<string | null> {
    const process = await this.prismaService.process.findUnique({
      where: { id: processId },
      select: { id: true },
    });

    if (!process) {
      throw new NotFoundException(
        `Processo com id ${processId} não encontrado`,
      );
    }

    const statusHistory =
      await this.prismaService.processStatusHistory.findFirst({
        where: { processId },
        orderBy: { changed_at: 'desc' },
        select: { reason: true },
      });

    return statusHistory?.reason || null;
  }

  /**
   * Obtém um processo com dados do contrato ativo
   *
   * @param {string} processId - Id do processo
   * @returns {Promise<any>} - Processo com contrato ativo
   * @throws {NotFoundException} - Processo não encontrado
   */
  async getByIdWithActiveContract(processId: string): Promise<any> {
    const process = await this.prismaService.process.findUnique({
      where: { id: processId },
      include: {
        car: true,
        boat: true,
        aircraft: true,
      },
    });

    if (!process) {
      throw new NotFoundException(
        `Processo com id ${processId} não encontrado`,
      );
    }

    // Se houver contrato ativo, buscar seus dados completos
    let activeContract = null;
    if (process.active_contract_id) {
      activeContract = await this.prismaService.contract.findUnique({
        where: { id: process.active_contract_id },
        select: {
          id: true,
          file_name: true,
          provider_id: true,
          provider_status: true,
          status: true,
          original_pdf_url: true,
          created_at: true,
          signed_at: true,
        },
      });
    }

    return {
      id: process.id,
      status: process.status,
      notes: process.notes,
      product_type: process.product_type,
      active_contract_id: process.active_contract_id,
      activeContract,
      original_pdf_url: activeContract?.original_pdf_url,
      created_at: process.created_at,
      updated_at: process.updated_at,
    };
  }

  /**
   * Get all processes for a specific client
   *
   * @param {string} clientId - The ID of the client
   * @param {QueryDto} queryDto - Query parameters (page, perPage)
   * @returns {Promise<{processes: ProcessResponse[], count: number}>} - Paginated list of client's processes
   */
  async getByClientId(
    clientId: string,
    { page, perPage }: QueryDto,
  ): Promise<{
    processes: (ProcessResponse & { rejection_reason?: string | null })[];
    count: number;
  }> {
    const pageNum = Number(page) || 1;
    const perPageNum = Number(perPage) || 20;
    const skip = (pageNum - 1) * perPageNum;

    const [processes, count] = await Promise.all([
      this.prismaService.process.findMany({
        where: {
          client_id: clientId,
        },
        include: {
          client: true,
          car: true,
          boat: true,
          aircraft: true,
          specialist: true,
          appointment: { select: { status: true } },
          rejections: {
            orderBy: { rejected_at: 'desc' },
            take: 1,
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: perPageNum,
      }),
      this.prismaService.process.count({
        where: {
          client_id: clientId,
        },
      }),
    ]);

    const processEntities = processes.map((process: any) => ({
      id: process.id,
      status: process.status,
      appointment_status: process.appointment?.status ?? null,
      product_type: process.product_type,
      product_id: this.getProductId(process),
      client: {
        id: process.client_id,
        email: process.client?.email,
        name: process.client?.name,
      },
      specialist: {
        especialidade: process.specialist.speciality,
        id: process.specialist.id,
        name: process.specialist.name,
      },
      product: this.buildProduct(process),
      created_at: process.created_at,
      notes: process.notes,
      rejection_reason:
        process.status === 'REJECTED' && process.rejections?.length > 0
          ? process.rejections[0].rejection_reason
          : null,
    }));

    return {
      processes: processEntities,
      count,
    };
  }

  /**
   * Rejects a process with an optional reason
   *
   * @param {string} processId - The ID of the process to reject
   * @param {string} rejectedById - The ID of the user rejecting
   * @param {string} rejectionReason - Optional reason for rejection
   * @returns {Promise<ProcessWithHistory>} - Updated process with history
   * @throws {NotFoundException} - Process not found
   * @throws {BadRequestException} - Process already rejected
   */
  async rejectProcess(
    processId: string,
    rejectedById: string,
    rejectionReason?: string,
  ): Promise<ProcessWithHistory> {
    try {
      const [updatedProcess, updatedStatusHistory] =
        await this.prismaService.$transaction(async (tx) => {
          // Verificar se o processo existe
          const existingProcess = await tx.process.findUniqueOrThrow({
            where: { id: processId },
          });

          // Verificar se já está rejeitado
          if (existingProcess.status === 'REJECTED') {
            throw new BadRequestException('Processo já está rejeitado');
          }

          // Atualizar status para REJECTED
          const process = await tx.process.update({
            data: {
              status: 'REJECTED',
              updated_at: new Date(),
            },
            where: {
              id: processId,
            },
          });

          // Criar registro de histórico
          await tx.processStatusHistory.create({
            data: {
              processId,
              status: 'REJECTED',
              changed_at: process.updated_at,
            },
          });

          // Criar registro de rejeição (se houver motivo ou não)
          if (rejectedById) {
            await tx.processRejection.create({
              data: {
                process_id: processId,
                rejected_by_id: rejectedById,
                rejection_reason: rejectionReason || 'Sem motivo informado',
              },
            });
          }

          // Buscar histórico atualizado
          const statusHistory = await tx.processStatusHistory.findMany({
            where: { processId },
          });

          return [process, statusHistory];
        });

      return {
        id: updatedProcess.id,
        notes: updatedProcess.notes,
        status: updatedProcess.status,
        updated_at: updatedProcess.updated_at,
        status_history: updatedStatusHistory,
      };
    } catch (err) {
      if (err.code === 'P2025') {
        throw new NotFoundException('Processo não encontrado');
      }
      if (err.status === 400) {
        throw new BadRequestException(err.message);
      }
      throw new InternalServerErrorException('Erro ao rejeitar processo');
    }
  }

  /**
   * Confirma um agendamento de um processo em status SCHEDULING
   * Atualiza o appointment para SCHEDULED
   * Regra: o processo permanece em SCHEDULING e só avança para NEGOTIATION quando um produto for associado
   * Apenas o especialista pode confirmar
   *
   * @param {string} processId - Id do processo
   * @param {string} userId - Id do usuário autenticado
   * @returns {Promise<any>}
   * @throws {NotFoundException} - Processo ou appointment não encontrado
   * @throws {ForbiddenException} - Usuário não autorizado
   * @throws {BadRequestException} - Processo não está em status SCHEDULING
   */
  async confirmAppointment(processId: string, userId: string): Promise<any> {
    this.logger.log(
      `[confirmAppointment] Confirmando agendamento do processo ${processId}`,
    );

    // Buscar processo com appointment, client, specialist e produtos
    const process = await this.prismaService.process.findUnique({
      where: { id: processId },
      include: {
        appointment: true,
        client: {
          select: { id: true, email: true, name: true, surname: true },
        },
        specialist: {
          select: { id: true, email: true, name: true, surname: true },
        },
        car: true,
        boat: true,
        aircraft: true,
      },
    });

    if (!process) {
      throw new NotFoundException('Processo não encontrado');
    }

    // Verificar se o usuário é o especialista
    if (process.specialist_id !== userId) {
      throw new ForbiddenException(
        'Apenas o especialista pode confirmar o agendamento',
      );
    }

    // Verificar se está em status SCHEDULING
    if (process.status !== 'SCHEDULING') {
      throw new BadRequestException(
        'Apenas processos em status SCHEDULING podem ter o agendamento confirmado',
      );
    }

    // Verificar se tem appointment
    if (!process.appointment) {
      throw new NotFoundException(
        'Agendamento não encontrado para este processo',
      );
    }

    if (
      process.appointment.status === StatusAgendamento.SCHEDULED ||
      process.appointment.status === StatusAgendamento.COMPLETED
    ) {
      throw new BadRequestException('Agendamento já foi confirmado');
    }

    // Confirmar appointment em transação (sem alterar status do processo)
    await this.prismaService.$transaction(async (tx) => {
      // Atualizar appointment para SCHEDULED
      await tx.appointment.update({
        where: { id: process.appointment!.id },
        data: {
          status: StatusAgendamento.SCHEDULED,
          confirmed_at: new Date(),
          confirmed_by_id: userId,
        },
      });

      // Manter process em SCHEDULING e apenas registrar no histórico/notas
      await tx.process.update({
        where: { id: processId },
        data: {
          notes: process.notes
            ? `${process.notes}\n\nAgendamento confirmado pelo especialista (${new Date().toISOString()})`
            : `Agendamento confirmado pelo especialista (${new Date().toISOString()})`,
        },
      });
    });

    this.logger.log(
      `[confirmAppointment] Agendamento confirmado para processo ${processId}`,
    );

    // Fire-and-forget email notification (async, non-blocking)
    setImmediate(() => {
      this.notificationService
        .sendAppointmentConfirmedEmail({
          clientEmail: process.client.email,
          clientName:
            `${process.client.name} ${process.client.surname || ''}`.trim(),
          specialistName:
            `${process.specialist.name} ${process.specialist.surname || ''}`.trim(),
          appointmentDate:
            process.appointment!.appointment_datetime || new Date(),
          productDetails: this.getProductDetails(process),
          processId,
        })
        .catch((err) => {
          this.logger.error('Notification failed (non-critical)', {
            method: 'confirmAppointment',
            processId,
            error: err.message,
          });
        });
    });

    return {
      processId,
      status: 'SCHEDULING',
      appointment_status: StatusAgendamento.SCHEDULED,
    };
  }

  /**
   * Cancela um agendamento de um processo em status SCHEDULING
   * Deleta tanto o appointment quanto o processo
   * Cliente ou especialista podem cancelar
   *
   * @param {string} processId - Id do processo
   * @param {string} userId - Id do usuário autenticado
   * @returns {Promise<any>}
   * @throws {NotFoundException} - Processo ou appointment não encontrado
   * @throws {ForbiddenException} - Usuário não autorizado
   * @throws {BadRequestException} - Processo não está em status SCHEDULING
   */
  async cancelAppointment(processId: string, userId: string): Promise<any> {
    this.logger.log(
      `[cancelAppointment] Cancelando agendamento do processo ${processId}`,
    );

    // Buscar processo com appointment, client, specialist e produtos
    const process = await this.prismaService.process.findUnique({
      where: { id: processId },
      include: {
        appointment: true,
        client: {
          select: { id: true, email: true, name: true, surname: true },
        },
        specialist: {
          select: { id: true, email: true, name: true, surname: true },
        },
        car: true,
        boat: true,
        aircraft: true,
      },
    });

    if (!process) {
      throw new NotFoundException('Processo não encontrado');
    }

    // Verificar se o usuário é o cliente ou especialista
    const isClient = process.client_id === userId;
    const isSpecialist = process.specialist_id === userId;

    if (!isClient && !isSpecialist) {
      throw new ForbiddenException(
        'Sem permissão para cancelar este agendamento',
      );
    }

    // Verificar se está em status SCHEDULING
    if (process.status !== 'SCHEDULING') {
      throw new BadRequestException(
        'Apenas processos em status SCHEDULING podem ter o agendamento cancelado',
      );
    }

    // Verificar se tem appointment
    if (!process.appointment) {
      throw new NotFoundException(
        'Agendamento não encontrado para este processo',
      );
    }

    // Deletar appointment e process em transação
    await this.prismaService.$transaction(async (tx) => {
      // Deletar histórico do processo
      await tx.processStatusHistory.deleteMany({
        where: { processId },
      });

      // Deletar processo
      await tx.process.delete({
        where: { id: processId },
      });

      // Deletar appointment
      await tx.appointment.delete({
        where: { id: process.appointment!.id },
      });
    });

    this.logger.log(
      `[cancelAppointment] Agendamento e processo ${processId} deletados`,
    );

    // Fire-and-forget email notification (async, non-blocking)
    setImmediate(() => {
      const recipientId = isClient ? process.specialist_id : process.client_id;
      const recipient = isClient ? process.specialist : process.client;
      const canceller = isClient ? process.client : process.specialist;

      this.notificationService
        .sendAppointmentCancelledEmail({
          recipientEmail: recipient.email,
          recipientName: `${recipient.name} ${recipient.surname || ''}`.trim(),
          cancellerName: `${canceller.name} ${canceller.surname || ''}`.trim(),
          wasClient: isClient,
          appointmentDate:
            process.appointment!.appointment_datetime || new Date(),
          productDetails: this.getProductDetails(process),
        })
        .catch((err) => {
          this.logger.error('Notification failed (non-critical)', {
            method: 'cancelAppointment',
            processId,
            error: err.message,
          });
        });
    });

    return { success: true, message: 'Agendamento cancelado com sucesso' };
  }
}
