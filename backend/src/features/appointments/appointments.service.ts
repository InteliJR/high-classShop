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
  CreatePendingAppointmentDto,
  CreatePlatformAppointmentDto,
  GetAppointmentsQueryDto,
  PENDING_APPOINTMENT_DATETIME_PATTERN,
  UpdateAppointmentStatusDto,
} from './dto';
import {
  AppointmentResponseEntity,
  ClientResponseDto,
  SpecialistResponseDto,
  ProductResponseDto,
  ExistingAppointmentCheck,
} from './entities/appointment.response';
import {
  AppointmentSchedulingMethod,
  CalendlySyncStatus,
  StatusAgendamento,
  UserRole,
  ProductType,
  User,
  Car,
  Boat,
  Aircraft,
  ProcessStatus,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { isISO8601 } from 'class-validator';
import { isCalendlySchedulingAvailable } from 'src/shared/utils/calendly-scheduling-capability';
import { parseDate, isFutureDate } from 'src/shared/utils/date.utils';
import { NotificationService } from 'src/features/notifications/notification.service';
import { CalendlyIntegrationService } from './calendly-integration.service';
import { parseCalendlyResourceUri } from './dto/calendly-scheduled.dto';
import { buildNegotiationSnapshotUpdate } from 'src/features/processes/negotiation-snapshot';
import { lockNegotiationProductMoney } from 'src/features/products/product-monetary-lock';
import { validateSpecialistProductAssociation } from 'src/features/products/product-association-validator';
import {
  ACTIVE_PROCESS_STATUSES,
  lockAndAssertNoActiveProcess,
} from 'src/features/processes/process-dedup-lock';
import {
  acquireSpecialistScheduleLock,
  assertSpecialistScheduleAvailable,
  buildOccupiedScheduleWhere,
  lockAndAssertSpecialistScheduleAvailable,
} from './appointment-schedule-lock';

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

  /** Bloqueia a criação direta sem confirmação do especialista. */
  async create(
    _dto: CreatePlatformAppointmentDto,
    _userId: string,
    _userRole: UserRole,
  ): Promise<AppointmentResponseEntity> {
    throw new ForbiddenException({
      success: false,
      error: {
        code: 403,
        message:
          'Use o pedido pendente por e-mail ou Calendly para solicitar a reunião',
      },
    });
  }

  async reschedule(
    appointmentId: string,
    appointmentDatetime: string,
    userId: string,
  ): Promise<AppointmentResponseEntity> {
    const nextDate = parseDate(appointmentDatetime);
    if (!nextDate || !isFutureDate(nextDate)) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message: 'O novo horário deve ser uma data futura válida',
        },
      });
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { client: true, specialist: true, process: true },
    });
    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }
    if (appointment.specialist_id !== userId) {
      throw new ForbiddenException(
        'Apenas o especialista responsável pode alterar o horário',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await acquireSpecialistScheduleLock(tx, appointment.specialist_id);

      const lockedAppointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        include: { client: true, specialist: true, process: true },
      });
      if (!lockedAppointment) {
        throw new NotFoundException('Agendamento não encontrado');
      }
      if (lockedAppointment.specialist_id !== userId) {
        throw new ForbiddenException(
          'Apenas o especialista responsável pode alterar o horário',
        );
      }
      if (lockedAppointment.status !== StatusAgendamento.SCHEDULED) {
        throw new BadRequestException(
          'Apenas agendamentos confirmados podem ter o horário alterado',
        );
      }
      if (!lockedAppointment.appointment_datetime) {
        throw new BadRequestException(
          'O agendamento atual não possui horário definido',
        );
      }
      if (lockedAppointment.specialist_rescheduled_at) {
        throw this.buildRescheduleAlreadyUsedError(appointmentId);
      }
      if (
        lockedAppointment.appointment_datetime.getTime() === nextDate.getTime()
      ) {
        throw new BadRequestException(
          'O novo horário deve ser diferente do horário atual',
        );
      }

      await assertSpecialistScheduleAvailable(
        tx,
        lockedAppointment.specialist_id,
        nextDate,
        appointmentId,
      );

      const rescheduledAt = new Date();
      const claim = await tx.appointment.updateMany({
        where: {
          id: appointmentId,
          status: StatusAgendamento.SCHEDULED,
          specialist_rescheduled_at: null,
        },
        data: {
          appointment_datetime: nextDate,
          specialist_rescheduled_from: lockedAppointment.appointment_datetime,
          specialist_rescheduled_at: rescheduledAt,
        },
      });
      if (claim.count !== 1) {
        throw this.buildRescheduleAlreadyUsedError(appointmentId);
      }

      return tx.appointment.findUniqueOrThrow({
        where: { id: appointmentId },
        include: { client: true, specialist: true, process: true },
      });
    });

    const product = await this.getProductByType(
      updated.product_type,
      updated.product_id,
    );
    if (
      updated.process?.id &&
      updated.specialist_rescheduled_from &&
      updated.appointment_datetime
    ) {
      const previousAppointmentDate = updated.specialist_rescheduled_from;
      const appointmentDate = updated.appointment_datetime;
      const productDetails = product
        ? `${(product as any).marca || ''} ${(product as any).modelo || ''}`.trim()
        : '';
      setImmediate(() => {
        this.notificationService
          .sendAppointmentRescheduledEmail({
            clientEmail: updated.client.email,
            clientName:
              `${updated.client.name} ${updated.client.surname || ''}`.trim(),
            specialistName:
              `${updated.specialist.name} ${updated.specialist.surname || ''}`.trim(),
            previousAppointmentDate,
            appointmentDate,
            productDetails,
            processId: updated.process!.id,
          })
          .catch((error) => {
            this.logger.error('Notification failed (non-critical)', {
              method: 'reschedule',
              appointmentId,
              error: error.message,
            });
          });
      });
    }
    return this.mapToResponseEntity(
      updated,
      updated.client,
      updated.specialist,
      product,
    );
  }

  private buildRescheduleAlreadyUsedError(
    appointmentId: string,
  ): ConflictException {
    return new ConflictException({
      success: false,
      error: {
        code: 'APPOINTMENT_RESCHEDULE_ALREADY_USED',
        message: 'A alteração definitiva deste agendamento já foi utilizada',
        details: { appointment_id: appointmentId },
      },
    });
  }

  /**
   * Lista agendamentos com paginação, filtros e ordenação
   * Respeita permissões por role:
   * - CUSTOMER: vê apenas seus próprios agendamentos
   * - SPECIALIST/CONSULTANT: vê como especialista + seus clientes
   * - OFFICE: vê clientes vinculados à própria empresa
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

    // Construir filtro WHERE conforme permissões. ADMIN é o único papel com
    // visão global; qualquer papel sem regra explícita deve falhar fechado.
    const where: any = {};

    switch (userRole) {
      case UserRole.ADMIN:
        break;

      case UserRole.CUSTOMER:
        where.client_id = userId;
        break;

      case UserRole.SPECIALIST:
      case UserRole.CONSULTANT:
        where.OR = [{ specialist_id: userId }, { client_id: userId }];
        break;

      case UserRole.OFFICE: {
        const office = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { company_id: true },
        });
        if (!office?.company_id) {
          this.logger.error(
            `[getAppointments] OFFICE user=${userId} sem company_id — config inválida`,
          );
          throw new ForbiddenException({
            success: false,
            error: {
              code: 403,
              message: 'Escritório sem empresa vinculada',
              details: { user_id: userId },
            },
          });
        }

        // Mantém a mesma definição de cliente do escritório aplicada por
        // OfficeService.listClients e ProcessesService: vínculo direto com a
        // empresa ou indireto por um consultor pertencente a ela.
        where.AND = [
          {
            client: {
              role: UserRole.CUSTOMER,
              OR: [
                { consultant: { company_id: office.company_id } },
                { company_id: office.company_id },
              ],
            },
          },
        ];
        break;
      }

      default:
        this.logger.warn(
          `[getAppointments] acesso negado role=${userRole} user=${userId}`,
        );
        throw new ForbiddenException({
          success: false,
          error: {
            code: 403,
            message: 'Acesso negado',
            details: { user_id: userId },
          },
        });
    }

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
    const assertTransitionAllowed = (current: any): void => {
      const isParticipant =
        current.client_id === userId || current.specialist_id === userId;
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

      if (
        dto.status === StatusAgendamento.PENDING ||
        dto.status === StatusAgendamento.SCHEDULED
      ) {
        throw new BadRequestException(
          'Use o fluxo específico de confirmação para agendar uma reunião',
        );
      }

      if (dto.status === StatusAgendamento.COMPLETED) {
        if (current.specialist_id !== userId && userRole !== UserRole.ADMIN) {
          throw new ForbiddenException(
            'Apenas o especialista responsável pode concluir a reunião',
          );
        }
        if (
          current.status !== StatusAgendamento.SCHEDULED ||
          !current.appointment_datetime
        ) {
          throw new BadRequestException(
            'Apenas uma reunião agendada pode ser concluída',
          );
        }
      }

      if (
        dto.status === StatusAgendamento.CANCELLED &&
        current.status !== StatusAgendamento.PENDING &&
        current.status !== StatusAgendamento.SCHEDULED
      ) {
        throw new BadRequestException(
          'Apenas agendamentos pendentes ou agendados podem ser cancelados',
        );
      }
      if (
        dto.status === StatusAgendamento.CANCELLED &&
        current.process &&
        current.process.status !== ProcessStatus.SCHEDULING
      ) {
        throw new BadRequestException(
          'Não é possível cancelar uma reunião cujo processo já avançou',
        );
      }
    };

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

    assertTransitionAllowed(appointment);

    const updated = await this.prisma.$transaction(async (tx) => {
      await acquireSpecialistScheduleLock(tx, appointment.specialist_id);
      const lockedAppointment = await tx.appointment.findUnique({
        where: { id },
        include: {
          client: true,
          specialist: true,
          process: true,
        },
      });
      if (!lockedAppointment) {
        throw new NotFoundException({
          success: false,
          error: {
            code: 404,
            message: 'Agendamento não encontrado',
            details: { appointment_id: id },
          },
        });
      }
      assertTransitionAllowed(lockedAppointment);

      const claim = await tx.appointment.updateMany({
        where: {
          id,
          status: lockedAppointment.status,
          updated_at: lockedAppointment.updated_at,
        },
        data: {
          status: dto.status,
          notes: dto.notes || lockedAppointment.notes,
          updated_at: new Date(),
        },
      });
      if (claim.count !== 1) {
        throw new ConflictException({
          success: false,
          error: {
            code: 'APPOINTMENT_STATUS_TRANSITION_CONFLICT',
            message:
              'O agendamento foi alterado enquanto o status era atualizado',
            details: { appointment_id: id },
          },
        });
      }

      // Cancellation must release the active scheduling process atomically.
      // Keeping a SCHEDULING process linked to a CANCELLED appointment makes
      // the product deduplication gate reject every subsequent request.
      if (
        dto.status === StatusAgendamento.CANCELLED &&
        lockedAppointment.process
      ) {
        await tx.processStatusHistory.deleteMany({
          where: { processId: lockedAppointment.process.id },
        });
        const processClaim = await tx.process.deleteMany({
          where: {
            id: lockedAppointment.process.id,
            status: ProcessStatus.SCHEDULING,
          },
        });
        if (processClaim.count !== 1) {
          throw new ConflictException({
            success: false,
            error: {
              code: 'APPOINTMENT_CANCELLATION_CONFLICT',
              message:
                'O processo foi alterado enquanto o agendamento era cancelado',
              details: { appointment_id: id },
            },
          });
        }
      }

      const updatedAppointment = await tx.appointment.findUniqueOrThrow({
        where: { id },
        include: {
          client: true,
          specialist: true,
          process: true,
        },
      });

      // LÓGICA CRÍTICA: Se status muda para COMPLETED, atualizar Process vinculado
      if (
        dto.status === StatusAgendamento.COMPLETED &&
        lockedAppointment.process
      ) {
        const process = lockedAppointment.process;

        // Só move para NEGOTIATION se Process está em SCHEDULING
        // Evita conflito se já está em NEGOTIATION+ (não retrocede)
        if (process.status === ProcessStatus.SCHEDULING) {
          await lockNegotiationProductMoney(tx, process);
          const processForTransition = await tx.process.findUniqueOrThrow({
            where: { id: process.id },
            include: {
              car: { select: { valor: true, currency: true } },
              boat: { select: { valor: true, currency: true } },
              aircraft: { select: { valor: true, currency: true } },
            },
          });
          if (processForTransition.status !== ProcessStatus.SCHEDULING) {
            return updatedAppointment;
          }
          const hasProduct =
            processForTransition.car_id ||
            processForTransition.boat_id ||
            processForTransition.aircraft_id;

          if (hasProduct) {
            const snapshotData =
              buildNegotiationSnapshotUpdate(processForTransition);
            const claim = await tx.process.updateMany({
              where: {
                id: process.id,
                status: ProcessStatus.SCHEDULING,
              },
              data: {
                status: ProcessStatus.NEGOTIATION,
                notes: `${processForTransition.notes || ''}\n[AUTO] Transição automática: SCHEDULING → NEGOTIATION (agendamento concluído em ${new Date().toISOString()})`,
                updated_at: new Date(),
                ...snapshotData,
              },
            });
            if (claim.count === 1) {
              await tx.processStatusHistory.create({
                data: {
                  processId: process.id,
                  status: ProcessStatus.NEGOTIATION,
                  changed_by: userId,
                  changed_at: new Date(),
                },
              });

              this.logger.log(
                `[updateStatus] Process ${process.id} avançado para NEGOTIATION (agendamento concluído)`,
              );
            }
          } else {
            const claim = await tx.process.updateMany({
              where: {
                id: process.id,
                status: ProcessStatus.SCHEDULING,
              },
              data: {
                notes: `${processForTransition.notes || ''}\n[AUTO] Reunião concluída em ${new Date().toISOString()}. Aguardando especialista selecionar produto para avançar para NEGOTIATION.`,
                updated_at: new Date(),
              },
            });

            if (claim.count === 1) {
              this.logger.log(
                `[updateStatus] Process ${process.id} mantido em SCHEDULING (consultoria - aguardando seleção de produto)`,
              );
            }
          }
        } else if (
          !(
            [
              ProcessStatus.NEGOTIATION,
              ProcessStatus.PROCESSING_CONTRACT,
              ProcessStatus.DOCUMENTATION,
              ProcessStatus.COMPLETED,
            ] as ProcessStatus[]
          ).includes(process.status)
        ) {
          console.warn(
            `[WARNING] Appointment ${id} marked COMPLETED but Process ${process.id} is in unexpected status: ${process.status}`,
          );
        }
      }

      return updatedAppointment;
    });

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

      const conflict = await this.prisma.appointment.findFirst({
        where: buildOccupiedScheduleWhere(specialistId, checkTime),
        select: { id: true },
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
    productId: string | null,
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
    entity.scheduling_method = appointment.scheduling_method ?? null;
    entity.specialist_rescheduled_at =
      appointment.specialist_rescheduled_at ?? null;
    entity.specialist_rescheduled_from =
      appointment.specialist_rescheduled_from ?? null;
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
      productDto.currency = product.currency;
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
   * @param productId UUID do produto
   * @returns Appointment se encontrado e status = SCHEDULED, caso contrário null
   */
  async findScheduledAppointment(
    clientId: string,
    specialistId: string,
    productType: ProductType,
    productId: string,
  ): Promise<AppointmentResponseEntity | null> {
    this.logger.log(
      `[findScheduledAppointment] Buscando agendamento existente: cliente=${clientId}, especialista=${specialistId}, produto=${productType}/${productId}`,
    );

    const appointment = await this.prisma.appointment.findFirst({
      where: {
        client_id: clientId,
        specialist_id: specialistId,
        product_type: productType,
        product_id: productId,
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
    entity.scheduling_method = appointment.scheduling_method ?? null;
    entity.specialist_rescheduled_at =
      appointment.specialist_rescheduled_at ?? null;
    entity.specialist_rescheduled_from =
      appointment.specialist_rescheduled_from ?? null;
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
   * Cria um agendamento PENDING por EMAIL ou CALENDLY e seu processo associado.
   *
   * Dois fluxos suportados:
   * 1. Com produto: product_type e product_id fornecidos - fluxo padrão
   * 2. Consultoria: sem product_type/product_id - cliente quer orientação
   *
   * @param dto Dados do agendamento (product_type e product_id opcionais)
   * @param userId ID do cliente autenticado
   * @returns Appointment em status PENDING e o process_id criado atomicamente
   */
  async createPending(
    dto: CreatePendingAppointmentDto,
    userId: string,
    userRole: UserRole,
  ): Promise<AppointmentResponseEntity & { process_id: string }> {
    if (userRole !== UserRole.CUSTOMER || dto.client_id !== userId) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 403,
          message: 'Apenas o próprio cliente pode criar agendamentos pendentes',
        },
      });
    }

    const schedulingMethod =
      dto.scheduling_method ?? AppointmentSchedulingMethod.CALENDLY;
    if (
      schedulingMethod !== AppointmentSchedulingMethod.EMAIL &&
      schedulingMethod !== AppointmentSchedulingMethod.CALENDLY
    ) {
      throw new BadRequestException(
        'scheduling_method deve ser EMAIL ou CALENDLY',
      );
    }
    if ((dto.product_type != null) !== (dto.product_id != null)) {
      throw new BadRequestException(
        'product_type e product_id devem ser informados juntos.',
      );
    }
    const isConsultancy = dto.product_id == null;
    const hasDate =
      dto.appointment_datetime !== undefined &&
      dto.appointment_datetime !== null;
    if (
      schedulingMethod === AppointmentSchedulingMethod.CALENDLY &&
      dto.appointment_datetime !== undefined
    ) {
      throw new BadRequestException(
        'A data do Calendly deve ser definida pela sincronização, não pelo cliente',
      );
    }
    const pendingDateTime = hasDate
      ? parseDate(dto.appointment_datetime)
      : null;
    if (
      hasDate &&
      (typeof dto.appointment_datetime !== 'string' ||
        !PENDING_APPOINTMENT_DATETIME_PATTERN.test(dto.appointment_datetime) ||
        !isISO8601(dto.appointment_datetime, { strict: true }) ||
        !pendingDateTime ||
        !isFutureDate(pendingDateTime))
    ) {
      throw new BadRequestException(
        'Data/hora do agendamento deve ser ISO 8601 futura válida com Z ou offset explícito',
      );
    }
    if (
      !isConsultancy &&
      schedulingMethod === AppointmentSchedulingMethod.EMAIL &&
      !pendingDateTime
    ) {
      throw new BadRequestException(
        'Data/hora proposta é obrigatória para solicitações por e-mail com produto',
      );
    }

    const client = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!client) throw new NotFoundException('Cliente não encontrado');
    const specialist = await this.prisma.user.findUnique({
      where: { id: dto.specialist_id },
      include: { calendly_connection: { select: { is_active: true } } },
    });
    if (!specialist) throw new NotFoundException('Especialista não encontrado');
    if (specialist.role !== UserRole.SPECIALIST) {
      throw new BadRequestException('Usuário informado não é especialista');
    }
    const calendlyAvailable = isCalendlySchedulingAvailable({
      calendlyUrl: specialist.calendly_url,
      connectionActive: specialist.calendly_connection?.is_active ?? false,
    });
    if (
      schedulingMethod === AppointmentSchedulingMethod.CALENDLY &&
      !calendlyAvailable
    ) {
      throw new ConflictException({
        success: false,
        error: {
          code: 'CALENDLY_UNAVAILABLE',
          message: 'Calendly indisponível. Solicite a reunião por e-mail.',
        },
      });
    }
    if (
      !isConsultancy &&
      schedulingMethod === AppointmentSchedulingMethod.EMAIL &&
      calendlyAvailable
    ) {
      throw new ConflictException({
        success: false,
        error: {
          code: 'EMAIL_FLOW_UNAVAILABLE',
          message:
            'Este especialista utiliza Calendly. Solicite a reunião pelo calendário.',
        },
      });
    }

    // Metadata only: automatic expiration is not implemented.
    const pendingExpiresAt = new Date();
    pendingExpiresAt.setDate(pendingExpiresAt.getDate() + 7);

    const { appointment, process, product } = await this.prisma.$transaction(
      async (tx) => {
        const product = await validateSpecialistProductAssociation(tx, {
          specialistId: dto.specialist_id,
          productType: dto.product_type,
          productId: dto.product_id,
        });
        await lockAndAssertNoActiveProcess(
          tx,
          {
            clientId: userId,
            specialistId: dto.specialist_id,
            productType: dto.product_type,
            productId: dto.product_id,
          },
          undefined,
          { authenticatedClientId: userId },
        );

        // Product EMAIL requests are proposals. Preserve the optional dated
        // consultancy validation without making any PENDING/EMAIL occupy agenda.
        if (isConsultancy && pendingDateTime) {
          await lockAndAssertSpecialistScheduleAvailable(
            tx,
            dto.specialist_id,
            pendingDateTime,
          );
        }

        const appointment = await tx.appointment.create({
          data: {
            client_id: userId,
            specialist_id: dto.specialist_id,
            product_type: dto.product_type ?? null,
            product_id: dto.product_id ?? null,
            appointment_datetime: pendingDateTime,
            status: StatusAgendamento.PENDING,
            scheduling_method: schedulingMethod,
            notes:
              dto.notes ||
              (schedulingMethod === AppointmentSchedulingMethod.EMAIL
                ? 'Cliente solicitou reunião por e-mail'
                : 'Cliente acessou link do Calendly'),
            user_clicked_at: new Date(),
            pending_expires_at: pendingExpiresAt,
          },
        });
        const productField =
          dto.product_type === ProductType.CAR
            ? 'car_id'
            : dto.product_type === ProductType.BOAT
              ? 'boat_id'
              : 'aircraft_id';
        const process = await tx.process.create({
          data: {
            client_id: userId,
            specialist_id: dto.specialist_id,
            appointment_id: appointment.id,
            status: ProcessStatus.SCHEDULING,
            product_type: dto.product_type ?? null,
            ...(isConsultancy ? {} : { [productField]: dto.product_id }),
            notes: `Criado via agendamento PENDING (${new Date().toISOString()})`,
          },
        });
        await tx.processStatusHistory.create({
          data: {
            processId: process.id,
            status: ProcessStatus.SCHEDULING,
            changed_by: userId,
            changed_at: new Date(),
          },
        });
        return { appointment, process, product };
      },
    );
    return Object.assign(
      this.mapToResponseEntity(appointment, client, specialist, product),
      {
        process_id: process.id,
      },
    );
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
    appointmentDatetime?: string | Date,
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

    if (
      appointment.scheduling_method === AppointmentSchedulingMethod.EMAIL ||
      appointment.scheduling_method === AppointmentSchedulingMethod.PLATFORM
    ) {
      throw new BadRequestException(
        'Use a confirmação do processo para este tipo de agendamento',
      );
    }

    const requestedDate = parseDate(
      appointmentDatetime ?? appointment.appointment_datetime ?? undefined,
    );
    if (!requestedDate || !isFutureDate(requestedDate)) {
      throw new BadRequestException(
        'Informe uma data e hora futura para confirmar o agendamento',
      );
    }

    // Atualizar para SCHEDULED e atualizar Process para NEGOTIATION em transação
    const [updated, process] = await this.prisma.$transaction(async (tx) => {
      await validateSpecialistProductAssociation(tx, {
        specialistId: appointment.specialist_id,
        productType: appointment.product_type,
        productId: appointment.product_id,
      });

      await lockAndAssertNoActiveProcess(
        tx,
        {
          clientId: appointment.client_id,
          specialistId: appointment.specialist_id,
          productType: appointment.product_type,
          productId: appointment.product_id,
        },
        appointment.process?.id,
      );
      await acquireSpecialistScheduleLock(tx, appointment.specialist_id);

      const lockedAppointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        include: { client: true, specialist: true, process: true },
      });
      if (!lockedAppointment) {
        throw new NotFoundException({
          success: false,
          error: { code: 404, message: 'Agendamento não encontrado' },
        });
      }
      if (lockedAppointment.specialist_id !== userId) {
        throw new ForbiddenException({
          success: false,
          error: {
            code: 403,
            message: 'Apenas o especialista pode confirmar agendamentos',
          },
        });
      }
      if (lockedAppointment.status !== StatusAgendamento.PENDING) {
        throw new BadRequestException({
          success: false,
          error: {
            code: 400,
            message: 'Apenas agendamentos PENDING podem ser confirmados',
            details: { current_status: lockedAppointment.status },
          },
        });
      }
      if (
        lockedAppointment.scheduling_method ===
          AppointmentSchedulingMethod.EMAIL ||
        lockedAppointment.scheduling_method ===
          AppointmentSchedulingMethod.PLATFORM
      ) {
        throw new BadRequestException(
          'Use a confirmação do processo para este tipo de agendamento',
        );
      }
      const confirmedDateTime = parseDate(
        appointmentDatetime ??
          lockedAppointment.appointment_datetime ??
          undefined,
      );
      if (!confirmedDateTime || !isFutureDate(confirmedDateTime)) {
        throw new BadRequestException(
          'Informe uma data e hora futura para confirmar o agendamento',
        );
      }
      await assertSpecialistScheduleAvailable(
        tx,
        lockedAppointment.specialist_id,
        confirmedDateTime,
        appointmentId,
      );

      // Atualizar appointment
      const updatedApt = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: StatusAgendamento.SCHEDULED,
          appointment_datetime: confirmedDateTime,
          confirmed_at: new Date(),
          confirmed_by_id: userId,
        },
        include: { client: true, specialist: true },
      });

      // Buscar ou criar Process
      let processToUpdate = lockedAppointment.process;

      if (!processToUpdate) {
        // Se não existe, criar (caso de migração/dados antigos)
        const productField =
          lockedAppointment.product_type === ProductType.CAR
            ? 'car_id'
            : lockedAppointment.product_type === ProductType.BOAT
              ? 'boat_id'
              : 'aircraft_id';

        processToUpdate = await tx.process.create({
          data: {
            client_id: lockedAppointment.client_id,
            specialist_id: lockedAppointment.specialist_id,
            product_type: lockedAppointment.product_type,
            [productField]: lockedAppointment.product_id,
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

      await lockNegotiationProductMoney(tx, processToUpdate);
      const processForTransition = await tx.process.findUniqueOrThrow({
        where: { id: processToUpdate.id },
        include: {
          car: { select: { valor: true, currency: true } },
          boat: { select: { valor: true, currency: true } },
          aircraft: { select: { valor: true, currency: true } },
        },
      });
      const snapshotData = buildNegotiationSnapshotUpdate(processForTransition);
      const nextUpdatedAt = new Date();
      const nextNotes =
        (processForTransition.notes || '') +
        `\n\nAgendamento confirmado pelo especialista (${new Date().toISOString()})`;
      const claim = await tx.process.updateMany({
        where: {
          id: processForTransition.id,
          status: ProcessStatus.SCHEDULING,
          updated_at: processForTransition.updated_at,
        },
        data: {
          status: ProcessStatus.NEGOTIATION,
          notes: nextNotes,
          updated_at: nextUpdatedAt,
          ...snapshotData,
        },
      });

      if (claim.count !== 1) {
        throw new ConflictException({
          success: false,
          error: {
            code: 'PROCESS_STATUS_TRANSITION_CONFLICT',
            message:
              'O processo foi alterado durante a confirmação do agendamento.',
            details: { process_id: processForTransition.id },
          },
        });
      }

      const updatedProcess = {
        ...processForTransition,
        ...snapshotData,
        status: ProcessStatus.NEGOTIATION,
        notes: nextNotes,
        updated_at: nextUpdatedAt,
      };

      // Criar histórico de mudança de status
      await tx.processStatusHistory.create({
        data: {
          processId: updatedProcess.id,
          status: ProcessStatus.NEGOTIATION,
          changed_by: userId,
          changed_at: new Date(),
        },
      });

      return [updatedApt, updatedProcess];
    });

    this.logger.log(
      `[confirmPending] Agendamento ${appointmentId} confirmado. Process ${process.id} movido para NEGOTIATION`,
    );

    // Fire-and-forget: notificar cliente sobre confirmação do agendamento
    const confirmedProduct = await this.getProductByType(
      updated.product_type,
      updated.product_id,
    );
    const confirmedProductDetails = confirmedProduct
      ? `${(confirmedProduct as any).marca || ''} ${(confirmedProduct as any).modelo || ''}`.trim()
      : '';

    setImmediate(() => {
      this.notificationService
        .sendAppointmentConfirmedEmail({
          clientEmail: updated.client.email,
          clientName:
            `${updated.client.name} ${updated.client.surname || ''}`.trim(),
          specialistName:
            `${updated.specialist.name} ${updated.specialist.surname || ''}`.trim(),
          appointmentDate: updated.appointment_datetime || new Date(),
          productDetails: confirmedProductDetails,
          processId: process.id,
        })
        .catch((err) => {
          this.logger.error('Notification failed (non-critical)', {
            method: 'confirmPending',
            appointmentId: updated.id,
            error: err.message,
          });
        });
    });

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

    const candidate = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, client_id: true, specialist_id: true },
    });

    if (!candidate) {
      throw new NotFoundException({
        success: false,
        error: { code: 404, message: 'Agendamento não encontrado' },
      });
    }

    // Apenas cliente ou especialista podem cancelar
    const isClient = candidate.client_id === userId;
    const isSpecialist = candidate.specialist_id === userId;
    if (!isClient && !isSpecialist) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 403,
          message: 'Sem permissão para cancelar este agendamento',
        },
      });
    }

    // Serializar com confirmação/reagendamento e revalidar o estado sob lock.
    const appointment = await this.prisma.$transaction(async (tx) => {
      await acquireSpecialistScheduleLock(tx, candidate.specialist_id);
      const lockedAppointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        include: { client: true, specialist: true, process: true },
      });
      if (!lockedAppointment) {
        throw new NotFoundException({
          success: false,
          error: { code: 404, message: 'Agendamento não encontrado' },
        });
      }
      if (
        lockedAppointment.client_id !== userId &&
        lockedAppointment.specialist_id !== userId
      ) {
        throw new ForbiddenException({
          success: false,
          error: {
            code: 403,
            message: 'Sem permissão para cancelar este agendamento',
          },
        });
      }
      if (lockedAppointment.status !== StatusAgendamento.PENDING) {
        throw new BadRequestException({
          success: false,
          error: {
            code: 400,
            message:
              'Apenas agendamentos PENDING podem ser cancelados por esta rota',
            details: { current_status: lockedAppointment.status },
          },
        });
      }

      // Se existe process, deletar histórico e process primeiro
      if (lockedAppointment.process) {
        if (lockedAppointment.process.status !== ProcessStatus.SCHEDULING) {
          throw new BadRequestException(
            'Não é possível cancelar uma reunião cujo processo já avançou',
          );
        }
        const processClaim = await tx.process.updateMany({
          where: {
            id: lockedAppointment.process.id,
            status: ProcessStatus.SCHEDULING,
            updated_at: lockedAppointment.process.updated_at,
          },
          data: { updated_at: new Date() },
        });
        if (processClaim.count !== 1) {
          throw new ConflictException(
            'O processo foi alterado enquanto o agendamento era cancelado',
          );
        }
        await tx.processStatusHistory.deleteMany({
          where: { processId: lockedAppointment.process.id },
        });

        await tx.process.delete({
          where: { id: lockedAppointment.process.id },
        });

        this.logger.log(
          `[cancelPending] Process ${lockedAppointment.process.id} deletado`,
        );
      }

      // Deletar appointment
      await tx.appointment.delete({
        where: { id: appointmentId },
      });

      this.logger.log(`[cancelPending] Appointment ${appointmentId} deletado`);

      return lockedAppointment;
    });

    // Fire-and-forget: notificar a outra parte sobre o cancelamento
    const cancellerName = isSpecialist
      ? `${appointment.specialist.name} ${appointment.specialist.surname || ''}`.trim()
      : `${appointment.client.name} ${appointment.client.surname || ''}`.trim();
    const recipientEmail = isSpecialist
      ? appointment.client.email
      : appointment.specialist.email;
    const recipientName = isSpecialist
      ? `${appointment.client.name} ${appointment.client.surname || ''}`.trim()
      : `${appointment.specialist.name} ${appointment.specialist.surname || ''}`.trim();

    setImmediate(() => {
      this.notificationService
        .sendAppointmentCancelledEmail({
          recipientEmail,
          recipientName,
          cancellerName,
          wasClient: isClient,
          appointmentDate: appointment.appointment_datetime || new Date(),
          productDetails: '',
        })
        .catch((err) => {
          this.logger.error('Notification failed (non-critical)', {
            method: 'cancelPending',
            appointmentId,
            error: err.message,
          });
        });
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
   * @param productId UUID do produto
   * @returns Discriminante e snapshot mínimo do pedido pertencente ao cliente
   */
  async findExistingAppointment(
    clientId: string,
    specialistId: string,
    productType: ProductType,
    productId: string,
  ): Promise<ExistingAppointmentCheck> {
    const productField =
      productType === ProductType.CAR
        ? 'car_id'
        : productType === ProductType.BOAT
          ? 'boat_id'
          : 'aircraft_id';
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        client_id: clientId,
        specialist_id: specialistId,
        product_type: productType,
        product_id: productId,
        status: {
          in: [StatusAgendamento.PENDING, StatusAgendamento.SCHEDULED],
        },
        process: {
          is: {
            client_id: clientId,
            specialist_id: specialistId,
            product_type: productType,
            [productField]: productId,
            status: { in: ACTIVE_PROCESS_STATUSES },
          },
        },
      },
      select: {
        id: true,
        client_id: true,
        status: true,
        scheduling_method: true,
        appointment_datetime: true,
        process: { select: { id: true, client_id: true } },
      },
    });

    if (
      !appointment ||
      appointment.client_id !== clientId ||
      !appointment.process ||
      appointment.process.client_id !== clientId
    ) {
      return { exists: false };
    }
    return {
      exists: true,
      appointment_id: appointment.id,
      process_id: appointment.process.id,
      appointment_status: appointment.status,
      scheduling_method: appointment.scheduling_method,
      appointment_datetime: appointment.appointment_datetime,
    };
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
    const eventReference = parseCalendlyResourceUri(dto.event_uri, 'event');
    const inviteeReference = parseCalendlyResourceUri(
      dto.invitee_uri,
      'invitee',
    );
    if (!eventReference || !inviteeReference) {
      throw new BadRequestException('URIs do Calendly inválidas');
    }
    if (eventReference.eventId !== inviteeReference.eventId) {
      throw new BadRequestException(
        'URIs do Calendly pertencem a eventos diferentes',
      );
    }
    const eventUri = eventReference.canonicalUri;
    const inviteeUri = inviteeReference.canonicalUri;

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
      appointment.scheduling_method &&
      appointment.scheduling_method !== AppointmentSchedulingMethod.CALENDLY
    ) {
      throw new BadRequestException(
        'Este agendamento não foi criado pelo Calendly',
      );
    }

    if (appointment.specialist_rescheduled_at) {
      throw this.buildRescheduleAlreadyUsedError(appointmentId);
    }

    if (
      appointment.calendly_event_uri &&
      parseCalendlyResourceUri(appointment.calendly_event_uri, 'event')
        ?.canonicalUri === eventUri
    ) {
      if (
        appointment.calendly_invitee_uri &&
        parseCalendlyResourceUri(
          appointment.calendly_invitee_uri,
          'invitee',
        )?.canonicalUri !== inviteeUri
      ) {
        throw new ConflictException(
          'O evento do Calendly já está associado a outro convidado',
        );
      }
      let canonicalized = true;
      if (
        appointment.calendly_event_uri !== eventUri ||
        appointment.calendly_invitee_uri !== inviteeUri
      ) {
        const repair = await this.prisma.appointment.updateMany({
          where: {
            id: appointment.id,
            calendly_event_uri: appointment.calendly_event_uri,
            calendly_invitee_uri: appointment.calendly_invitee_uri,
          },
          data: {
            calendly_event_uri: eventUri,
            calendly_invitee_uri: inviteeUri,
          },
        });
        canonicalized = repair.count === 1;
      }
      if (canonicalized) {
        return {
          appointment_id: appointment.id,
          calendly_sync_status: appointment.calendly_sync_status,
          appointment_datetime: appointment.appointment_datetime,
        };
      }
    }

    let scheduledStartTime: Date | null = null;
    try {
      scheduledStartTime =
        await this.calendlyIntegrationService.resolveScheduledStartTime(
          appointment.specialist_id,
          eventUri,
          inviteeUri,
        );
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.warn(
        `[registerCalendlyScheduled] Falha ao buscar horário no Calendly API: ${error?.message}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await acquireSpecialistScheduleLock(tx, appointment.specialist_id);
      const lockedAppointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
      });
      if (!lockedAppointment) {
        throw new NotFoundException({
          success: false,
          error: { code: 404, message: 'Agendamento não encontrado' },
        });
      }
      if (lockedAppointment.client_id !== userId) {
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
        lockedAppointment.status !== StatusAgendamento.PENDING &&
        lockedAppointment.status !== StatusAgendamento.SCHEDULED
      ) {
        throw new BadRequestException({
          success: false,
          error: {
            code: 400,
            message:
              'Somente agendamentos pendentes ou agendados aceitam sincronização Calendly',
          },
        });
      }
      if (
        lockedAppointment.scheduling_method &&
        lockedAppointment.scheduling_method !==
          AppointmentSchedulingMethod.CALENDLY
      ) {
        throw new BadRequestException(
          'Este agendamento não foi criado pelo Calendly',
        );
      }
      if (lockedAppointment.specialist_rescheduled_at) {
        throw this.buildRescheduleAlreadyUsedError(appointmentId);
      }
      if (
        lockedAppointment.calendly_event_uri &&
        parseCalendlyResourceUri(
          lockedAppointment.calendly_event_uri,
          'event',
        )?.canonicalUri === eventUri
      ) {
        if (
          lockedAppointment.calendly_invitee_uri &&
          parseCalendlyResourceUri(
            lockedAppointment.calendly_invitee_uri,
            'invitee',
          )?.canonicalUri !== inviteeUri
        ) {
          throw new ConflictException(
            'O evento do Calendly já está associado a outro convidado',
          );
        }
        if (
          lockedAppointment.calendly_event_uri !== eventUri ||
          lockedAppointment.calendly_invitee_uri !== inviteeUri
        ) {
          return tx.appointment.update({
            where: { id: lockedAppointment.id },
            data: {
              calendly_event_uri: eventUri,
              calendly_invitee_uri: inviteeUri,
            },
          });
        }
        return lockedAppointment;
      }

      const targetDateTime = scheduledStartTime;
      if (targetDateTime && !isFutureDate(targetDateTime)) {
        throw new BadRequestException(
          'O horário sincronizado do Calendly deve ser futuro',
        );
      }
      await assertSpecialistScheduleAvailable(
        tx,
        lockedAppointment.specialist_id,
        targetDateTime,
        lockedAppointment.id,
      );
      const syncStatus = targetDateTime
        ? CalendlySyncStatus.SYNCED
        : CalendlySyncStatus.PENDING;
      return tx.appointment.update({
        where: { id: lockedAppointment.id },
        data: {
          calendly_event_uri: eventUri,
          calendly_invitee_uri: inviteeUri,
          calendly_scheduled_at: dto.client_observed_at
            ? new Date(dto.client_observed_at)
            : new Date(),
          calendly_last_sync_at: new Date(),
          calendly_sync_status: syncStatus,
          appointment_datetime: targetDateTime,
        },
      });
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
