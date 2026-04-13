import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CalendlyScheduledDto,
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
  CalendlySyncStatus,
  StatusAgendamento,
  UserRole,
  ProductType,
  User,
  Car,
  Boat,
  Aircraft,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import {
  parseDate,
  isFutureDate,
  formatToISO,
  suggestNextAvailableSlots,
} from 'src/shared/utils/date.utils';
import { NotificationService } from 'src/features/notifications/notification.service';
import { CalendlyIntegrationService } from './calendly-integration.service';

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
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private calendlyIntegrationService: CalendlyIntegrationService,
  ) {}

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
    this.logger.log(
      `[create] Criando agendamento para cliente ${dto.client_id} com especialista ${dto.specialist_id}`,
    );

    // Validação 1: appointment_datetime deve ser futuro (se fornecido)
    let appointmentDateTime: Date | null = null;
    if (dto.appointment_datetime) {
      appointmentDateTime = parseDate(dto.appointment_datetime);
      if (!appointmentDateTime) {
        this.logger.warn('[create] Data/hora do agendamento é inválida');
        throw new BadRequestException({
          success: false,
          error: {
            code: 400,
            message: 'Data/hora do agendamento é inválida',
            details: {
              appointment_datetime: [
                'appointment_datetime deve estar em formato ISO 8601 UTC válido',
              ],
            },
          },
        });
      }

      if (!isFutureDate(appointmentDateTime)) {
        this.logger.warn('[create] Data/hora do agendamento é no passado');
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
    }

    // Validação 2: Verificar que cliente existe
    this.logger.debug(
      `[create] Validando existência do cliente ${dto.client_id}`,
    );
    const client = await this.prisma.user.findUnique({
      where: { id: dto.client_id },
    });
    if (!client) {
      this.logger.error(`[create] Cliente ${dto.client_id} não encontrado`);
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
    let existingAppointment = null;
    if (appointmentDateTime) {
      const conflictStart = new Date(
        appointmentDateTime.getTime() - 60 * 60 * 1000,
      );
      const conflictEnd = new Date(
        appointmentDateTime.getTime() + 60 * 60 * 1000,
      );

      existingAppointment = await this.prisma.appointment.findFirst({
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
        const suggestedTimes = suggestNextAvailableSlots(
          appointmentDateTime,
          3,
        );

        throw new ConflictException({
          success: false,
          error: {
            code: 409,
            message: 'Especialista já possui agendamento neste horário',
            details: {
              conflicting_appointment: {
                id: existingAppointment.id,
                appointment_datetime: existingAppointment.appointment_datetime
                  ? formatToISO(existingAppointment.appointment_datetime)
                  : null,
                client_id: existingAppointment.client_id,
              },
              suggested_times: suggestedTimes, // Retornar formato ISO 8601 UTC
            },
          },
        });
      }
    }

    // Criar Appointment
    const appointment = await this.prisma.appointment.create({
      data: {
        client_id: dto.client_id,
        specialist_id: dto.specialist_id,
        product_type: dto.product_type,
        product_id: dto.product_id,
        appointment_datetime: appointmentDateTime || new Date(),
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
        notes: `Criado via agendamento (Calendly integration). Cliente agendou em ${appointment.appointment_datetime?.toISOString() || 'data pendente'}`,
      },
    });

    // Fire-and-forget: Notificar especialista sobre novo agendamento
    const productDetails = product
      ? `${(product as any).marca || ''} ${(product as any).modelo || ''}`.trim()
      : `Produto ${dto.product_type}`;

    setImmediate(() => {
      this.notificationService
        .sendAppointmentCreatedEmail({
          specialistEmail: specialist.email,
          specialistName:
            `${specialist.name} ${specialist.surname || ''}`.trim(),
          clientName: `${client.name} ${client.surname || ''}`.trim(),
          appointmentDate: appointment.appointment_datetime || new Date(),
          productDetails,
          processId: process.id,
        })
        .catch((err) => {
          this.logger.error('Notification failed (non-critical)', {
            method: 'create',
            appointmentId: appointment.id,
            error: err.message,
          });
        });
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
        // Verificar se processo tem produto associado
        const hasProduct =
          process.car_id || process.boat_id || process.aircraft_id;

        if (hasProduct) {
          // Processo com produto: avançar para NEGOTIATION
          await this.prisma.process.update({
            where: { id: process.id },
            data: {
              status: 'NEGOTIATION',
              notes: `${process.notes || ''}\n[AUTO] Transição automática: SCHEDULING → NEGOTIATION (agendamento concluído em ${new Date().toISOString()})`,
              updated_at: new Date(),
            },
          });

          // Registrar mudança de status no histórico
          await this.prisma.processStatusHistory.create({
            data: {
              processId: process.id,
              status: 'NEGOTIATION',
              changed_at: new Date(),
            },
          });

          this.logger.log(
            `[updateStatus] Process ${process.id} avançado para NEGOTIATION (agendamento concluído)`,
          );
        } else {
          // Consultoria (sem produto): manter em SCHEDULING até produto ser selecionado
          await this.prisma.process.update({
            where: { id: process.id },
            data: {
              notes: `${process.notes || ''}\n[AUTO] Reunião concluída em ${new Date().toISOString()}. Aguardando especialista selecionar produto para avançar para NEGOTIATION.`,
              updated_at: new Date(),
            },
          });

          this.logger.log(
            `[updateStatus] Process ${process.id} mantido em SCHEDULING (consultoria - aguardando seleção de produto)`,
          );
        }
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
   * @param productType Tipo do produto (CAR, BOAT, AIRCRAFT) ou null para consultoria
   * @param productId ID do produto (car_id, boat_id ou aircraft_id) ou null para consultoria
   * @returns Produto encontrado ou null (também para consultoria)
   */
  private async getProductByType(
    productType: ProductType | null,
    productId: number | null,
  ): Promise<Car | Boat | Aircraft | null> {
    // Para consultoria, não há produto ainda
    if (!productType || !productId) {
      return null;
    }

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
    entity.calendly_event_uri = appointment.calendly_event_uri;
    entity.calendly_invitee_uri = appointment.calendly_invitee_uri;
    entity.calendly_scheduled_at = appointment.calendly_scheduled_at;
    entity.calendly_last_sync_at = appointment.calendly_last_sync_at;
    entity.calendly_sync_status = appointment.calendly_sync_status;
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

  /**
   * Busca agendamento SCHEDULED entre cliente e especialista para um produto específico
   * Usado para impedir duplicatas e condicionalmente exibir botão de confirmação no frontend
   *
   * @param clientId ID do cliente (UUID)
   * @param specialistId ID do especialista (UUID)
   * @param productType Tipo de produto (CAR, BOAT, AIRCRAFT)
   * @param productId ID do produto (convertido para number)
   * @returns Appointment se encontrado e status = SCHEDULED, caso contrário null
   */
  async findScheduledAppointment(
    clientId: string,
    specialistId: string,
    productType: ProductType,
    productId: number | string,
  ): Promise<AppointmentResponseEntity | null> {
    // Converter productId para number (pode vir como string da query param)
    const productIdNum =
      typeof productId === 'string' ? parseInt(productId, 10) : productId;

    if (isNaN(productIdNum)) {
      this.logger.warn(
        `[findScheduledAppointment] productId inválido: ${productId}`,
      );
      return null;
    }

    this.logger.log(
      `[findScheduledAppointment] Buscando agendamento existente: cliente=${clientId}, especialista=${specialistId}, produto=${productType}/${productIdNum}`,
    );

    const appointment = await this.prisma.appointment.findFirst({
      where: {
        client_id: clientId,
        specialist_id: specialistId,
        product_type: productType,
        product_id: productIdNum,
        status: 'SCHEDULED',
      },
      include: {
        client: true,
        specialist: true,
      },
    });

    if (!appointment) {
      this.logger.log(
        `[findScheduledAppointment] Nenhum agendamento SCHEDULED encontrado`,
      );
      return null;
    }

    this.logger.log(
      `[findScheduledAppointment] Agendamento encontrado: ${appointment.id}`,
    );

    // Converter para AppointmentResponseEntity
    const entity = new AppointmentResponseEntity();
    entity.id = appointment.id;
    entity.appointment_datetime = appointment.appointment_datetime;
    entity.status = appointment.status;
    entity.notes = appointment.notes || undefined;
    entity.created_at = appointment.created_at;
    entity.updated_at = appointment.updated_at;

    const clientDto = new ClientResponseDto();
    clientDto.id = appointment.client.id;
    clientDto.name = appointment.client.name;
    clientDto.surname = appointment.client.surname;
    clientDto.email = appointment.client.email;
    entity.client = clientDto;

    const specialistDto = new SpecialistResponseDto();
    specialistDto.id = appointment.specialist.id;
    specialistDto.name = appointment.specialist.name;
    specialistDto.surname = appointment.specialist.surname;
    if (appointment.specialist.speciality) {
      specialistDto.speciality = appointment.specialist.speciality;
    }
    if (appointment.specialist.calendly_url) {
      specialistDto.calendly_url = appointment.specialist.calendly_url;
    }
    entity.specialist = specialistDto;

    return plainToInstance(AppointmentResponseEntity, entity, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Cria um agendamento PENDING
   * Usado quando cliente clica no link do Calendly e retorna à plataforma
   *
   * Dois fluxos suportados:
   * 1. Com produto: product_type e product_id fornecidos - fluxo padrão
   * 2. Consultoria: sem product_type/product_id - cliente quer orientação
   *
   * @param dto Dados do agendamento (product_type e product_id opcionais)
   * @param userId ID do cliente autenticado
   * @returns Appointment em status PENDING
   */
  async createPending(
    dto: CreateAppointmentDto,
    userId: string,
  ): Promise<AppointmentResponseEntity> {
    this.logger.log(
      `[createPending] Criando agendamento PENDING para cliente ${dto.client_id}`,
    );

    // Validar que quem está criando é o próprio cliente
    this.logger.log(
      `[createPending] Validando permissão: userId=${userId} vs client_id=${dto.client_id}`,
    );
    if (dto.client_id !== userId) {
      this.logger.error(
        `[createPending] ERRO: Cliente tentando criar agendamento para outro usuário`,
      );
      throw new ForbiddenException({
        success: false,
        error: {
          code: 403,
          message: 'Apenas o próprio cliente pode criar agendamentos pendentes',
        },
      });
    }
    this.logger.log(`[createPending] ✓ Permissão validada`);

    // Validar cliente existe
    this.logger.log(`[createPending] Buscando cliente ${dto.client_id}...`);
    const client = await this.prisma.user.findUnique({
      where: { id: dto.client_id },
    });
    if (!client) {
      this.logger.error(
        `[createPending] ERRO: Cliente ${dto.client_id} não encontrado`,
      );
      throw new NotFoundException({
        success: false,
        error: { code: 404, message: 'Cliente não encontrado' },
      });
    }
    this.logger.log(`[createPending] ✓ Cliente encontrado: ${client.name}`);

    // Validar especialista existe
    this.logger.log(
      `[createPending] Buscando especialista ${dto.specialist_id}...`,
    );
    const specialist = await this.prisma.user.findUnique({
      where: { id: dto.specialist_id },
    });
    if (!specialist) {
      this.logger.error(
        `[createPending] ERRO: Especialista ${dto.specialist_id} não encontrado`,
      );
      throw new NotFoundException({
        success: false,
        error: { code: 404, message: 'Especialista não encontrado' },
      });
    }
    this.logger.log(
      `[createPending] ✓ Especialista encontrado: ${specialist.name}`,
    );

    // Determinar se é consultoria (sem produto) ou fluxo padrão (com produto)
    const isConsultancy = !dto.product_type || !dto.product_id;
    this.logger.log(
      `[createPending] Modo: ${isConsultancy ? 'CONSULTORIA' : 'COM PRODUTO'}`,
    );

    // Verificar se já existe agendamento PENDING ou SCHEDULED
    this.logger.log(`[createPending] Verificando agendamento duplicado...`);
    let existingWhere: any = {
      client_id: dto.client_id,
      specialist_id: dto.specialist_id,
      status: {
        in: [StatusAgendamento.PENDING, StatusAgendamento.SCHEDULED],
      },
    };

    if (isConsultancy) {
      // Para consultoria, verificar se já existe agendamento sem produto
      existingWhere.product_type = null;
      existingWhere.product_id = null;
    } else {
      // Para fluxo normal, verificar por produto específico
      existingWhere.product_type = dto.product_type;
      existingWhere.product_id = dto.product_id;
    }

    const existing = await this.prisma.appointment.findFirst({
      where: existingWhere,
    });

    if (existing) {
      this.logger.error(
        `[createPending] ERRO: Agendamento duplicado encontrado: ${existing.id}`,
      );
      throw new ConflictException({
        success: false,
        error: {
          code: 409,
          message: isConsultancy
            ? 'Já existe um agendamento de consultoria pendente com este especialista'
            : 'Já existe um agendamento pendente ou confirmado para este produto',
          details: {
            existing_id: existing.id,
            existing_status: existing.status,
          },
        },
      });
    }
    this.logger.log(
      `[createPending] ✓ Nenhum agendamento duplicado encontrado`,
    );

    // Validar produto apenas se fornecido (não é consultoria)
    let product: any = null;
    if (!isConsultancy) {
      this.logger.log(
        `[createPending] Buscando produto ${dto.product_type}/${dto.product_id}...`,
      );
      product = await this.getProductByType(dto.product_type!, dto.product_id!);
      if (!product) {
        this.logger.error(
          `[createPending] ERRO: Produto ${dto.product_type}/${dto.product_id} não encontrado`,
        );
        throw new NotFoundException({
          success: false,
          error: { code: 404, message: 'Produto não encontrado' },
        });
      }
      this.logger.log(`[createPending] ✓ Produto encontrado`);
    } else {
      this.logger.log(
        `[createPending] Consultoria - pulando validação de produto`,
      );
    }

    // Criar appointment em status PENDING e Process em transação
    const pendingExpiresAt = new Date();
    pendingExpiresAt.setDate(pendingExpiresAt.getDate() + 7); // Expira em 7 dias

    this.logger.log(
      `[createPending] Iniciando transação para criar appointment e process`,
    );
    this.logger.log(`[createPending] Dados do DTO: ${JSON.stringify(dto)}`);

    let appointment: any;
    let process: any;

    try {
      this.logger.log(`[createPending] Entrando na transação do Prisma...`);
      [appointment, process] = await this.prisma.$transaction(async (tx) => {
        this.logger.log(`[createPending] Dentro da transação - iniciando`);

        // Criar appointment
        const appointmentData: any = {
          client_id: dto.client_id,
          specialist_id: dto.specialist_id,
          appointment_datetime: dto.appointment_datetime || null,
          status: StatusAgendamento.PENDING,
          notes:
            dto.notes ||
            (isConsultancy
              ? 'Consultoria: cliente acessou link do Calendly'
              : 'Cliente acessou link do Calendly'),
          user_clicked_at: new Date(),
          pending_expires_at: pendingExpiresAt,
        };

        // Adicionar produto se não for consultoria
        if (!isConsultancy) {
          appointmentData.product_type = dto.product_type;
          appointmentData.product_id = dto.product_id;
        }

        this.logger.log(
          `[createPending] Criando appointment ${isConsultancy ? '(consultoria)' : `para produto ${dto.product_type}/${dto.product_id}`}`,
        );
        const createdAppointment = await tx.appointment.create({
          data: appointmentData,
          include: {
            client: true,
            specialist: true,
          },
        });
        this.logger.log(
          `[createPending] Appointment criado: ${createdAppointment.id}`,
        );

        // Criar Process em status SCHEDULING
        const processData: any = {
          client_id: dto.client_id,
          specialist_id: dto.specialist_id,
          appointment_id: createdAppointment.id,
          status: 'SCHEDULING',
          notes: isConsultancy
            ? `Consultoria criada via agendamento PENDING (${new Date().toISOString()})`
            : `Criado via agendamento PENDING (${new Date().toISOString()})`,
        };

        // Adicionar produto apenas se não for consultoria
        if (!isConsultancy) {
          const productField =
            dto.product_type === ProductType.CAR
              ? 'car_id'
              : dto.product_type === ProductType.BOAT
                ? 'boat_id'
                : 'aircraft_id';

          this.logger.log(
            `[createPending] Criando process com campo ${productField}=${dto.product_id}`,
          );
          processData.product_type = dto.product_type;
          processData[productField] = dto.product_id;
        } else {
          this.logger.log(
            `[createPending] Criando process de consultoria (sem produto)`,
          );
        }

        const createdProcess = await tx.process.create({
          data: processData,
        });
        this.logger.log(
          `[createPending] Process criado: ${createdProcess.id} com status ${createdProcess.status}`,
        );

        // Criar histórico
        await tx.processStatusHistory.create({
          data: {
            processId: createdProcess.id,
            status: 'SCHEDULING',
            changed_by: dto.client_id,
            changed_at: new Date(),
          },
        });
        this.logger.log(
          `[createPending] Histórico de status criado para process ${createdProcess.id}`,
        );

        return [createdAppointment, createdProcess];
      });

      this.logger.log(
        `[createPending] Transação concluída com sucesso! Appointment: ${appointment.id}, Process: ${process.id}`,
      );

      return this.mapToResponseEntity(appointment, client, specialist, product);
    } catch (error) {
      this.logger.error(`[createPending] ERRO CRÍTICO na transação:`);
      this.logger.error(
        `[createPending] Tipo do erro: ${error?.constructor?.name}`,
      );
      this.logger.error(`[createPending] Mensagem: ${error?.message}`);
      this.logger.error(`[createPending] Stack: ${error?.stack}`);
      this.logger.error(
        `[createPending] Erro completo: ${JSON.stringify(error, null, 2)}`,
      );
      throw error;
    }
  }

  /**
   * Lista agendamentos PENDING para um especialista
   * Usado na tela do especialista para ver quem acessou seu link
   *
   * @param specialistId ID do especialista
   * @param page Página (default 1)
   * @param limit Itens por página (default 20)
   * @returns Lista de agendamentos PENDING
   */
  async getPendingBySpecialist(
    specialistId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    success: boolean;
    data: AppointmentResponseEntity[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const skip = (page - 1) * limit;

    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          specialist_id: specialistId,
          status: StatusAgendamento.PENDING,
        },
        include: { client: true, specialist: true },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.appointment.count({
        where: {
          specialist_id: specialistId,
          status: StatusAgendamento.PENDING,
        },
      }),
    ]);

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

    return {
      success: true,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Confirma um agendamento PENDING (transforma em SCHEDULED)
   * Apenas o especialista pode confirmar
   * Também cria o Process vinculado
   *
   * @param appointmentId ID do agendamento
   * @param userId ID do usuário (especialista) autenticado
   * @param appointmentDatetime Data/hora opcional do agendamento confirmado
   * @returns Appointment em status SCHEDULED
   */
  async confirmPending(
    appointmentId: string,
    userId: string,
    appointmentDatetime?: Date,
  ): Promise<AppointmentResponseEntity> {
    this.logger.log(
      `[confirmPending] Confirmando agendamento ${appointmentId} por ${userId}`,
    );

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { client: true, specialist: true, process: true },
    });

    if (!appointment) {
      throw new NotFoundException({
        success: false,
        error: { code: 404, message: 'Agendamento não encontrado' },
      });
    }

    // Apenas especialista pode confirmar
    if (appointment.specialist_id !== userId) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 403,
          message: 'Apenas o especialista pode confirmar agendamentos',
        },
      });
    }

    // Só pode confirmar PENDING
    if (appointment.status !== StatusAgendamento.PENDING) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message: 'Apenas agendamentos PENDING podem ser confirmados',
          details: { current_status: appointment.status },
        },
      });
    }

    // Atualizar para SCHEDULED e atualizar Process para NEGOTIATION em transação
    const [updated, process] = await this.prisma.$transaction(async (tx) => {
      // Atualizar appointment
      const updatedApt = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: StatusAgendamento.SCHEDULED,
          appointment_datetime:
            appointmentDatetime ||
            appointment.appointment_datetime ||
            new Date(),
          confirmed_at: new Date(),
          confirmed_by_id: userId,
        },
        include: { client: true, specialist: true },
      });

      // Buscar ou criar Process
      let processToUpdate = appointment.process;

      if (!processToUpdate) {
        // Se não existe, criar (caso de migração/dados antigos)
        const productField =
          appointment.product_type === ProductType.CAR
            ? 'car_id'
            : appointment.product_type === ProductType.BOAT
              ? 'boat_id'
              : 'aircraft_id';

        processToUpdate = await tx.process.create({
          data: {
            client_id: appointment.client_id,
            specialist_id: appointment.specialist_id,
            product_type: appointment.product_type,
            [productField]: appointment.product_id,
            appointment_id: appointmentId,
            status: 'SCHEDULING',
            notes: `Criado via confirmação de agendamento PENDING (${new Date().toISOString()})`,
          },
        });

        await tx.processStatusHistory.create({
          data: {
            processId: processToUpdate.id,
            status: 'SCHEDULING',
            changed_by: userId,
            changed_at: new Date(),
          },
        });
      }

      // Atualizar Process para NEGOTIATION
      const updatedProcess = await tx.process.update({
        where: { id: processToUpdate.id },
        data: {
          status: 'NEGOTIATION',
          notes:
            processToUpdate.notes +
            `\n\nAgendamento confirmado pelo especialista (${new Date().toISOString()})`,
        },
      });

      // Criar histórico de mudança de status
      await tx.processStatusHistory.create({
        data: {
          processId: updatedProcess.id,
          status: 'NEGOTIATION',
          changed_by: userId,
          changed_at: new Date(),
        },
      });

      return [updatedApt, updatedProcess];
    });

    this.logger.log(
      `[confirmPending] Agendamento ${appointmentId} confirmado. Process ${process.id} movido para NEGOTIATION`,
    );

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
   * Cancela um agendamento PENDING e deleta o processo associado
   * Cliente pode cancelar seus próprios pendentes
   * Especialista pode cancelar/recusar pendentes do seu calendário
   * Deleta tanto o appointment quanto o process em uma transação
   *
   * @param appointmentId ID do agendamento
   * @param userId ID do usuário autenticado
   * @returns Mensagem de sucesso
   */
  async cancelPending(
    appointmentId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `[cancelPending] Cancelando agendamento ${appointmentId} por ${userId}`,
    );

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { client: true, specialist: true, process: true },
    });

    if (!appointment) {
      throw new NotFoundException({
        success: false,
        error: { code: 404, message: 'Agendamento não encontrado' },
      });
    }

    // Apenas cliente ou especialista podem cancelar
    const isClient = appointment.client_id === userId;
    const isSpecialist = appointment.specialist_id === userId;
    if (!isClient && !isSpecialist) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 403,
          message: 'Sem permissão para cancelar este agendamento',
        },
      });
    }

    // Só pode cancelar PENDING
    if (appointment.status !== StatusAgendamento.PENDING) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message:
            'Apenas agendamentos PENDING podem ser cancelados por esta rota',
          details: { current_status: appointment.status },
        },
      });
    }

    // Deletar appointment e process em transação
    await this.prisma.$transaction(async (tx) => {
      // Se existe process, deletar histórico e process primeiro
      if (appointment.process) {
        await tx.processStatusHistory.deleteMany({
          where: { processId: appointment.process.id },
        });

        await tx.process.delete({
          where: { id: appointment.process.id },
        });

        this.logger.log(
          `[cancelPending] Process ${appointment.process.id} deletado`,
        );
      }

      // Deletar appointment
      await tx.appointment.delete({
        where: { id: appointmentId },
      });

      this.logger.log(`[cancelPending] Appointment ${appointmentId} deletado`);
    });

    return {
      success: true,
      message: `Agendamento ${isSpecialist ? 'recusado' : 'cancelado'} com sucesso`,
    };
  }

  /**
   * Busca agendamento PENDING ou SCHEDULED entre cliente e especialista para um produto específico
   * Usado para impedir duplicatas e condicionalmente exibir botão de confirmação no frontend
   *
   * @param clientId ID do cliente (UUID)
   * @param specialistId ID do especialista (UUID)
   * @param productType Tipo de produto (CAR, BOAT, AIRCRAFT)
   * @param productId ID do produto (convertido para number)
   * @returns Appointment se encontrado, caso contrário null
   */
  async findExistingAppointment(
    clientId: string,
    specialistId: string,
    productType: ProductType,
    productId: number | string,
  ): Promise<AppointmentResponseEntity | null> {
    const productIdNum =
      typeof productId === 'string' ? parseInt(productId, 10) : productId;

    if (isNaN(productIdNum)) {
      return null;
    }

    const appointment = await this.prisma.appointment.findFirst({
      where: {
        client_id: clientId,
        specialist_id: specialistId,
        product_type: productType,
        product_id: productIdNum,
        status: {
          in: [StatusAgendamento.PENDING, StatusAgendamento.SCHEDULED],
        },
      },
      include: { client: true, specialist: true },
    });

    if (!appointment) {
      return null;
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

  async registerCalendlyScheduled(
    appointmentId: string,
    userId: string,
    dto: CalendlyScheduledDto,
  ): Promise<{
    appointment_id: string;
    calendly_sync_status: CalendlySyncStatus;
    appointment_datetime: Date | null;
  }> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 404,
          message: 'Agendamento não encontrado',
          details: { appointment_id: appointmentId },
        },
      });
    }

    if (appointment.client_id !== userId) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 403,
          message:
            'Apenas o cliente dono do agendamento pode registrar evento do Calendly',
        },
      });
    }

    if (
      appointment.status !== StatusAgendamento.PENDING &&
      appointment.status !== StatusAgendamento.SCHEDULED
    ) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message:
            'Somente agendamentos pendentes ou agendados aceitam sincronização Calendly',
          details: { status: appointment.status },
        },
      });
    }

    if (
      appointment.calendly_event_uri &&
      appointment.calendly_event_uri === dto.event_uri
    ) {
      return {
        appointment_id: appointment.id,
        calendly_sync_status: appointment.calendly_sync_status,
        appointment_datetime: appointment.appointment_datetime,
      };
    }

    let scheduledStartTime = dto.scheduled_start_time
      ? parseDate(dto.scheduled_start_time)
      : null;

    if (dto.scheduled_start_time && !scheduledStartTime) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message: 'scheduled_start_time inválido',
        },
      });
    }

    if (!scheduledStartTime) {
      try {
        scheduledStartTime =
          await this.calendlyIntegrationService.resolveScheduledStartTime(
            appointment.specialist_id,
            dto.event_uri,
            dto.invitee_uri,
          );
      } catch (error: any) {
        this.logger.warn(
          `[registerCalendlyScheduled] Falha ao buscar horário no Calendly API: ${error?.message}`,
        );
      }
    }

    const syncStatus =
      scheduledStartTime || appointment.appointment_datetime
        ? CalendlySyncStatus.SYNCED
        : CalendlySyncStatus.PENDING;

    const updated = await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        calendly_event_uri: dto.event_uri,
        calendly_invitee_uri: dto.invitee_uri,
        calendly_scheduled_at: dto.client_observed_at
          ? new Date(dto.client_observed_at)
          : new Date(),
        calendly_last_sync_at: new Date(),
        calendly_sync_status: syncStatus,
        appointment_datetime:
          scheduledStartTime || appointment.appointment_datetime,
      },
    });

    return {
      appointment_id: updated.id,
      calendly_sync_status: updated.calendly_sync_status,
      appointment_datetime: updated.appointment_datetime,
    };
  }

  async getCalendlySyncStatus(
    appointmentId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<{
    appointment_id: string;
    status: StatusAgendamento;
    calendly_sync_status: CalendlySyncStatus;
    appointment_datetime: Date | null;
    calendly_last_sync_at: Date | null;
  }> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        status: true,
        client_id: true,
        specialist_id: true,
        appointment_datetime: true,
        calendly_sync_status: true,
        calendly_last_sync_at: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 404,
          message: 'Agendamento não encontrado',
          details: { appointment_id: appointmentId },
        },
      });
    }

    const isParticipant =
      appointment.client_id === userId || appointment.specialist_id === userId;

    if (!isParticipant && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 403,
          message: 'Não tem permissão para consultar este agendamento',
        },
      });
    }

    return {
      appointment_id: appointment.id,
      status: appointment.status,
      calendly_sync_status: appointment.calendly_sync_status,
      appointment_datetime: appointment.appointment_datetime,
      calendly_last_sync_at: appointment.calendly_last_sync_at,
    };
  }
}
