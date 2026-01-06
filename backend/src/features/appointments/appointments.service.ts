import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateAppointmentDto,
  GetAppointmentsQueryDto,
  UpdateAppointmentStatusDto,
} from './dto';
import {
  AppointmentResponseEntity,
  ClientResponseDto,
  SpecialistResponseDto,
  ProductResponseDto,
} from './entities/appointment.response';
import {
  StatusAgendamento,
  UserRole,
  ProductType,
  User,
  Car,
  Boat,
  Aircraft,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';

/**
 * AppointmentsService
 *
 * Serviço responsável por toda lógica de negócio de agendamentos (Appointments)
 * Integração com Calendly (Opção C - simplificada):
 *
 * Fluxo:
 * 1. Especialista configura URL do Calendly via PATCH /specialists/:id/calendly-url
 * 2. Cliente acessa link e agenda na plataforma Calendly (fora do sistema)
 * 3. Cliente retorna à plataforma e submete CreateAppointmentDto
 * 4. Sistema cria Appointment + auto-cria Process em status SCHEDULING
 * 5. Especialista confirma (PUT /appointments/:id/status com COMPLETED)
 * 6. Se Process estava em SCHEDULING, move para NEGOTIATION
 *
 * Validações:
 * - appointment_datetime deve ser futuro
 * - Detectar conflitos de horário (especialista já agendado)
 * - Sugerir 3 horários alternativos em caso de conflito
 * - Proteger transição de status (não permitir downgrade lógico)
 * - Respeitar permissões por role
 */
@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Cria novo agendamento
   *
   * Fluxo:
   * 1. Validar que cliente e especialista existem
   * 2. Validar que appointment_datetime é futuro
   * 3. Verificar conflitos de horário
   * 4. Validar que produto existe e pertence ao especialista
   * 5. Criar Appointment
   * 6. Auto-criar Process em status SCHEDULING
   * 7. Retornar AppointmentResponseEntity
   *
   * @param dto Dados do agendamento
   * @param userId ID do usuário autenticado (JWT)
   * @returns Appointment criado com dados completos
   * @throws BadRequestException Se dados inválidos
   * @throws ConflictException Se conflito de horário
   * @throws NotFoundException Se usuário ou produto não encontrado
   */
  async create(
    dto: CreateAppointmentDto,
    userId: string,
  ): Promise<AppointmentResponseEntity> {
    // Validação 1: appointment_datetime deve ser futuro
    const now = new Date();
    if (new Date(dto.appointment_datetime) <= now) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message: 'Data/hora do agendamento deve ser futura',
          details: {
            appointment_datetime: [
              'appointment_datetime deve ser futuro, não pode ser no passado ou presente',
            ],
          },
        },
      });
    }

    // Validação 2: Verificar que cliente existe
    const client = await this.prisma.user.findUnique({
      where: { id: dto.client_id },
    });
    if (!client) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 404,
          message: 'Cliente não encontrado',
          details: {
            client_id: dto.client_id,
          },
        },
      });
    }

    // Validação 3: Verificar que especialista existe e tem role SPECIALIST
    const specialist = await this.prisma.user.findUnique({
      where: { id: dto.specialist_id },
    });
    if (!specialist) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 404,
          message: 'Especialista não encontrado',
          details: {
            specialist_id: dto.specialist_id,
          },
        },
      });
    }

    if (
      specialist.role !== UserRole.SPECIALIST &&
      specialist.role !== UserRole.CONSULTANT
    ) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message: 'Usuário não é especialista',
          details: {
            specialist_id: dto.specialist_id,
            role: specialist.role,
          },
        },
      });
    }

    // Validação 4: Validar que especialidade do especialista corresponde ao product_type
    if (specialist.speciality && specialist.speciality !== dto.product_type) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message: 'Especialista não trabalha com este tipo de produto',
          details: {
            specialist_speciality: specialist.speciality,
            requested_product_type: dto.product_type,
          },
        },
      });
    }

    // Validação 5: Verificar que cliente e especialista são diferentes
    if (dto.client_id === dto.specialist_id) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message: 'Cliente e especialista não podem ser a mesma pessoa',
          details: {
            client_id: dto.client_id,
            specialist_id: dto.specialist_id,
          },
        },
      });
    }

    // Validação 6: Verificar que produto existe e pertence ao especialista
    let product: Car | Boat | Aircraft | null = null;
    if (dto.product_type === ProductType.CAR) {
      product = await this.prisma.car.findUnique({
        where: { id: dto.product_id },
      });
      if (!product || product.specialist_id !== dto.specialist_id) {
        throw new NotFoundException({
          success: false,
          error: {
            code: 404,
            message: 'Carro não encontrado ou não pertence ao especialista',
            details: {
              product_id: dto.product_id,
              specialist_id: dto.specialist_id,
            },
          },
        });
      }
    } else if (dto.product_type === ProductType.BOAT) {
      product = await this.prisma.boat.findUnique({
        where: { id: dto.product_id },
      });
      if (!product || product.specialist_id !== dto.specialist_id) {
        throw new NotFoundException({
          success: false,
          error: {
            code: 404,
            message: 'Barco não encontrado ou não pertence ao especialista',
            details: {
              product_id: dto.product_id,
              specialist_id: dto.specialist_id,
            },
          },
        });
      }
    } else if (dto.product_type === ProductType.AIRCRAFT) {
      product = await this.prisma.aircraft.findUnique({
        where: { id: dto.product_id },
      });
      if (!product || product.specialist_id !== dto.specialist_id) {
        throw new NotFoundException({
          success: false,
          error: {
            code: 404,
            message: 'Aeronave não encontrada ou não pertence ao especialista',
            details: {
              product_id: dto.product_id,
              specialist_id: dto.specialist_id,
            },
          },
        });
      }
    }

    // Validação 7: Verificar conflitos de horário (especialista não pode ter 2 agendamentos no mesmo horário)
    // Considerar janela de 1 hora para evitar overlap (ex: agendamento 14:00-15:00)
    const conflictStart = new Date(
      new Date(dto.appointment_datetime).getTime() - 60 * 60 * 1000,
    );
    const conflictEnd = new Date(
      new Date(dto.appointment_datetime).getTime() + 60 * 60 * 1000,
    );

    const existingAppointment = await this.prisma.appointment.findFirst({
      where: {
        specialist_id: dto.specialist_id,
        appointment_datetime: {
          gte: conflictStart,
          lte: conflictEnd,
        },
        status: { in: [StatusAgendamento.SCHEDULED] }, // Apenas agendamentos ativos
      },
    });

    if (existingAppointment) {
      // Gerar 3 sugestões de horários alternativos (próximas 3 horas disponíveis)
      const suggestedTimes = await this.suggestAlternativeTimes(
        dto.specialist_id,
        new Date(dto.appointment_datetime),
      );

      throw new ConflictException({
        success: false,
        error: {
          code: 409,
          message: 'Especialista já possui agendamento neste horário',
          details: {
            conflicting_appointment: {
              id: existingAppointment.id,
              appointment_datetime:
                existingAppointment.appointment_datetime.toISOString(),
              client_id: existingAppointment.client_id,
            },
            suggested_times: suggestedTimes, // Retornar formato ISO 8601 UTC
          },
        },
      });
    }

    // Criar Appointment
    const appointment = await this.prisma.appointment.create({
      data: {
        client_id: dto.client_id,
        specialist_id: dto.specialist_id,
        product_type: dto.product_type,
        product_id: dto.product_id,
        appointment_datetime: new Date(dto.appointment_datetime),
        status: StatusAgendamento.SCHEDULED,
        notes: dto.notes,
      },
      include: {
        client: true,
        specialist: true,
      },
    });

    // Auto-criar Process vinculado a este Appointment
    // Process começa em status SCHEDULING (agendamento confirmado)
    const process = await this.prisma.process.create({
      data: {
        client_id: dto.client_id,
        specialist_id: dto.specialist_id,
        product_type: dto.product_type,
        appointment_id: appointment.id,
        [dto.product_type === ProductType.CAR
          ? 'car_id'
          : dto.product_type === ProductType.BOAT
            ? 'boat_id'
            : 'aircraft_id']: dto.product_id,
        status: 'SCHEDULING', // ProcessStatus enum
        notes: `Criado via agendamento (Calendly integration). Cliente agendou em ${appointment.appointment_datetime.toISOString()}`,
      },
    });

    // Montar resposta com dados completos
    return this.mapToResponseEntity(appointment, client, specialist, product);
  }

  /**
   * Lista agendamentos com paginação, filtros e ordenação
   * Respeita permissões por role:
   * - CUSTOMER: vê apenas seus próprios agendamentos
   * - SPECIALIST/CONSULTANT: vê como especialista + seus clientes
   * - ADMIN: vê todos
   *
   * @param query Query parameters (paginação, filtros, ordenação)
   * @param userId ID do usuário autenticado
   * @param userRole Role do usuário autenticado
   * @returns Objeto com array de appointments + metadados (paginação, resumo)
   */
  async getAppointments(
    query: GetAppointmentsQueryDto,
    userId: string,
    userRole: UserRole,
  ): Promise<{
    success: boolean;
    message: string;
    data: AppointmentResponseEntity[];
    meta: {
      pagination: {
        current_page: number;
        per_page: number;
        total: number;
        total_pages: number;
        has_next: boolean;
        has_prev: boolean;
      };
      summary: {
        upcoming: number;
        completed: number;
        cancelled: number;
      };
    };
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Construir filtro WHERE conforme permissões
    const where: any = {};

    // Aplicar filtros de role
    if (userRole === UserRole.CUSTOMER) {
      where.client_id = userId; // Customer vê apenas seus agendamentos como cliente
    } else if (
      userRole === UserRole.SPECIALIST ||
      userRole === UserRole.CONSULTANT
    ) {
      // Specialist vê como especialista OU como cliente
      where.OR = [{ specialist_id: userId }, { client_id: userId }];
    }
    // ADMIN vê todos (sem filtro de user_id)

    // Aplicar filtros de query
    if (query.status) {
      where.status = query.status;
    }
    if (query.product_type) {
      where.product_type = query.product_type;
    }
    if (query.client_id) {
      // Verificar permissão de ver este cliente
      if (userRole === UserRole.CUSTOMER && query.client_id !== userId) {
        throw new ForbiddenException({
          success: false,
          error: {
            code: 403,
            message: 'Não tem permissão para ver agendamentos de outro cliente',
          },
        });
      }
      where.client_id = query.client_id;
    }
    if (query.specialist_id) {
      // Verificar permissão de ver este especialista
      if (userRole === UserRole.SPECIALIST && query.specialist_id !== userId) {
        throw new ForbiddenException({
          success: false,
          error: {
            code: 403,
            message:
              'Não tem permissão para ver agendamentos de outro especialista',
          },
        });
      }
      where.specialist_id = query.specialist_id;
    }

    // Aplicar filtros de data (convertendo de YYYY-MM-DD para DateTime UTC)
    if (query.date_from || query.date_to) {
      where.appointment_datetime = {};
      if (query.date_from) {
        where.appointment_datetime.gte = new Date(
          `${query.date_from}T00:00:00Z`,
        );
      }
      if (query.date_to) {
        where.appointment_datetime.lte = new Date(`${query.date_to}T23:59:59Z`);
      }
    }

    // Contar total de registros
    const total = await this.prisma.appointment.count({ where });
    const totalPages = Math.ceil(total / limit);

    // Buscar appointments com relacionamentos
    const sortBy = (query.sort || 'appointment_datetime') as string;
    const order = (query.order || 'ASC') as 'ASC' | 'DESC';

    const appointments = await this.prisma.appointment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: order },
      include: {
        client: true,
        specialist: true,
      },
    });

    // Mapear para response entities
    const data = await Promise.all(
      appointments.map(async (apt) => {
        const product = await this.getProductByType(
          apt.product_type,
          apt.product_id,
        );
        return this.mapToResponseEntity(
          apt,
          apt.client,
          apt.specialist,
          product,
        );
      }),
    );

    // Calcular sumário
    const summary = await this.prisma.appointment.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    const summaryMap = {
      upcoming:
        summary.find((s) => s.status === StatusAgendamento.SCHEDULED)?._count ||
        0,
      completed:
        summary.find((s) => s.status === StatusAgendamento.COMPLETED)?._count ||
        0,
      cancelled:
        summary.find((s) => s.status === StatusAgendamento.CANCELLED)?._count ||
        0,
    };

    return {
      success: true,
      message: 'Agendamentos listados com sucesso',
      data,
      meta: {
        pagination: {
          current_page: page,
          per_page: limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
        summary: summaryMap,
      },
    };
  }

  /**
   * Obtém um agendamento específico por ID
   * Valida que usuário tem permissão de acesso
   *
   * @param id ID do appointment (UUID)
   * @param userId ID do usuário autenticado
   * @param userRole Role do usuário autenticado
   * @returns Appointment com dados completos
   * @throws NotFoundException Se appointment não encontrado
   * @throws ForbiddenException Se usuário não tem permissão de acesso
   */
  async getById(
    id: string,
    userId: string,
    userRole: UserRole,
  ): Promise<AppointmentResponseEntity> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true,
        specialist: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 404,
          message: 'Agendamento não encontrado',
          details: { appointment_id: id },
        },
      });
    }

    // Verificar permissão: apenas participantes (client/specialist) ou admin
    const isParticipant =
      appointment.client_id === userId || appointment.specialist_id === userId;
    if (!isParticipant && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 403,
          message: 'Não tem permissão para acessar este agendamento',
          details: { appointment_id: id },
        },
      });
    }

    const product = await this.getProductByType(
      appointment.product_type,
      appointment.product_id,
    );
    return this.mapToResponseEntity(
      appointment,
      appointment.client,
      appointment.specialist,
      product,
    );
  }

  /**
   * Atualiza status de um agendamento
   *
   * Fluxo crítico:
   * 1. Se novo status é COMPLETED:
   *    - Encontra Process vinculado
   *    - Se Process está em SCHEDULING, move para NEGOTIATION (permite próxima fase)
   *    - Se Process já está em NEGOTIATION+, não retrocede (evita conflito lógico)
   * 2. Validar que usuário é participante ou admin
   * 3. Atualizar appointment_datetime e notes se fornecidos
   * 4. Retornar appointment atualizado
   *
   * @param id ID do appointment (UUID)
   * @param dto Status novo + notas opcionais
   * @param userId ID do usuário autenticado
   * @param userRole Role do usuário autenticado
   * @returns Appointment atualizado
   * @throws NotFoundException Se appointment não encontrado
   * @throws ForbiddenException Se usuário não tem permissão de atualizar
   * @throws BadRequestException Se transição de status é inválida
   */
  async updateStatus(
    id: string,
    dto: UpdateAppointmentStatusDto,
    userId: string,
    userRole: UserRole,
  ): Promise<AppointmentResponseEntity> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true,
        specialist: true,
        process: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 404,
          message: 'Agendamento não encontrado',
          details: { appointment_id: id },
        },
      });
    }

    // Verificar permissão: apenas participantes ou admin
    const isParticipant =
      appointment.client_id === userId || appointment.specialist_id === userId;
    if (!isParticipant && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 403,
          message: 'Não tem permissão para atualizar este agendamento',
          details: { appointment_id: id },
        },
      });
    }

    // Atualizar appointment
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: dto.status,
        notes: dto.notes || appointment.notes,
        updated_at: new Date(),
      },
      include: {
        client: true,
        specialist: true,
        process: true,
      },
    });

    // LÓGICA CRÍTICA: Se status muda para COMPLETED, atualizar Process vinculado
    if (dto.status === StatusAgendamento.COMPLETED && appointment.process) {
      const process = appointment.process;

      // Só move para NEGOTIATION se Process está em SCHEDULING
      // Evita conflito se já está em NEGOTIATION+ (não retrocede)
      if (process.status === 'SCHEDULING') {
        await this.prisma.process.update({
          where: { id: process.id },
          data: {
            status: 'NEGOTIATION',
            notes: `${process.notes || ''}\n[AUTO] Transição automática: SCHEDULING → NEGOTIATION (agendamento confirmado em ${new Date().toISOString()})`,
            updated_at: new Date(),
          },
        });
      } else if (
        ![
          'NEGOTIATION',
          'PROCESSING_CONTRACT',
          'DOCUMENTATION',
          'COMPLETED',
        ].includes(process.status)
      ) {
        // Warn se Process está em estado inesperado
        console.warn(
          `[WARNING] Appointment ${id} marked COMPLETED but Process ${process.id} is in unexpected status: ${process.status}`,
        );
      }
      // Se Process já está em NEGOTIATION ou além, não faz nada (mantém integridade lógica)
    }

    // Retornar appointment atualizado
    const product = await this.getProductByType(
      updated.product_type,
      updated.product_id,
    );
    return this.mapToResponseEntity(
      updated,
      updated.client,
      updated.specialist,
      product,
    );
  }

  /**
   * Verifica conflitos de horário e sugere 3 horários alternativos
   *
   * Estratégia: procurar próximas 3 horas livres após o horário solicitado
   * Considerar blocos de 1 hora
   *
   * @param specialistId ID do especialista
   * @param requestedTime Horário solicitado
   * @returns Array com 3 horários sugeridos em ISO 8601 UTC
   */
  private async suggestAlternativeTimes(
    specialistId: string,
    requestedTime: Date,
  ): Promise<string[]> {
    const suggestions: string[] = [];
    let checkTime = new Date(requestedTime);

    // Procurar 3 horários livres
    while (suggestions.length < 3) {
      // Avançar 1 hora
      checkTime = new Date(checkTime.getTime() + 60 * 60 * 1000);

      // Verificar se este horário está livre
      const conflictStart = new Date(checkTime.getTime() - 60 * 60 * 1000);
      const conflictEnd = new Date(checkTime.getTime() + 60 * 60 * 1000);

      const conflict = await this.prisma.appointment.findFirst({
        where: {
          specialist_id: specialistId,
          appointment_datetime: {
            gte: conflictStart,
            lte: conflictEnd,
          },
          status: StatusAgendamento.SCHEDULED,
        },
      });

      if (!conflict) {
        suggestions.push(checkTime.toISOString());
      }
    }

    return suggestions;
  }

  /**
   * Helper: Busca um produto conforme seu tipo e ID
   * Retorna dados do Car, Boat ou Aircraft
   *
   * @param productType Tipo do produto (CAR, BOAT, AIRCRAFT)
   * @param productId ID do produto (car_id, boat_id ou aircraft_id)
   * @returns Produto encontrado ou null
   */
  private async getProductByType(
    productType: ProductType,
    productId: number,
  ): Promise<Car | Boat | Aircraft | null> {
    if (productType === ProductType.CAR) {
      return this.prisma.car.findUnique({ where: { id: productId } });
    } else if (productType === ProductType.BOAT) {
      return this.prisma.boat.findUnique({ where: { id: productId } });
    } else if (productType === ProductType.AIRCRAFT) {
      return this.prisma.aircraft.findUnique({ where: { id: productId } });
    }
    return null;
  }

  /**
   * Helper: Mapeia Appointment + relacionamentos para AppointmentResponseEntity
   * Aplica transformações (Expose decorators, tipos corretos)
   *
   * @param appointment Appointment do banco
   * @param client User (cliente)
   * @param specialist User (especialista)
   * @param product Car | Boat | Aircraft | null
   * @returns AppointmentResponseEntity com dados formatados
   */
  private mapToResponseEntity(
    appointment: any,
    client: User,
    specialist: User,
    product: Car | Boat | Aircraft | null,
  ): AppointmentResponseEntity {
    const entity = new AppointmentResponseEntity();

    entity.id = appointment.id;
    entity.appointment_datetime = appointment.appointment_datetime;
    entity.status = appointment.status;
    entity.notes = appointment.notes;
    entity.created_at = appointment.created_at;
    entity.updated_at = appointment.updated_at;

    // Dados do cliente
    const clientDto = new ClientResponseDto();
    clientDto.id = client.id;
    clientDto.name = client.name;
    clientDto.surname = client.surname;
    clientDto.email = client.email;
    entity.client = clientDto;

    // Dados do especialista
    const specialistDto = new SpecialistResponseDto();
    specialistDto.id = specialist.id;
    specialistDto.name = specialist.name;
    specialistDto.surname = specialist.surname;
    if (specialist.speciality) {
      specialistDto.speciality = specialist.speciality;
    }
    if (specialist.calendly_url) {
      specialistDto.calendly_url = specialist.calendly_url;
    }
    entity.specialist = specialistDto;

    // Dados do produto
    if (product) {
      const productDto = new ProductResponseDto();
      productDto.id = product.id;
      productDto.product_type = appointment.product_type;
      productDto.marca = product.marca;
      productDto.modelo = product.modelo;
      // Converter Decimal do Prisma para número
      const valorNum =
        typeof product.valor === 'string'
          ? parseFloat(product.valor)
          : Number(product.valor);
      productDto.valor = valorNum;
      entity.product = productDto;
    }

    // Usar class-transformer para aplicar Expose/Exclude
    return plainToInstance(AppointmentResponseEntity, entity, {
      excludeExtraneousValues: true,
    });
  }
}
