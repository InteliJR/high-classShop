import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
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
    const processAlreadyExists = await this.prismaService.process.findFirst({
      where: whereClause,
    });
    if (processAlreadyExists) {
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
          take,
          skip,
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
}
