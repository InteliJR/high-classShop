import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { CreateProposalDto, RespondProposalDto } from './dto';
import { AuthGuard } from 'src/auth/auth.guard';

/**
 * ProposalsController
 *
 * Controlador para gerenciamento de propostas de negociação
 *
 * Endpoints:
 * - POST /api/proposals - Criar proposta inicial ou contraproposta
 * - GET /api/processes/:processId/proposals - Listar propostas do processo
 * - GET /api/proposals/:id - Obter proposta específica
 * - PATCH /api/proposals/:id/accept - Aceitar proposta
 * - PATCH /api/proposals/:id/reject - Rejeitar proposta
 *
 * Autenticação: Todos os endpoints requerem JWT válido (AuthGuard)
 */
@Controller('proposals')
@UseGuards(AuthGuard)
export class ProposalsController {
  private readonly logger = new Logger(ProposalsController.name);

  constructor(private proposalsService: ProposalsService) {}

  /**
   * POST /api/proposals
   *
   * Cria nova proposta de negociação
   *
   * Request Body:
   * {
   *   "process_id": "uuid",
   *   "proposed_value": 150000.00,
   *   "message": "Mensagem opcional",
   *   "counter_to_id": "uuid" // opcional, para contrapropostas
   * }
   *
   * Respostas:
   * - 201 Created: Proposta criada
   * - 400 Bad Request: Validação falhou (valor < 80%, processo não em NEGOTIATION)
   * - 403 Forbidden: Usuário não é participante
   * - 404 Not Found: Processo não encontrado
   */
  @Post()
  async create(@Body() dto: CreateProposalDto, @Request() req: any) {
    const userId = req.user.id;
    this.logger.log(
      `[POST /proposals] Criando proposta para processo ${dto.process_id}`,
    );

    const proposal = await this.proposalsService.create(dto, userId);

    return {
      success: true,
      message: 'Proposta criada com sucesso',
      data: proposal,
    };
  }

  /**
   * GET /api/processes/:processId/proposals
   *
   * Lista todas as propostas de um processo
   * Inclui metadados: quem deve responder, valor mínimo, etc.
   *
   * Respostas:
   * - 200 OK: Lista de propostas com metadados
   * - 403 Forbidden: Usuário não é participante
   * - 404 Not Found: Processo não encontrado
   */
  @Get('processes/:processId/proposals')
  async getByProcess(
    @Param('processId') processId: string,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    this.logger.log(
      `[GET /processes/${processId}/proposals] Listando propostas`,
    );

    const result = await this.proposalsService.getByProcess(processId, userId);

    return {
      success: true,
      message: 'Propostas listadas com sucesso',
      data: result.proposals,
      process: result.process,
      meta: result.meta,
    };
  }

  /**
   * GET /proposals/:id
   *
   * Obtém proposta específica
   *
   * Respostas:
   * - 200 OK: Dados da proposta
   * - 403 Forbidden: Usuário não é participante
   * - 404 Not Found: Proposta não encontrada
   */
  @Get(':id')
  async getById(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.id;
    this.logger.log(`[GET /proposals/${id}] Buscando proposta`);

    const proposal = await this.proposalsService.getById(id, userId);

    return {
      success: true,
      message: 'Proposta encontrada',
      data: proposal,
    };
  }

  /**
   * PATCH /proposals/:id/accept
   *
   * Aceita uma proposta
   * Move processo para PROCESSING_CONTRACT
   *
   * Request Body (opcional):
   * { "message": "Mensagem opcional" }
   *
   * Respostas:
   * - 200 OK: Proposta aceita, processo atualizado
   * - 400 Bad Request: Proposta já respondida ou processo não em NEGOTIATION
   * - 403 Forbidden: Usuário não é destinatário
   * - 404 Not Found: Proposta não encontrada
   */
  @Patch(':id/accept')
  async accept(
    @Param('id') id: string,
    @Body() dto: RespondProposalDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    this.logger.log(`[PATCH /proposals/${id}/accept] Aceitando proposta`);

    const proposal = await this.proposalsService.accept(id, userId, dto);

    return {
      success: true,
      message:
        'Proposta aceita com sucesso. Processo movido para preparação do contrato.',
      data: proposal,
    };
  }

  /**
   * PATCH /proposals/:id/reject
   *
   * Rejeita uma proposta
   * Permite nova proposta do rejeitador
   *
   * Request Body (opcional):
   * { "message": "Motivo da rejeição" }
   *
   * Respostas:
   * - 200 OK: Proposta rejeitada
   * - 400 Bad Request: Proposta já respondida
   * - 403 Forbidden: Usuário não é destinatário
   * - 404 Not Found: Proposta não encontrada
   */
  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() dto: RespondProposalDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    this.logger.log(`[PATCH /proposals/${id}/reject] Rejeitando proposta`);

    const proposal = await this.proposalsService.reject(id, userId, dto);

    return {
      success: true,
      message: 'Proposta rejeitada. Você pode enviar uma nova proposta.',
      data: proposal,
    };
  }
}
