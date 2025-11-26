import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProcessDTO } from './dto/create-process.dto';
import {
  ProcessResponse,
  ProcessWithProducts,
  Product,
} from './entity/process.entity';

@Injectable()
export class ProcessesService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Cria um objeto "product" de acordo com o processo enviado
   *
   * @param {ProcessWithProducts} process
   * @returns  {Product | null}
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
   * @param {CreateProcessDTO} data
   * @returns {Promise<ProcessResponse>}
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
      [`${fieldName}_id`]: createProcessDto.product_id,
    };

    // Verificar se o processo já existe
    const processAlreadyExists = await this.prismaService.process.findFirst({
      where: whereClause,
    });
    if(processAlreadyExists){
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
        finalProduct.aircraft_id = createProcessDto.product_id;
        include.aircraft = true;
        break;
      case 'CAR':
        finalProduct.car_id = createProcessDto.product_id;
        include.car = true;
        break;
      case 'BOAT':
        finalProduct.boat_id = createProcessDto.product_id;
        include.boat = true;
        break;
    }

    const processCreated = await this.prismaService.process.create({
      data: { specialist_id, client_id, ...dataToSave, ...finalProduct },
      include,
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
}
