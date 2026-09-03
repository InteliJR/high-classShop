import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProposalDto, RespondProposalDto } from './dto';
import {
  ProposalResponseEntity,
  ProposalListResponseEntity,
} from './entities/proposal.entity';
import { Prisma, ProposalStatus, ProcessStatus } from '@prisma/client';
import { SettingsService } from 'src/features/settings/settings.service';
import { NotificationService } from 'src/features/notifications/notification.service';
import { requireNegotiationSnapshot } from 'src/features/processes/negotiation-snapshot';
import { calculateMinimumProposalValue } from './proposal-money';

/**
 * ProposalsService
 *
 * Serviço responsável pela lógica de negócio de propostas de negociação
 *
 * Fluxo de negociação:
 * 1. Cliente envia proposta inicial (valor >= 80% do produto, se ativado)
 * 2. Especialista pode: ACEITAR, REJEITAR ou CONTRAPROPOR
 * 3. Se aceitar: processo move para PROCESSING_CONTRACT
 * 4. Se rejeitar: cliente pode enviar nova proposta
 * 5. Se contrapropor: cliente pode aceitar, rejeitar ou contrapropor
 * 6. Ciclo continua até acordo ou desistência
 *
 * Regras:
 * - Valor mínimo: configurável via Settings (minimum_proposal_enabled/percentage)
 * - Alternância: após proposta, outro participante deve responder
 * - Apenas participantes do processo podem criar/responder propostas
 * - Apenas em status NEGOTIATION
 */
@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
    private notificationService: NotificationService,
  ) {}

  /**
   * Cria uma nova proposta de negociação
   *
   * @param dto Dados da proposta
   * @param userId ID do usuário autenticado
   * @returns Proposta criada
   * @throws BadRequestException Se validações falharem
   * @throws NotFoundException Se processo não encontrado
   * @throws ForbiddenException Se usuário não for participante
   */
  async create(
    dto: CreateProposalDto,
    userId: string,
  ): Promise<ProposalResponseEntity> {
    this.logger.log(
      `[create] Criando proposta para processo ${dto.process_id} por usuário ${userId}`,
    );

    // 1. Buscar processo com dados completos
    const process = await this.prisma.process.findUnique({
      where: { id: dto.process_id },
      include: {
        client: {
          select: {
            id: true,
            email: true,
            name: true,
            surname: true,
            role: true,
            consultant_id: true,
          },
        },
        specialist: {
          select: {
            id: true,
            email: true,
            name: true,
            surname: true,
            role: true,
          },
        },
        car: {
          select: { id: true, is_active: true },
        },
        boat: {
          select: { id: true, is_active: true },
        },
        aircraft: {
          select: { id: true, is_active: true },
        },
        proposals: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: {
            proposed_by: { select: { id: true } },
          },
        },
      },
    });

    if (!process) {
      this.logger.warn(`[create] Processo ${dto.process_id} não encontrado`);
      throw new NotFoundException({
        success: false,
        error: {
          code: 404,
          message: 'Processo não encontrado',
          details: { process_id: dto.process_id },
        },
      });
    }

    // 2. Validar que processo está em NEGOTIATION
    if (process.status !== ProcessStatus.NEGOTIATION) {
      this.logger.warn(
        `[create] Processo ${dto.process_id} não está em NEGOTIATION (status: ${process.status})`,
      );
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message: 'Processo não está em fase de negociação',
          details: {
            current_status: process.status,
            required_status: 'NEGOTIATION',
          },
        },
      });
    }

    // 3. Validar que usuário é participante do processo (cliente, especialista ou consultor do cliente)
    const isClient = process.client_id === userId;
    const isSpecialist = process.specialist_id === userId;
    const isConsultantOfClient = process.client?.consultant_id === userId;
    const isOnClientSide = isClient || isConsultantOfClient;

    if (!isClient && !isSpecialist && !isConsultantOfClient) {
      this.logger.warn(
        `[create] Usuário ${userId} não é participante do processo ${dto.process_id}`,
      );
      throw new ForbiddenException({
        success: false,
        error: {
          code: 403,
          message: 'Você não é participante deste processo',
          details: { user_id: userId, process_id: dto.process_id },
        },
      });
    }

    // 4. Validar alternância por lado (cliente/consultor vs especialista) — não pode dois envios seguidos do mesmo lado
    const lastProposal = process.proposals[0];
    if (lastProposal && lastProposal.status === ProposalStatus.PENDING) {
      const lastProposerSide =
        lastProposal.proposed_by.id === process.specialist_id
          ? 'SPECIALIST'
          : 'CLIENT';
      const userSide = isOnClientSide ? 'CLIENT' : 'SPECIALIST';
      if (lastProposerSide === userSide) {
        this.logger.warn(
          `[create] Usuário ${userId} tentou enviar proposta seguida (lado ${userSide})`,
        );
        throw new BadRequestException({
          success: false,
          error: {
            code: 400,
            message: 'Aguarde a resposta da proposta anterior',
            details: {
              last_proposal_id: lastProposal.id,
              last_proposal_status: lastProposal.status,
            },
          },
        });
      }
    }

    // 5. Obter valor do produto
    const product = process.car || process.boat || process.aircraft;
    if (!product) {
      this.logger.error(
        `[create] Processo ${dto.process_id} não tem produto associado`,
      );
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message:
            'Processo não possui produto associado. O especialista deve selecionar um produto antes de iniciar a negociação.',
          details: {
            process_id: dto.process_id,
            tip: 'Se este é um processo de consultoria, o especialista precisa atribuir um produto através da opção "Selecionar Produto" na página de processos.',
          },
        },
      });
    }

    const { currency, productValue: snapshotValue } =
      requireNegotiationSnapshot(process);
    const productValue = Number(snapshotValue);

    // 6. Validar valor mínimo (se ativado nas configurações)
    const minimumEnabled =
      await this.settingsService.isMinimumProposalEnabled();
    const minimumPercentage = minimumEnabled
      ? await this.settingsService.getMinimumProposalPercentage()
      : null;
    const minimumValue =
      minimumPercentage === null
        ? null
        : calculateMinimumProposalValue(snapshotValue, minimumPercentage);

    if (
      minimumValue !== null &&
      new Prisma.Decimal(dto.proposed_value).lt(minimumValue)
    ) {
      this.logger.warn(
        `[create] Valor proposto ${dto.proposed_value} abaixo do mínimo ${minimumValue.toFixed(2)}`,
      );
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message: `Valor proposto deve ser no mínimo ${Math.round(minimumPercentage! * 100)}% do valor do produto`,
          details: {
            proposed_value: dto.proposed_value,
            minimum_value: Number(minimumValue),
            product_value: productValue,
            minimum_percentage: `${Math.round(minimumPercentage! * 100)}%`,
          },
        },
      });
    }

    // 7. Validar counter_to_id se fornecido
    if (dto.counter_to_id) {
      const originalProposal = await this.prisma.negotiationProposal.findUnique(
        {
          where: { id: dto.counter_to_id },
        },
      );

      if (!originalProposal) {
        throw new NotFoundException({
          success: false,
          error: {
            code: 404,
            message: 'Proposta original não encontrada',
            details: { counter_to_id: dto.counter_to_id },
          },
        });
      }

      if (originalProposal.status !== ProposalStatus.PENDING) {
        throw new BadRequestException({
          success: false,
          error: {
            code: 400,
            message: 'Proposta original já foi respondida',
            details: {
              counter_to_id: dto.counter_to_id,
              status: originalProposal.status,
            },
          },
        });
      }
    }

    // 8. Determinar destinatário (lado oposto)
    const proposedToId = isOnClientSide
      ? process.specialist_id
      : process.client_id;

    // 9. Criar proposta em transação
    const proposal = await this.prisma.$transaction(async (tx) => {
      // Se está respondendo a uma proposta, marcar a original como COUNTERED
      if (dto.counter_to_id) {
        await tx.negotiationProposal.update({
          where: { id: dto.counter_to_id },
          data: { status: ProposalStatus.COUNTERED },
        });
        this.logger.log(
          `[create] Proposta ${dto.counter_to_id} marcada como COUNTERED`,
        );
      }

      // Criar nova proposta
      return tx.negotiationProposal.create({
        data: {
          process_id: dto.process_id,
          proposed_by_id: userId,
          proposed_to_id: proposedToId,
          proposed_value: dto.proposed_value,
          message: dto.message,
          counter_to_id: dto.counter_to_id,
          status: ProposalStatus.PENDING,
        },
        include: {
          proposed_by: {
            select: { id: true, name: true, surname: true, role: true },
          },
          proposed_to: {
            select: { id: true, name: true, surname: true, role: true },
          },
        },
      });
    });

    this.logger.log(
      `[create] Proposta ${proposal.id} criada com sucesso (valor: ${dto.proposed_value})`,
    );

    // Fire-and-forget: Enviar notificação de nova proposta
    // Reutiliza productValue já calculado acima
    const recipientName = isOnClientSide
      ? `${process.specialist.name} ${process.specialist.surname || ''}`.trim()
      : `${process.client.name} ${process.client.surname || ''}`.trim();
    const proposerName = isOnClientSide
      ? `${process.client.name} ${process.client.surname || ''}`.trim()
      : `${process.specialist.name} ${process.specialist.surname || ''}`.trim();
    const recipientEmail = isOnClientSide
      ? process.specialist.email!
      : process.client.email!;

    setImmediate(() => {
      this.notificationService
        .sendProposalReceivedEmail({
          recipientEmail,
          recipientName,
          proposerName,
          proposedValue: dto.proposed_value,
          originalValue: productValue,
          currency,
          message: dto.message,
          processId: dto.process_id,
        })
        .catch((err) => {
          this.logger.error('Notification failed (non-critical)', {
            method: 'create',
            proposalId: proposal.id,
            error: err.message,
          });
        });
    });

    return this.mapToResponseEntity(proposal);
  }

  /**
   * Lista todas as propostas de um processo
   *
   * @param processId ID do processo
   * @param userId ID do usuário autenticado
   * @returns Lista de propostas com metadados
   */
  async getByProcess(
    processId: string,
    userId: string,
  ): Promise<ProposalListResponseEntity> {
    this.logger.log(
      `[getByProcess] Buscando propostas do processo ${processId}`,
    );

    // 1. Buscar processo
    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            surname: true,
            role: true,
            consultant_id: true,
          },
        },
        specialist: {
          select: { id: true, name: true, surname: true, role: true },
        },
        car: {
          select: {
            id: true,
            is_active: true,
          },
        },
        boat: {
          select: {
            id: true,
            is_active: true,
          },
        },
        aircraft: {
          select: {
            id: true,
            is_active: true,
          },
        },
        accepted_proposal: { select: { id: true } },
        proposals: {
          orderBy: { created_at: 'asc' },
          include: {
            proposed_by: {
              select: { id: true, name: true, surname: true, role: true },
            },
            proposed_to: {
              select: { id: true, name: true, surname: true, role: true },
            },
          },
        },
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

    // 2. Validar que usuário é participante (cliente, especialista ou consultor do cliente)
    const isParticipant =
      process.client_id === userId ||
      process.specialist_id === userId ||
      process.client?.consultant_id === userId;

    if (!isParticipant) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 403,
          message: 'Você não é participante deste processo',
          details: { user_id: userId, process_id: processId },
        },
      });
    }

    // 3. Calcular valores
    const product = process.car || process.boat || process.aircraft;

    if (!product) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message:
            'Negociação indisponível: o processo ainda está aguardando seleção de produto pelo especialista.',
          details: {
            process_id: processId,
            tip: 'Acesse a tela de processos e associe um produto para habilitar a negociação.',
          },
        },
      });
    }

    const { currency, productValue: snapshotValue } =
      requireNegotiationSnapshot(process);
    const productValue = Number(snapshotValue);

    // Get minimum value based on settings (async)
    const minimumEnabled =
      await this.settingsService.isMinimumProposalEnabled();
    const minimumPercentage = minimumEnabled
      ? await this.settingsService.getMinimumProposalPercentage()
      : null;
    const minimumValue =
      minimumPercentage === null
        ? null
        : calculateMinimumProposalValue(snapshotValue, minimumPercentage);

    // 4. Determinar quem deve responder
    const lastPendingProposal = process.proposals.find(
      (p) => p.status === ProposalStatus.PENDING,
    );
    const pendingResponseFrom = lastPendingProposal?.proposed_to_id;

    // 5. Verificar se usuário pode criar proposta (lógica por lado)
    const userSide: 'CLIENT' | 'SPECIALIST' | null =
      process.client_id === userId || process.client?.consultant_id === userId
        ? 'CLIENT'
        : process.specialist_id === userId
          ? 'SPECIALIST'
          : null;

    const lastPendingTargetSide: 'CLIENT' | 'SPECIALIST' | null =
      lastPendingProposal
        ? lastPendingProposal.proposed_to_id === process.specialist_id
          ? 'SPECIALIST'
          : 'CLIENT'
        : null;

    const canCreateProposal =
      userSide !== null &&
      process.status === ProcessStatus.NEGOTIATION &&
      (!lastPendingProposal || lastPendingTargetSide === userSide);

    return {
      proposals: process.proposals.map((p) => this.mapToResponseEntity(p)),
      process: {
        id: process.id,
        status: process.status,
        product_type: process.product_type,
        product_is_active:
          product && typeof product === 'object' && 'is_active' in product
            ? Boolean((product as any).is_active)
            : undefined,
        product_value: productValue,
        currency,
        minimum_enabled: minimumEnabled,
        minimum_value: minimumValue === null ? null : Number(minimumValue),
        client: {
          id: process.client.id,
          name: process.client.name,
          surname: process.client.surname,
        },
        specialist: {
          id: process.specialist.id,
          name: process.specialist.name,
          surname: process.specialist.surname,
        },
      },
      meta: {
        total: process.proposals.length,
        pending_response_from: pendingResponseFrom,
        can_create_proposal: canCreateProposal,
        accepted_proposal_id: process.accepted_proposal?.id,
      },
    };
  }

  /**
   * Aceita uma proposta
   * Move processo para PROCESSING_CONTRACT
   *
   * @param proposalId ID da proposta
   * @param userId ID do usuário autenticado
   * @param dto Dados opcionais (mensagem)
   * @returns Proposta atualizada
   */
  async accept(
    proposalId: string,
    userId: string,
    dto?: RespondProposalDto,
  ): Promise<ProposalResponseEntity> {
    this.logger.log(`[accept] Aceitando proposta ${proposalId}`);

    const response = await this.prisma.$transaction(async (tx) => {
      const proposal = await this.validateProposalAction(
        proposalId,
        userId,
        tx,
      );
      const { currency } = requireNegotiationSnapshot(proposal.process);

      // Apenas uma resposta concorrente pode reivindicar uma proposta PENDING.
      const proposalClaim = await tx.negotiationProposal.updateMany({
        where: {
          id: proposalId,
          status: ProposalStatus.PENDING,
          process: { status: ProcessStatus.NEGOTIATION },
        },
        data: { status: ProposalStatus.ACCEPTED },
      });
      if (proposalClaim.count !== 1) {
        throw this.proposalResponseConflict(proposalId);
      }

      // A transação desfaz a reivindicação da proposta se o processo já avançou.
      const processClaim = await tx.process.updateMany({
        where: {
          id: proposal.process_id,
          status: ProcessStatus.NEGOTIATION,
          accepted_proposal_id: null,
        },
        data: {
          status: ProcessStatus.DOCUMENTATION,
          accepted_proposal_id: proposalId,
        },
      });
      if (processClaim.count !== 1) {
        throw this.proposalResponseConflict(proposalId);
      }

      await tx.processStatusHistory.create({
        data: {
          processId: proposal.process_id,
          status: ProcessStatus.DOCUMENTATION,
          changed_by: userId,
        },
      });

      const updated = await tx.negotiationProposal.findUniqueOrThrow({
        where: { id: proposalId },
        include: {
          proposed_by: {
            select: { id: true, name: true, surname: true, role: true },
          },
          proposed_to: {
            select: { id: true, name: true, surname: true, role: true },
          },
        },
      });

      this.logger.log(
        `[accept] Proposta ${proposalId} aceita, processo movido para DOCUMENTATION`,
      );

      return { updated, proposal, currency };
    });
    const { updated, proposal, currency } = response;

    // Fire-and-forget: Enviar notificação de proposta aceita
    const proposer = proposal.proposed_by;
    const accepter = proposal.proposed_to;
    setImmediate(() => {
      this.notificationService
        .sendProposalAcceptedEmail({
          proposerEmail: proposer.email!,
          proposerName: `${proposer.name} ${proposer.surname || ''}`.trim(),
          recipientName: `${accepter.name} ${accepter.surname || ''}`.trim(),
          acceptedValue: Number(proposal.proposed_value),
          currency,
          processId: proposal.process_id,
        })
        .catch((err) => {
          this.logger.error('Notification failed (non-critical)', {
            method: 'accept',
            proposalId,
            error: err.message,
          });
        });
    });

    const processForNotification = await this.prisma.process.findUnique({
      where: { id: proposal.process_id },
      include: {
        client: {
          select: { email: true, name: true, surname: true },
        },
        specialist: {
          select: { email: true, name: true, surname: true },
        },
      },
    });

    if (processForNotification) {
      setImmediate(() => {
        const recipients = [
          {
            email: processForNotification.client.email,
            name: `${processForNotification.client.name} ${processForNotification.client.surname || ''}`.trim(),
          },
          {
            email: processForNotification.specialist.email,
            name: `${processForNotification.specialist.name} ${processForNotification.specialist.surname || ''}`.trim(),
          },
        ].filter((recipient) => Boolean(recipient.email));

        const changedByName =
          `${proposal.proposed_to.name} ${proposal.proposed_to.surname || ''}`.trim();

        Promise.allSettled(
          recipients.map((recipient) =>
            this.notificationService.sendProcessStatusChangedEmail({
              recipientEmail: recipient.email!,
              recipientName: recipient.name || 'Usuário',
              processId: proposal.process_id,
              previousStatus: ProcessStatus.NEGOTIATION,
              currentStatus: ProcessStatus.DOCUMENTATION,
              changedByName,
              reason: 'Proposta aceita. Processo avançou para documentação.',
            }),
          ),
        ).catch((err) => {
          this.logger.error('Notification failed (non-critical)', {
            method: 'accept-process-status-changed',
            processId: proposal.process_id,
            error: err.message,
          });
        });
      });
    }

    return this.mapToResponseEntity(updated);
  }

  /**
   * Rejeita uma proposta
   * Permite nova proposta do rejeitador
   *
   * @param proposalId ID da proposta
   * @param userId ID do usuário autenticado
   * @param dto Dados opcionais (mensagem de rejeição)
   * @returns Proposta atualizada
   */
  async reject(
    proposalId: string,
    userId: string,
    dto?: RespondProposalDto,
  ): Promise<ProposalResponseEntity> {
    this.logger.log(`[reject] Rejeitando proposta ${proposalId}`);

    const response = await this.prisma.$transaction(async (tx) => {
      const proposal = await this.validateProposalAction(
        proposalId,
        userId,
        tx,
      );
      const { currency } = requireNegotiationSnapshot(proposal.process);

      const proposalClaim = await tx.negotiationProposal.updateMany({
        where: {
          id: proposalId,
          status: ProposalStatus.PENDING,
          process: { status: ProcessStatus.NEGOTIATION },
        },
        data: {
          status: ProposalStatus.REJECTED,
          message: dto?.message || proposal.message,
        },
      });
      if (proposalClaim.count !== 1) {
        throw this.proposalResponseConflict(proposalId);
      }

      const updated = await tx.negotiationProposal.findUniqueOrThrow({
        where: { id: proposalId },
        include: {
          proposed_by: {
            select: { id: true, name: true, surname: true, role: true },
          },
          proposed_to: {
            select: { id: true, name: true, surname: true, role: true },
          },
        },
      });

      return { updated, proposal, currency };
    });
    const { updated, proposal, currency } = response;

    this.logger.log(`[reject] Proposta ${proposalId} rejeitada`);

    // Fire-and-forget: Enviar notificação de proposta rejeitada
    const proposer = proposal.proposed_by;
    const rejecter = proposal.proposed_to;
    setImmediate(() => {
      this.notificationService
        .sendProposalRejectedEmail({
          proposerEmail: proposer.email!,
          proposerName: `${proposer.name} ${proposer.surname || ''}`.trim(),
          recipientName: `${rejecter.name} ${rejecter.surname || ''}`.trim(),
          rejectedValue: Number(proposal.proposed_value),
          currency,
          processId: proposal.process_id,
        })
        .catch((err) => {
          this.logger.error('Notification failed (non-critical)', {
            method: 'reject',
            proposalId,
            error: err.message,
          });
        });
    });

    return this.mapToResponseEntity(updated);
  }

  /**
   * Obtém uma proposta específica
   *
   * @param proposalId ID da proposta
   * @param userId ID do usuário autenticado
   * @returns Proposta
   */
  async getById(
    proposalId: string,
    userId: string,
  ): Promise<ProposalResponseEntity> {
    const proposal = await this.prisma.negotiationProposal.findUnique({
      where: { id: proposalId },
      include: {
        process: {
          select: {
            client_id: true,
            specialist_id: true,
            client: { select: { consultant_id: true } },
          },
        },
        proposed_by: {
          select: { id: true, name: true, surname: true, role: true },
        },
        proposed_to: {
          select: { id: true, name: true, surname: true, role: true },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 404,
          message: 'Proposta não encontrada',
          details: { proposal_id: proposalId },
        },
      });
    }

    // Validar participação (cliente, especialista ou consultor do cliente)
    const isParticipant =
      proposal.process.client_id === userId ||
      proposal.process.specialist_id === userId ||
      proposal.process.client?.consultant_id === userId;

    if (!isParticipant) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 403,
          message: 'Você não é participante deste processo',
        },
      });
    }

    return this.mapToResponseEntity(proposal);
  }

  /**
   * Valida se usuário pode agir sobre uma proposta
   * @private
   */
  private async validateProposalAction(
    proposalId: string,
    userId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<any> {
    const proposal = await client.negotiationProposal.findUnique({
      where: { id: proposalId },
      include: {
        process: {
          select: {
            status: true,
            client_id: true,
            specialist_id: true,
            product_type: true,
            car_id: true,
            boat_id: true,
            aircraft_id: true,
            negotiation_currency: true,
            negotiation_product_value: true,
            client: { select: { consultant_id: true } },
          },
        },
        proposed_by: {
          select: { id: true, email: true, name: true, surname: true },
        },
        proposed_to: {
          select: { id: true, email: true, name: true, surname: true },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 404,
          message: 'Proposta não encontrada',
          details: { proposal_id: proposalId },
        },
      });
    }

    // Validar destinatário — usuário direto ou consultor do cliente quando a proposta é para o cliente
    const isDirectTarget = proposal.proposed_to_id === userId;
    const isConsultantOfTargetClient =
      proposal.process.client?.consultant_id === userId &&
      proposal.proposed_to_id === proposal.process.client_id;

    if (!isDirectTarget && !isConsultantOfTargetClient) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 403,
          message: 'Apenas o destinatário pode responder a proposta',
          details: {
            proposal_id: proposalId,
            proposed_to_id: proposal.proposed_to_id,
            user_id: userId,
          },
        },
      });
    }

    // Validar status da proposta
    if (proposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message: 'Esta proposta já foi respondida',
          details: {
            proposal_id: proposalId,
            current_status: proposal.status,
          },
        },
      });
    }

    // Validar status do processo
    if (proposal.process.status !== ProcessStatus.NEGOTIATION) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message: 'Processo não está mais em negociação',
          details: {
            process_status: proposal.process.status,
          },
        },
      });
    }

    const hasProduct =
      !!proposal.process.product_type &&
      (!!proposal.process.car_id ||
        !!proposal.process.boat_id ||
        !!proposal.process.aircraft_id);

    if (!hasProduct) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message:
            'Negociação indisponível: o processo ainda está aguardando seleção de produto pelo especialista.',
          details: {
            tip: 'A negociação será habilitada após o especialista associar um produto ao processo.',
          },
        },
      });
    }

    return proposal;
  }

  private proposalResponseConflict(proposalId: string): ConflictException {
    return new ConflictException({
      success: false,
      error: {
        code: 'PROPOSAL_RESPONSE_CONFLICT',
        message:
          'A proposta ou o processo foi alterado por outra operação. Recarregue e tente novamente.',
        details: { proposal_id: proposalId },
      },
    });
  }

  /**
   * Mapeia entidade do Prisma para response entity
   * @private
   */
  private mapToResponseEntity(proposal: any): ProposalResponseEntity {
    return {
      id: proposal.id,
      process_id: proposal.process_id,
      proposed_value: Number(proposal.proposed_value),
      status: proposal.status,
      message: proposal.message,
      counter_to_id: proposal.counter_to_id,
      created_at: proposal.created_at,
      updated_at: proposal.updated_at,
      proposed_by: proposal.proposed_by,
      proposed_to: proposal.proposed_to,
    };
  }
}
