import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProcessDTO } from './dto/create-process.dto';
import {
  ProcessResponse,
  ProcessWithProducts,
  Product,
} from './entity/process.response.entity';
import { QueryDto } from 'src/shared/dto/query.dto';
import { ProcessStatus } from '@prisma/client';
import { ProcessesByStatus } from 'src/shared/dto/summary.dto';
import { UpdateProcessDto } from './dto/update-process.dto';
import { ProcessWithHistory } from './entity/process-history.response';

@Injectable()
export class ProcessesService {
  private readonly logger = new Logger(ProcessesService.name);

  constructor(private readonly prismaService: PrismaService) {}

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
    // Atribuir o produto correto passado pela req
    const fieldName = productMap[createProcessDto.product_type];

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
  async getAll({ page, perPage }: QueryDto): Promise<{
    count: number;
    processes: ProcessResponse[];
    byStatus: Record<ProcessStatus, number>;
  }> {
    // Criação pde variáveis para a paginação de get
    const take = perPage;
    const skip = page && take ? (page - 1) * take : 0;

    // Buscar os processos, a quantidade total e a quantidade por status de processo
    const [processes, count, rawStatusCount] =
      await this.prismaService.$transaction([
        this.prismaService.process.findMany({
          skip,
          take,
          include: {
            client: true,
            aircraft: true,
            boat: true,
            car: true,
            specialist: true,
          },
        }),
        this.prismaService.process.count(),
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
        product_type: process.product_type,
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
        },
      });

      return {
        id: process.id,
        status: process.status,
        product_type: process.product_type,
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
        product_type: process.product_type,
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
      product_type: process.product_type,
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
}
