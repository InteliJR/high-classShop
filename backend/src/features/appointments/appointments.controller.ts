import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpStatus,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto,
  CalendlyScheduledDto,
  GetAppointmentsQueryDto,
  UpdateAppointmentStatusDto,
} from './dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { AppointmentResponseEntity } from './entities/appointment.response';
import { UserEntity } from 'src/auth/entities/user.entity';

/**
 * AppointmentsController
 *
 * Controlador responsável por rotear requisições HTTP para o AppointmentsService
 * Implementa 4 endpoints principais para gerenciar agendamentos (Appointments)
 *
 * Fluxo esperado:
 * 1. GET /api/appointments → listar com filtros e paginação
 * 2. POST /api/appointments → criar novo agendamento
 * 3. GET /api/appointments/:id → obter detalhes
 * 4. PUT /api/appointments/:id/status → atualizar status
 *
 * Autenticação: Todos os endpoints requerem JWT válido (AuthGuard)
 *
 * Frontend:
 * - Token JWT deve ser enviado no header Authorization: Bearer <token>
 * - Erros retornam estrutura padrão com code, message, details
 * - Dados retornam em UTC ISO 8601 (frontend converte para local)
 */
@Controller('appointments')
@UseGuards(AuthGuard)
export class AppointmentsController {
  constructor(private appointmentsService: AppointmentsService) {}

  /**
   * GET /api/appointments
   *
   * Lista todos os agendamentos com paginação, filtros e ordenação
   * Respeitando permissões do usuário autenticado
   *
   * Query Parameters:
   * - page (default: 1): número da página
   * - limit (default: 20): itens por página
   * - status: filtro por status (SCHEDULED, COMPLETED, CANCELLED)
   * - date_from: filtro data inicial (YYYY-MM-DD)
   * - date_to: filtro data final (YYYY-MM-DD)
   * - client_id: filtro por cliente (UUID)
   * - specialist_id: filtro por especialista (UUID)
   * - product_type: filtro por tipo (CAR, BOAT, AIRCRAFT)
   * - sort: ordenação (appointment_datetime, created_at)
   * - order: direção (ASC, DESC)
   *
   * Respostas esperadas:
   * - 200 OK: Lista com paginação e resumo
   * - 400 Bad Request: Validação falhou (date_from inválida, etc)
   * - 403 Forbidden: Tentando acessar dados que não tem permissão
   * - 401 Unauthorized: Token JWT inválido ou expirado
   *
   * Exemplo de resposta 200:
   * {
   *   "success": true,
   *   "message": "Agendamentos listados com sucesso",
   *   "data": [{
   *     "id": "uuid",
   *     "appointment_datetime": "2024-10-10T14:00:00Z",
   *     "status": "SCHEDULED",
   *     "client": { "id", "name", "email" },
   *     "specialist": { "id", "name", "calendly_url" },
   *     "product": { "id", "marca", "modelo" },
   *     "created_at": "2024-10-08T14:30:00Z",
   *     "updated_at": "2024-10-08T14:30:00Z"
   *   }],
   *   "meta": {
   *     "pagination": {
   *       "current_page": 1,
   *       "per_page": 20,
   *       "total": 8,
   *       "total_pages": 1,
   *       "has_next": false,
   *       "has_prev": false
   *     },
   *     "summary": {
   *       "upcoming": 5,
   *       "completed": 2,
   *       "cancelled": 1
   *     }
   *   }
   * }
   *
   * Frontend:
   * - appointment_datetime vem em UTC ISO 8601
   * - Converter para horário local: new Date("2024-10-10T14:00:00Z").toLocaleString()
   * - Usar campo updated_at para saber última atualização
   * - has_next/has_prev para implementar paginação
   * - summary.upcoming para mostrar "5 agendamentos próximos"
   */
  /**
   * GET /api/appointments/check
   *
   * Verifica se existe agendamento SCHEDULED entre cliente e especialista para um produto específico
   * Usado para impedir agendamentos duplicados e condicionalmente exibir botão de confirmação
   *
   * Query Parameters (todos obrigatórios):
   * - client_id: UUID do cliente
   * - specialist_id: UUID do especialista
   * - product_type: CAR | BOAT | AIRCRAFT
   * - product_id: ID numérico do produto
   *
   * Respostas esperadas:
   * - 200 OK: Retorna null se não encontrado, ou Appointment se existe
   * - 400 Bad Request: Parâmetros inválidos ou ausentes
   * - 401 Unauthorized: Token JWT inválido
   *
   * Exemplo de resposta 200 (sem agendamento):
   * {
   *   "success": true,
   *   "message": "Agendamento não encontrado",
   *   "data": null
   * }
   *
   * Exemplo de resposta 200 (com agendamento):
   * {
   *   "success": true,
   *   "message": "Agendamento encontrado",
   *   "data": {
   *     "id": "uuid",
   *     "appointment_datetime": "2024-10-10T14:00:00Z",
   *     "status": "SCHEDULED",
   *     "created_at": "2024-10-08T14:30:00Z"
   *   }
   * }
   *
   * Frontend:
   * - Usar este endpoint ao carregar ProductPage
   * - Se retorna dados: Mostrar "Você já possui um agendamento marcado"
   * - Se retorna null: Mostrar botão de confirmação normalmente
   */
  @Get('check')
  async checkExisting(@Query() query: any, @Request() req: any) {
    const { client_id, specialist_id, product_type, product_id } = query;

    const appointment = await this.appointmentsService.findExistingAppointment(
      client_id,
      specialist_id,
      product_type,
      product_id,
    );

    return {
      success: true,
      message: appointment
        ? 'Agendamento encontrado'
        : 'Agendamento não encontrado',
      data: appointment,
    };
  }

  @Get()
  async list(@Query() query: GetAppointmentsQueryDto, @Request() req: any) {
    // userId e userRole vêm do AuthGuard (JWT descodificado)
    const userId = req.user.id;
    const userRole = req.user.role;

    return this.appointmentsService.getAppointments(query, userId, userRole);
  }

  /**
   * POST /api/appointments
   *
   * Cria novo agendamento e auto-cria Process vinculado
   *
   * Request Body:
   * {
   *   "client_id": "uuid-cliente",
   *   "specialist_id": "uuid-especialista",
   *   "product_type": "CAR",
   *   "product_id": 1,
   *   "appointment_datetime": "2024-10-10T14:00:00Z",
   *   "notes": "Test drive"
   * }
   *
   * Respostas esperadas:
   * - 201 Created: Agendamento criado com sucesso
   * - 400 Bad Request: Dados inválidos, appointment_datetime no passado, etc
   * - 409 Conflict: Conflito de horário (especialista já agendado)
   * - 404 Not Found: Cliente, especialista ou produto não encontrado
   * - 401 Unauthorized: Token JWT inválido
   *
   * Exemplo de resposta 201:
   * {
   *   "success": true,
   *   "message": "Agendamento criado com sucesso",
   *   "data": {
   *     "id": "uuid",
   *     "appointment_datetime": "2024-10-10T14:00:00Z",
   *     "status": "SCHEDULED",
   *     "notes": "Test drive",
   *     "client": { "id", "name" },
   *     "specialist": { "id", "name" },
   *     "product": { "id": 1, "marca": "Ferrari", "modelo": "F8" },
   *     "created_at": "2024-10-08T14:30:00Z"
   *   }
   * }
   *
   * Exemplo de resposta 409 (conflito):
   * {
   *   "success": false,
   *   "error": {
   *     "code": 409,
   *     "message": "Especialista já possui agendamento neste horário",
   *     "details": {
   *       "conflicting_appointment": {
   *         "id": "uuid",
   *         "appointment_datetime": "2024-10-10T14:00:00Z",
   *         "client_id": "uuid"
   *       },
   *       "suggested_times": [
   *         "2024-10-10T15:00:00Z",
   *         "2024-10-10T16:00:00Z",
   *         "2024-10-10T17:00:00Z"
   *       ]
   *     }
   *   }
   * }
   *
   * Frontend:
   * - Capturar 409 e exibir suggested_times ao usuário
   * - Converter suggested_times de UTC para horário local para exibição
   * - appointment_datetime enviado deve estar em UTC (converter do input local)
   * - Após sucesso (201), redirecionare para página de confirmação
   * - Auto-criação de Process é transparente (não precisa de ação adicional)
   */
  @Post()
  async create(
    @Body() createAppointmentDto: CreateAppointmentDto,
    @Request() req: any,
  ) {
    // userId vem do AuthGuard
    const userId = req.user.id;

    const appointment = await this.appointmentsService.create(
      createAppointmentDto,
      userId,
    );

    return {
      success: true,
      message: 'Agendamento criado com sucesso',
      data: appointment,
    };
  }

  /**
   * GET /api/appointments/:id
   *
   * Obtém detalhes de um agendamento específico
   *
   * Path Parameters:
   * - id (string, UUID): ID do agendamento
   *
   * Respostas esperadas:
   * - 200 OK: Agendamento encontrado
   * - 404 Not Found: Agendamento não existe
   * - 403 Forbidden: Usuário não tem permissão (não é participante nem admin)
   * - 401 Unauthorized: Token JWT inválido
   *
   * Exemplo de resposta 200:
   * {
   *   "success": true,
   *   "message": "Agendamento obtido com sucesso",
   *   "data": {
   *     "id": "uuid",
   *     "appointment_datetime": "2024-10-10T14:00:00Z",
   *     "status": "SCHEDULED",
   *     "notes": "Test drive",
   *     "client": { "id", "name", "email" },
   *     "specialist": { "id", "name", "calendly_url" },
   *     "product": { "id", "marca", "modelo", "valor" },
   *     "created_at": "2024-10-08T14:30:00Z",
   *     "updated_at": "2024-10-08T14:30:00Z"
   *   }
   * }
   *
   * Frontend:
   * - Usar este endpoint para carregar detalhes ao abrir modal/página de agendamento
   * - appointment_datetime em UTC, converter para local
   * - Mostrar links/botões conforme status e role do usuário
   */
  @Get(':id')
  async getById(@Param('id') id: string, @Request() req: any) {
    // userId e userRole vêm do AuthGuard
    const userId = req.user.id;
    const userRole = req.user.role;

    const appointment = await this.appointmentsService.getById(
      id,
      userId,
      userRole,
    );

    return {
      success: true,
      message: 'Agendamento obtido com sucesso',
      data: appointment,
    };
  }

  /**
   * PUT /api/appointments/:id/status
   *
   * Atualiza status de um agendamento
   *
   * FLUXO CRÍTICO: Se novo status = COMPLETED:
   * - Se Process vinculado está em SCHEDULING → move automaticamente para NEGOTIATION
   * - Se Process já está em NEGOTIATION+ → não retrocede (mantém integridade)
   * - Permite próxima fase do processo de vendas
   *
   * Path Parameters:
   * - id (string, UUID): ID do agendamento
   *
   * Request Body:
   * {
   *   "status": "COMPLETED",
   *   "notes": "Reunião concluída com sucesso"
   * }
   *
   * Respostas esperadas:
   * - 200 OK: Status atualizado com sucesso
   * - 400 Bad Request: Status inválido, transição ilógica
   * - 404 Not Found: Agendamento não existe
   * - 403 Forbidden: Usuário não tem permissão (não é participante nem admin)
   * - 401 Unauthorized: Token JWT inválido
   *
   * Exemplo de resposta 200:
   * {
   *   "success": true,
   *   "message": "Agendamento atualizado com sucesso",
   *   "data": {
   *     "id": "uuid",
   *     "status": "COMPLETED",
   *     "notes": "Reunião concluída com sucesso",
   *     "appointment_datetime": "2024-10-10T14:00:00Z",
   *     "completed_at": "2024-10-10T15:30:00Z",
   *     "updated_at": "2024-10-10T15:30:00Z",
   *     "client": { "id", "name" },
   *     "specialist": { "id", "name" },
   *     "product": { "id", "marca", "modelo" }
   *   }
   * }
   *
   * Frontend:
   * - Especialista marca agendamento como "concluído" via botão
   * - Ao confirmar (status=COMPLETED):
   *   - Sistema move Process para NEGOTIATION (auto, transparente)
   *   - Exibir mensagem "Agendamento concluído! Processo movido para negociação"
   *   - Redirecionar para próxima etapa (negociação)
   * - Campo notes é opcional, mas recomendado para auditoria
   * - Converter timestamp de UTC para local antes de exibir ao usuário
   */
  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateAppointmentStatusDto: UpdateAppointmentStatusDto,
    @Request() req: any,
  ) {
    // userId e userRole vêm do AuthGuard
    const userId = req.user.id;
    const userRole = req.user.role;

    const appointment = await this.appointmentsService.updateStatus(
      id,
      updateAppointmentStatusDto,
      userId,
      userRole,
    );

    return {
      success: true,
      message: 'Agendamento atualizado com sucesso',
      data: appointment,
    };
  }

  /**
   * POST /api/appointments/pending
   *
   * Cria um agendamento em status PENDING
   * Usado quando cliente clica no link do Calendly e retorna à plataforma
   * NÃO cria Process ainda - apenas registra intenção do cliente
   *
   * Request Body:
   * {
   *   "client_id": "uuid-cliente",
   *   "specialist_id": "uuid-especialista",
   *   "product_type": "CAR",
   *   "product_id": 1,
   *   "notes": "Acessei o calendário do especialista"
   * }
   *
   * Respostas:
   * - 201 Created: Agendamento PENDING criado
   * - 409 Conflict: Já existe agendamento PENDING ou SCHEDULED
   * - 403 Forbidden: Apenas o próprio cliente pode criar
   */
  @Post('pending')
  async createPending(@Body() dto: CreateAppointmentDto, @Request() req: any) {
    const userId = req.user.id;

    const appointment = await this.appointmentsService.createPending(
      dto,
      userId,
    );

    return {
      success: true,
      message: 'Agendamento pendente criado com sucesso',
      data: appointment,
    };
  }

  /**
   * GET /api/appointments/pending
   *
   * Lista agendamentos PENDING do especialista autenticado
   * Usado para o especialista ver quem acessou seu link
   *
   * Query Parameters:
   * - page (default: 1)
   * - limit (default: 20)
   */
  @Get('pending')
  async getPending(@Query() query: any, @Request() req: any) {
    const userId = req.user.id;
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);

    return this.appointmentsService.getPendingBySpecialist(userId, page, limit);
  }

  /**
   * POST /api/appointments/pending/:id/confirm
   *
   * Confirma um agendamento PENDING (transforma em SCHEDULED)
   * Apenas o especialista pode confirmar
   * Também cria o Process vinculado
   *
   * Request Body (opcional):
   * {
   *   "appointment_datetime": "2024-10-10T14:00:00Z"
   * }
   */
  @Post('pending/:id/confirm')
  async confirmPending(
    @Param('id') id: string,
    @Body() body: { appointment_datetime?: string },
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const appointmentDatetime = body.appointment_datetime
      ? new Date(body.appointment_datetime)
      : undefined;

    const appointment = await this.appointmentsService.confirmPending(
      id,
      userId,
      appointmentDatetime,
    );

    return {
      success: true,
      message: 'Agendamento confirmado com sucesso',
      data: appointment,
    };
  }

  /**
   * POST /api/appointments/pending/:id/cancel
   *
   * Cancela um agendamento PENDING e deleta o processo associado
   * Cliente ou especialista podem cancelar
   */
  @Post('pending/:id/cancel')
  async cancelPending(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.id;

    const result = await this.appointmentsService.cancelPending(id, userId);

    return result;
  }

  @Post('pending/:id/calendly-scheduled')
  async registerCalendlyScheduled(
    @Param('id') id: string,
    @Body() dto: CalendlyScheduledDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;

    const data = await this.appointmentsService.registerCalendlyScheduled(
      id,
      userId,
      dto,
    );

    return {
      success: true,
      message: 'Evento do Calendly registrado com sucesso',
      data,
    };
  }

  @Get(':id/calendly-sync-status')
  async getCalendlySyncStatus(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.id;
    const userRole = req.user.role as UserEntity['role'];

    const data = await this.appointmentsService.getCalendlySyncStatus(
      id,
      userId,
      userRole,
    );

    return {
      success: true,
      message: 'Status de sincronização obtido com sucesso',
      data,
    };
  }
}
