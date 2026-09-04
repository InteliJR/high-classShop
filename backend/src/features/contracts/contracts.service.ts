import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GenerateContractDto } from './dto/generate-contract.dto';
import { PreviewContractDto } from './dto/preview-contract.dto';
import {
  PreviewContractResponseDto,
  SendContractResponseDto,
} from './dto/preview-contract-response.dto';
import { PrefillContractResponseDto } from './dto/prefill-contract-response.dto';
import { ContractResponse } from './entity/contracts.response';
import { DocuSignService } from 'src/providers/docusign/docusign.service';
import { mapDocusignStatusToProviderStatus } from 'src/providers/docusign/mappers/envelope-status.mapper';
import {
  ProcessNotFoundException,
  SignerNotFoundException,
  ContractAlreadyExistsException,
  EnvelopeNotInDraftException,
  EnvelopeNotFoundException,
} from 'src/shared/exceptions/custom-exceptions';
import {
  formatCpf,
  formatCnpj,
  formatDocument,
  formatCep,
  formatRg,
  formatBRL,
  numberToWords,
  stripFormatting,
} from 'src/shared/utils/format.utils';
import { Prisma, ProcessStatus, ProductType, UserRole } from '@prisma/client';
import { NotificationService } from 'src/features/notifications/notification.service';
import { PlatformCompanyService } from 'src/features/platform-company/platform-company.service';
import { computeNestedCommissionSplit } from './commission-split';
import { requireNegotiationSnapshot } from 'src/features/processes/negotiation-snapshot';
import { EnvelopeStatus } from 'src/providers/docusign/enums/envelope-status.enum';
import {
  EnvelopeCreationAmbiguousError,
  EnvelopeEffectError,
  EnvelopeEffectState,
} from 'src/providers/docusign/envelope-effect.error';
import { randomUUID } from 'node:crypto';

const CONTRACT_PREPARATION_STATUSES: ProcessStatus[] = [
  ProcessStatus.PROCESSING_CONTRACT,
  ProcessStatus.DOCUMENTATION,
];

type CompensableEnvelopeEffect = Exclude<
  EnvelopeEffectState,
  'SEND_INDETERMINATE' | 'SEND_CONFIRMED'
>;

interface ExternalEnvelopeEffect {
  envelopeId: string;
  state: EnvelopeEffectState;
  providerStatus?: EnvelopeStatus;
}

export interface ContractDocumentFields {
  seller_cpf?: string;
  seller_rg?: string;
  seller_cep?: string;
  buyer_cpf?: string;
  buyer_rg?: string;
  buyer_cep?: string;
  platform_cnpj?: string;
  office_cnpj?: string;
  specialist_document?: string;
  testimonial1_cpf?: string;
  testimonial2_cpf?: string;
}

/**
 * Remove pontuação de todos os campos de documento/CEP do contrato antes de
 * gravar no banco — defesa em profundidade caso o chamador (frontend ou
 * integração futura) envie o valor já formatado. Recebe o DTO completo
 * (que tem mais campos além destes 11) e devolve só os campos
 * higienizados — os call sites leem `cleanDocs.seller_cpf` etc. e
 * continuam lendo os demais campos direto de `dto`.
 */
export function stripContractDocumentFields(
  fields: ContractDocumentFields,
): ContractDocumentFields {
  const strip = (v?: string) => (v ? stripFormatting(v) : v);
  return {
    seller_cpf: strip(fields.seller_cpf),
    seller_rg: strip(fields.seller_rg),
    seller_cep: strip(fields.seller_cep),
    buyer_cpf: strip(fields.buyer_cpf),
    buyer_rg: strip(fields.buyer_rg),
    buyer_cep: strip(fields.buyer_cep),
    platform_cnpj: strip(fields.platform_cnpj),
    office_cnpj: strip(fields.office_cnpj),
    specialist_document: strip(fields.specialist_document),
    testimonial1_cpf: strip(fields.testimonial1_cpf),
    testimonial2_cpf: strip(fields.testimonial2_cpf),
  };
}

/**
 * Serviço de Contratos - Geração via Formulário
 *
 * Responsabilidades:
 * 1. Pré-preencher dados do formulário (prefill)
 * 2. Validar integridade de negócio
 * 3. Formatar dados para DocuSign
 * 4. Criar envelope via template DocuSign
 * 5. Persistir contrato no banco em transação atômica
 *
 * Fluxo:
 * GET /contracts/prefill/:processId → Retorna dados para preencher formulário
 * POST /contracts/generate → Valida, formata, cria envelope, salva no BD
 */
@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly docuSignService: DocuSignService,
    private readonly notificationService: NotificationService,
    private readonly platformCompanyService: PlatformCompanyService,
  ) {}

  private async getAuthorizedContractProcess(
    processId: string,
    userId: string,
    client: PrismaService | Prisma.TransactionClient = this.prismaService,
  ): Promise<{
    id: string;
    status: ProcessStatus;
    active_contract_id: string | null;
    product_type: ProductType | null;
    specialist_id: string;
  }> {
    const [processRecord, requester] = await Promise.all([
      client.process.findUnique({
        where: { id: processId },
        select: {
          id: true,
          status: true,
          active_contract_id: true,
          product_type: true,
          specialist_id: true,
        },
      }),
      client.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      }),
    ]);

    if (!processRecord) throw new ProcessNotFoundException(processId);
    if (
      !requester ||
      (requester.role !== UserRole.ADMIN &&
        (requester.role !== UserRole.SPECIALIST ||
          processRecord.specialist_id !== userId))
    ) {
      throw new ForbiddenException(
        'Você não pode acessar contratos deste processo.',
      );
    }
    return processRecord;
  }

  private async assertEnvelopeBelongsToProcess(
    envelopeId: string,
    processId: string,
  ): Promise<void> {
    const envelopeProcessId =
      await this.docuSignService.getEnvelopeProcessId(envelopeId);
    if (envelopeProcessId !== processId) {
      throw new ForbiddenException(
        'O envelope informado não pertence a este processo.',
      );
    }
  }

  private assertProcessCanPrepareContract(
    processId: string,
    status: ProcessStatus,
  ): void {
    if (CONTRACT_PREPARATION_STATUSES.includes(status)) return;

    this.logger.warn(
      `Processo ${processId} não está em status adequado. Status atual: ${status}`,
    );
    throw new InternalServerErrorException({
      success: false,
      error: {
        code: 400,
        message:
          'Processo deve estar em fase de preparação de contrato ou documentação',
        details: {
          current_status: status,
          allowed_statuses: CONTRACT_PREPARATION_STATUSES,
        },
      },
    });
  }

  private async withContractProcessLock<T>(
    processId: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prismaService.$transaction(
      async (tx) => {
        const lockKey = `contract-process:${processId}`;
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS locked
        `;
        return operation(tx);
      },
      { maxWait: 10_000, timeout: 120_000 },
    );
  }

  private async compensateExternalEnvelope(
    envelopeId: string,
    processId: string,
    reason: string,
    persistenceError: unknown,
    effectState: CompensableEnvelopeEffect = 'DRAFT_CONFIRMED',
  ): Promise<void> {
    try {
      await this.withContractProcessLock(processId, async (tx) => {
        const processRecord = await tx.process.findUnique({
          where: { id: processId },
          select: { active_contract_id: true },
        });
        if (processRecord?.active_contract_id) {
          const activeContract = await tx.contract.findUnique({
            where: { id: processRecord.active_contract_id },
            select: { provider_id: true },
          });
          if (activeContract?.provider_id === envelopeId) {
            throw this.manualReconciliationRequired(
              processId,
              envelopeId,
              'A compensação encontrou o envelope persistido como contrato ativo.',
              persistenceError,
            );
          }
        }

        const envelope =
          await this.docuSignService.getEnvelopeStatus(envelopeId);
        if (envelope.status === EnvelopeStatus.VOIDED) return;

        const canVoid =
          effectState === 'DRAFT_CONFIRMED'
            ? envelope.status === EnvelopeStatus.CREATED
            : [
                EnvelopeStatus.CREATED,
                EnvelopeStatus.SENT,
                EnvelopeStatus.DELIVERED,
              ].includes(envelope.status);
        if (!canVoid) {
          throw this.manualReconciliationRequired(
            processId,
            envelopeId,
            `Status externo '${envelope.status}' não permite compensação automática segura.`,
            persistenceError,
          );
        }

        await this.docuSignService.voidDraftEnvelope(envelopeId, reason);
      });
    } catch (compensationError) {
      if (this.isManualReconciliationError(compensationError)) {
        throw compensationError;
      }
      this.logger.error(
        'Falha na compensação externa; reconciliação manual necessária',
        {
          processId,
          envelopeId,
          persistenceErrorType:
            persistenceError instanceof Error
              ? persistenceError.name
              : typeof persistenceError,
          compensationErrorType:
            compensationError instanceof Error
              ? compensationError.name
              : typeof compensationError,
        },
      );
      throw this.manualReconciliationRequired(
        processId,
        envelopeId,
        'Falha ao compensar o envelope externo.',
        compensationError,
      );
    }
  }

  private isManualReconciliationError(error: unknown): boolean {
    return (
      error instanceof InternalServerErrorException &&
      (error.getResponse() as any)?.error?.code ===
        'CONTRACT_MANUAL_RECONCILIATION_REQUIRED'
    );
  }

  private manualReconciliationRequired(
    processId: string,
    envelopeId: string | null,
    reason: string,
    cause: unknown,
    operationId?: string,
  ): InternalServerErrorException {
    const correlationId = randomUUID();
    this.logger.error(
      'Falha na compensação externa; reconciliação manual necessária',
      {
        processId,
        envelopeId,
        correlationId,
        reason,
        causeType: cause instanceof Error ? cause.name : typeof cause,
      },
    );
    return new InternalServerErrorException(
      {
        success: false,
        error: {
          code: 'CONTRACT_MANUAL_RECONCILIATION_REQUIRED',
          message:
            'O estado do contrato precisa ser reconciliado antes de uma nova tentativa.',
          details: {
            process_id: processId,
            ...(envelopeId ? { envelope_id: envelopeId } : {}),
            ...(operationId ? { operation_id: operationId } : {}),
            correlation_id: correlationId,
          },
        },
      },
      { cause },
    );
  }

  private contractOperationFailed(
    processId: string,
    envelopeId: string | null,
    cause: unknown,
  ): InternalServerErrorException {
    const correlationId = randomUUID();
    this.logger.error('Falha interna em operação de contrato', {
      processId,
      envelopeId,
      correlationId,
      causeType: cause instanceof Error ? cause.name : typeof cause,
    });
    return new InternalServerErrorException(
      {
        success: false,
        error: {
          code: 'CONTRACT_OPERATION_FAILED',
          message: 'Não foi possível concluir a operação de contrato.',
          details: {
            process_id: processId,
            ...(envelopeId ? { envelope_id: envelopeId } : {}),
            correlation_id: correlationId,
          },
        },
      },
      { cause },
    );
  }

  private previewCompensated(
    processId: string,
    operationId: string,
  ): ConflictException {
    return new ConflictException({
      success: false,
      error: {
        code: 'CONTRACT_PREVIEW_COMPENSATED',
        message:
          'O rascunho externo foi cancelado com segurança. Inicie uma nova tentativa.',
        details: {
          process_id: processId,
          operation_id: operationId,
        },
      },
    });
  }

  private queueContractGeneratedNotification(
    dto: GenerateContractDto | PreviewContractDto,
    contractId: string,
    method: 'generateContract' | 'sendContractAfterPreview',
  ): void {
    setImmediate(() => {
      this.notificationService
        .sendContractGeneratedEmail({
          buyerEmail: dto.buyer_email,
          buyerName: dto.buyer_name,
          sellerEmail: dto.seller_email,
          sellerName: dto.seller_name,
          contractId,
          vehicleDetails: `${dto.vehicle_model} ${dto.vehicle_year}`,
          processId: dto.process_id,
        })
        .catch((err) => {
          this.logger.error('Notification failed (non-critical)', {
            method,
            contractId,
            errorType: err instanceof Error ? err.name : typeof err,
          });
        });
    });
  }

  private assertSellerIndependentFromSpecialist(
    sellerEmail: string,
    specialistEmail?: string,
  ): void {
    if (!specialistEmail) {
      return;
    }

    const normalizedSellerEmail = sellerEmail.trim().toLowerCase();
    const normalizedSpecialistEmail = specialistEmail.trim().toLowerCase();

    if (
      normalizedSellerEmail.length > 0 &&
      normalizedSellerEmail === normalizedSpecialistEmail
    ) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 400,
          message:
            'O e-mail do vendedor deve ser diferente do e-mail do especialista.',
          details: {
            seller_email: sellerEmail,
            specialist_email: specialistEmail,
            hint: 'Preencha os dados do vendedor de forma independente do especialista.',
          },
        },
      });
    }
  }

  /**
   * Pré-preenche dados do formulário de contrato
   *
   * Busca informações do cliente, especialista, produto e proposta aceita
   * para popular o formulário no frontend.
   *
   * @param processId - ID do processo
   * @returns PrefillContractResponseDto com dados pré-preenchidos
   * @throws ProcessNotFoundException - Se processo não existe
   */
  async prefillContract(
    processId: string,
    userId: string,
  ): Promise<PrefillContractResponseDto> {
    this.logger.debug(`Prefill contract data for process: ${processId}`);

    await this.getAuthorizedContractProcess(processId, userId);

    // Buscar processo com todas as relações necessárias
    const processData = await this.prismaService.process.findUnique({
      where: { id: processId },
      include: {
        client: {
          include: { address: true, consultant: true },
        },
        specialist: {
          include: { address: true },
        },
        car: true,
        boat: true,
        aircraft: true,
        accepted_proposal: true,
      },
    });

    if (!processData) {
      this.logger.warn(`Process ${processId} not found for prefill`);
      throw new ProcessNotFoundException(processId);
    }

    const { currency, productValue } = requireNegotiationSnapshot(processData);
    const frozenProductPrice = Number(productValue);

    // Determinar produto baseado no tipo
    let product: {
      id: string;
      brand: string;
      model: string;
      year: number;
      price: number;
      registration_id?: string;
      serial_number?: string;
      technical_info?: string;
    };

    switch (processData.product_type) {
      case ProductType.CAR:
        if (!processData.car) {
          this.logger.warn(
            `Process ${processId} is type CAR but has no car_id associated`,
          );
          throw new NotFoundException({
            message: 'Este processo ainda não tem um veículo associado',
            error: 'PRODUCT_NOT_ASSOCIATED',
            details: {
              process_id: processId,
              product_type: 'CAR',
              hint: 'O especialista precisa selecionar um carro para este processo antes de gerar o contrato',
            },
          });
        }
        product = {
          id: processData.car.id,
          brand: processData.car.marca || '',
          model: processData.car.modelo || '',
          year: processData.car.ano || 0,
          price: frozenProductPrice,
          registration_id: '', // Placa - preenchido pelo especialista
          serial_number: '', // Chassi - preenchido pelo especialista
          technical_info: `${processData.car.cor || ''} - ${processData.car.combustivel || ''} - ${processData.car.km || 0}km`,
        };
        break;

      case ProductType.BOAT:
        if (!processData.boat) {
          this.logger.warn(
            `Process ${processId} is type BOAT but has no boat_id associated`,
          );
          throw new NotFoundException({
            message: 'Este processo ainda não tem uma embarcação associada',
            error: 'PRODUCT_NOT_ASSOCIATED',
            details: {
              process_id: processId,
              product_type: 'BOAT',
              hint: 'O especialista precisa selecionar uma embarcação para este processo antes de gerar o contrato',
            },
          });
        }
        product = {
          id: processData.boat.id,
          brand: processData.boat.marca || '',
          model: processData.boat.modelo || '',
          year: processData.boat.ano || 0,
          price: frozenProductPrice,
          registration_id: '', // Inscrição - preenchido pelo especialista
          serial_number: '', // Hull number - preenchido pelo especialista
          technical_info: `${processData.boat.motor || ''} - ${processData.boat.tamanho || ''}`,
        };
        break;

      case ProductType.AIRCRAFT:
        if (!processData.aircraft) {
          this.logger.warn(
            `Process ${processId} is type AIRCRAFT but has no aircraft_id associated`,
          );
          throw new NotFoundException({
            message: 'Este processo ainda não tem uma aeronave associada',
            error: 'PRODUCT_NOT_ASSOCIATED',
            details: {
              process_id: processId,
              product_type: 'AIRCRAFT',
              hint: 'O especialista precisa selecionar uma aeronave para este processo antes de gerar o contrato',
            },
          });
        }
        product = {
          id: processData.aircraft.id,
          brand: processData.aircraft.marca || '',
          model: processData.aircraft.modelo || '',
          year: processData.aircraft.ano || 0,
          price: frozenProductPrice,
          registration_id: '', // Prefixo - preenchido pelo especialista
          serial_number: '', // Serial number - preenchido pelo especialista
          technical_info: `${processData.aircraft.categoria || ''} - ${processData.aircraft.assentos || 0} assentos`,
        };
        break;

      default:
        throw new InternalServerErrorException(
          `Tipo de produto desconhecido: ${processData.product_type}`,
        );
    }

    // Helper para construir endereço completo
    const buildFullAddress = (
      addr?: {
        street: string;
        number: string;
        neighborhood: string;
        city: string;
        state: string;
      } | null,
    ): string | undefined => {
      if (!addr) return undefined;
      return `${addr.street}, ${addr.number} - ${addr.neighborhood}, ${addr.city} - ${addr.state}`;
    };

    // Buscar dados da empresa da plataforma + calcular comissão
    const platformCompany = await this.platformCompanyService.findOne();
    const {
      platformRate,
      officeRate,
      officeData,
      specialistRate,
      specialistData,
    } = await this.calculateCommissionSplit(
      processData.specialist,
      platformCompany,
      processData.client?.consultant?.company_id ??
        processData.client?.company_id ??
        null,
    );

    this.logger.debug(
      `Prefill data loaded successfully for process ${processId}`,
    );

    // Os valores dependem da comissão total que o especialista ainda vai
    // digitar no formulário. As taxas são fatias do bolo, não % da venda —
    // então o prefill não sugere valores.
    const platformValue = 0;
    const officeValue = 0;
    const specialistValue = 0;

    return {
      process_id: processData.id,
      product_type: processData.product_type,
      currency,
      buyer: {
        id: processData.client.id,
        name: `${processData.client.name || ''} ${processData.client.surname || ''}`.trim(),
        email: processData.client.email,
        cpf: processData.client.cpf || undefined,
        rg: processData.client.rg || undefined,
        address: buildFullAddress(processData.client.address),
        cep: processData.client.address?.cep || undefined,
      },
      seller: {
        id: 'MANUAL_SELLER',
        name: '',
        email: '',
      },
      product,
      proposal: processData.accepted_proposal
        ? {
            id: processData.accepted_proposal.id,
            value: Number(processData.accepted_proposal.proposed_value),
          }
        : undefined,
      platform: platformCompany
        ? {
            name: platformCompany.name,
            cnpj: platformCompany.cnpj,
            bank: platformCompany.bank,
            agency: platformCompany.agency,
            checking_account: platformCompany.checking_account,
            rate: platformRate,
            value: Math.round(platformValue * 100) / 100,
          }
        : undefined,
      office: officeData
        ? {
            name: officeData.name,
            cnpj: officeData.cnpj,
            bank: officeData.bank || undefined,
            agency: officeData.agency || undefined,
            checking_account: officeData.checking_account || undefined,
            rate: officeRate,
            value: Math.round(officeValue * 100) / 100,
          }
        : undefined,
      specialist: specialistData
        ? {
            id: specialistData.id,
            name: specialistData.name,
            email: specialistData.email || undefined,
            cnpj: specialistData.cnpj || undefined,
            bank: specialistData.bank || undefined,
            agency: specialistData.agency || undefined,
            checking_account: specialistData.checking_account || undefined,
            rate: specialistRate,
            value: Math.round(specialistValue * 100) / 100,
          }
        : undefined,
      suggested_total_rate: 0,
    };
  }

  /**
   * Calcula as taxas de comissão da plataforma, escritório e especialista separadamente
   *
   * Taxas de comissão:
   * - Plataforma: usa company.platform_commission_rate quando o escritório tem uma taxa
   *   própria configurada; senão cai no default_commission_rate da PlatformCompany
   * - Escritório: usa company.commission_rate (se especialista tiver empresa)
   * - Especialista: usa specialist.commission_rate (taxa individual do especialista)
   *
   * @returns { platformRate, officeRate, officeData, specialistRate, specialistData }
   */
  private async calculateCommissionSplit(
    specialist: {
      id?: string;
      name?: string;
      surname?: string;
      email?: string;
      cpf?: string | null;
      company_id?: string | null;
      commission_rate?: any;
      bank?: string | null;
      agency?: string | null;
      checking_account?: string | null;
    },
    platformCompany: { default_commission_rate: number } | null,
    // Escritório da venda = empresa do CONSULTOR do cliente (não do especialista).
    officeCompanyId: string | null,
    client: PrismaService | Prisma.TransactionClient = this.prismaService,
  ): Promise<{
    platformRate: number;
    officeRate: number;
    officeData: {
      name: string;
      cnpj: string;
      bank?: string | null;
      agency?: string | null;
      checking_account?: string | null;
    } | null;
    specialistRate: number;
    specialistData: {
      id: string;
      name: string;
      email?: string | null;
      cnpj?: string | null;
      bank?: string | null;
      agency?: string | null;
      checking_account?: string | null;
    } | null;
  }> {
    // Taxa da plataforma: padrão global da PlatformCompany, sobreposta pela
    // taxa própria do escritório (Company.platform_commission_rate) quando definida
    let platformRate = platformCompany?.default_commission_rate ?? 0;

    // Taxa do escritório: vem da empresa do consultor do cliente
    let officeRate = 0;
    let officeData: {
      name: string;
      cnpj: string;
      bank?: string | null;
      agency?: string | null;
      checking_account?: string | null;
    } | null = null;

    // Taxa do especialista: taxa individual do especialista
    const specialistRate = specialist.commission_rate
      ? Number(specialist.commission_rate)
      : 0;

    // Dados do especialista para comissão
    const specialistData = specialist.id
      ? {
          id: specialist.id,
          name: `${specialist.name || ''} ${specialist.surname || ''}`.trim(),
          email: specialist.email,
          cnpj: specialist.cpf,
          bank: specialist.bank,
          agency: specialist.agency,
          checking_account: specialist.checking_account,
        }
      : null;

    // 1. Escritório da venda: empresa do consultor do cliente (se houver).
    if (officeCompanyId) {
      const company = await client.company.findUnique({
        where: { id: officeCompanyId },
      });
      if (company) {
        officeData = {
          name: company.name,
          cnpj: company.cnpj,
          bank: company.bank,
          agency: company.agency,
          checking_account: company.checking_account,
        };
        officeRate = company.commission_rate
          ? Number(company.commission_rate)
          : 0;
        if (company.platform_commission_rate != null) {
          platformRate = Number(company.platform_commission_rate);
        }
      }
    }

    return {
      platformRate,
      officeRate,
      officeData,
      specialistRate,
      specialistData,
    };
  }

  /**
   * Deriva o split de comissão a partir do total informado pelo especialista.
   *
   * Único valor editável é `totalCommissionRate` (comissão total da venda, em %).
   * A comissão total vira o bolo; o especialista recebe a sua fatia dele. A
   * taxa cadastrada do escritório incide sobre a própria comissão total, e a
   * plataforma recebe o resíduo. Nenhum valor de repartição recebido do
   * cliente é aceito.
   *
   * @throws BadRequestException se o processo não tiver valor de referência
   * (proposta aceita ou produto)
   */
  private async resolveCommissionFromTotal(
    processId: string,
    totalCommissionRate: number,
    client: PrismaService | Prisma.TransactionClient = this.prismaService,
  ): Promise<{
    platformRate: number;
    officeRate: number;
    specialistRate: number;
    platformValue: number;
    officeValue: number;
    specialistValue: number;
  }> {
    const process = await client.process.findUnique({
      where: { id: processId },
      include: {
        specialist: true,
        client: { include: { consultant: true } },
        car: true,
        boat: true,
        aircraft: true,
        accepted_proposal: true,
      },
    });

    if (!process) {
      throw new ProcessNotFoundException(processId);
    }

    const { productValue: snapshotValue } = requireNegotiationSnapshot(process);

    const platformCompany = await this.platformCompanyService.findOne(client);
    // specialistRate e officeRate são fatias independentes do BOLO. A
    // plataforma é derivada do saldo após as duas fatias.
    const { officeRate, specialistRate: specialistShareRate } =
      await this.calculateCommissionSplit(
        process.specialist,
        platformCompany,
        process.client?.consultant?.company_id ??
          process.client?.company_id ??
          null,
        client,
      );

    const round2 = (n: number) => Math.round(n * 100) / 100;

    const proposalValue = process.accepted_proposal
      ? Number(process.accepted_proposal.proposed_value)
      : Number(snapshotValue);

    if (proposalValue <= 0) {
      throw new BadRequestException(
        'Processo sem proposta aceita e sem produto associado — não é possível calcular a comissão.',
      );
    }

    // Os demais campos do contrato são opcionais, mas a taxa não pode ser:
    // undefined/NaN aqui propaga NaN para platform/office/specialist value e
    // esses valores são gravados no banco. Falhar aqui é o mal menor.
    if (!Number.isFinite(totalCommissionRate)) {
      throw new BadRequestException(
        'total_commission_rate ausente ou inválido — não é possível calcular a comissão.',
      );
    }

    if (specialistShareRate + officeRate > 100) {
      throw new BadRequestException(
        'A soma das taxas do especialista e do escritório não pode ultrapassar 100% da comissão total.',
      );
    }

    // Split sobre a comissão total — ver commission-split.ts. Soma exata por construção.
    const split = computeNestedCommissionSplit({
      proposalValue,
      totalCommissionRate,
      specialistShareRate,
      officeShareRate: officeRate,
    });

    // Taxas efetivas sobre a venda (para o documento do contrato).
    const effectiveRate = (value: number) =>
      proposalValue > 0 ? round2((value / proposalValue) * 100) : 0;

    return {
      platformRate: effectiveRate(split.platformValue),
      officeRate: effectiveRate(split.officeValue),
      specialistRate: effectiveRate(split.specialistValue),
      platformValue: split.platformValue,
      officeValue: split.officeValue,
      specialistValue: split.specialistValue,
    };
  }

  /**
   * Gera um contrato via formulário e envia para DocuSign
   *
   * Fluxo:
   * 1. Validar processo existe e está no status correto
   * 2. Validar que não existe contrato ativo
   * 3. Validar que buyer email existe no sistema
   * 4. Formatar todos os campos para exibição no contrato
   * 5. Criar envelope via template DocuSign
   * 6. Salvar contrato no banco em transação atômica
   *
   * @param dto - Dados do formulário de contrato
   * @param userId - ID do usuário que está criando
   * @returns ContractResponse com dados do contrato criado
   */
  async generateContract(
    dto: GenerateContractDto,
    userId: string,
  ): Promise<ContractResponse> {
    let externalEffect: ExternalEnvelopeEffect | null = null;
    let transactionCallbackCompleted = false;
    try {
      const result = await this.withContractProcessLock(
        dto.process_id,
        async (tx) => {
          const contract = await this.generateContractLocked(
            dto,
            userId,
            tx,
            (envelopeId, state) => {
              externalEffect = { envelopeId, state };
            },
          );
          transactionCallbackCompleted = true;
          return contract;
        },
      );
      externalEffect = null;
      this.queueContractGeneratedNotification(
        dto,
        result.id,
        'generateContract',
      );
      return result;
    } catch (error) {
      if (error instanceof EnvelopeEffectError) {
        externalEffect = {
          envelopeId: error.envelopeId,
          state: error.effectState,
          providerStatus: error.providerStatus as EnvelopeStatus | undefined,
        };
      }
      if (error instanceof EnvelopeCreationAmbiguousError) {
        throw this.manualReconciliationRequired(
          dto.process_id,
          null,
          'A criação externa não pôde ser confirmada pelo transactionId.',
          error,
          error.transactionId,
        );
      }
      if (this.isManualReconciliationError(error)) throw error;
      if (error instanceof ContractAlreadyExistsException) throw error;
      if (externalEffect) {
        if (
          transactionCallbackCompleted ||
          externalEffect.state !== 'DRAFT_CONFIRMED'
        ) {
          throw this.manualReconciliationRequired(
            dto.process_id,
            externalEffect.envelopeId,
            transactionCallbackCompleted
              ? 'A confirmação do commit falhou depois que a transação concluiu.'
              : 'O provedor não confirmou se o envelope foi enviado.',
            error,
          );
        }
        await this.compensateExternalEnvelope(
          externalEffect.envelopeId,
          dto.process_id,
          'Falha ao persistir a geração do contrato',
          error,
          externalEffect.state,
        );
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string' &&
        error.code.startsWith('P')
      ) {
        throw this.contractOperationFailed(dto.process_id, null, error);
      }
      throw error;
    }
  }

  private async generateContractLocked(
    dto: GenerateContractDto,
    userId: string,
    tx: Prisma.TransactionClient,
    registerExternalEnvelope: (
      envelopeId: string,
      state: EnvelopeEffectState,
      providerStatus?: EnvelopeStatus,
    ) => void,
  ): Promise<ContractResponse> {
    try {
      this.logger.log(`=== INICIANDO GERAÇÃO DE CONTRATO ===`);
      this.logger.log(`Usuário: ${userId}`);
      this.logger.log(`Process: ${dto.process_id}`);

      // ===== ETAPA 1: VALIDAÇÕES DE INTEGRIDADE =====
      this.logger.log('Etapa 1: Validando integridade de negócio...');

      // 1.1 Verificar se processo existe
      const processRecord = await this.getAuthorizedContractProcess(
        dto.process_id,
        userId,
        tx,
      );

      if (!processRecord) {
        this.logger.warn(`Processo ${dto.process_id} não encontrado`);
        throw new ProcessNotFoundException(dto.process_id);
      }

      // 1.2 Validar status do processo
      this.assertProcessCanPrepareContract(
        dto.process_id,
        processRecord.status,
      );

      // 1.3 Verificar se já existe contrato ativo
      if (processRecord.active_contract_id) {
        const activeContract = await tx.contract.findUnique({
          where: { id: processRecord.active_contract_id },
          select: { id: true, provider_status: true },
        });

        if (
          activeContract &&
          !['DECLINED', 'VOIDED', 'TIMEDOUT'].includes(
            activeContract.provider_status || '',
          )
        ) {
          this.logger.warn(
            `Processo ${dto.process_id} já possui contrato ativo: ${activeContract.id}`,
          );
          throw new ContractAlreadyExistsException(dto.process_id);
        }
      }

      // 1.4 Verificar se buyer existe no sistema (apenas em produção)
      const buyerUser = await tx.user.findUnique({
        where: { email: dto.buyer_email },
        select: { id: true, email: true, name: true, surname: true },
      });

      // Em desenvolvimento, permitir emails externos para testes
      const isDevelopment = globalThis.process.env.NODE_ENV !== 'production';

      if (!buyerUser && !isDevelopment) {
        this.logger.warn(`Buyer do processo ${dto.process_id} não encontrado`);
        throw new SignerNotFoundException(dto.buyer_email);
      }

      if (!buyerUser && isDevelopment) {
        this.logger.warn(
          `[DEV MODE] Buyer do processo ${dto.process_id} não encontrado no sistema, mas permitido em desenvolvimento`,
        );
      }

      // 1.5 Garantir que vendedor seja independente do especialista
      this.assertSellerIndependentFromSpecialist(
        dto.seller_email,
        dto.specialist_email,
      );

      // 1.6 Buscar dados do usuário que está criando
      const uploaderUser = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          surname: true,
          role: true,
        },
      });

      if (!uploaderUser) {
        throw new InternalServerErrorException(
          'Usuário criador não encontrado',
        );
      }

      this.logger.log('✓ Validações de integridade passaram');

      // Trava plataforma/escritório e deriva o corte do especialista a partir
      // do total — nunca confia nos campos de comissão vindos do DTO.
      const commission = await this.resolveCommissionFromTotal(
        dto.process_id,
        dto.total_commission_rate,
        tx,
      );
      const dtoWithCommission: GenerateContractDto = {
        ...dto,
        platform_value: commission.platformValue,
        platform_percentage: commission.platformRate,
        office_value: commission.officeValue,
        specialist_value: commission.specialistValue,
      };

      // ===== ETAPA 2: FORMATAR DADOS PARA DOCUSIGN =====
      this.logger.log('Etapa 2: Formatando dados para DocuSign...');

      const formFields = this.buildFormFields(
        dtoWithCommission,
        processRecord.product_type,
      );

      this.logger.debug(
        `Form fields preparados: ${Object.keys(formFields).length} campos`,
      );

      // ===== ETAPA 3: CRIAR ENVELOPE NO DOCUSIGN =====
      this.logger.log('Etapa 3: Criando envelope no DocuSign via template...');

      const templateId =
        dto.template_id || globalThis.process.env.DOCUSIGN_TEMPLATE_ID;
      if (!templateId) {
        throw new InternalServerErrorException(
          'Nenhum template informado e DOCUSIGN_TEMPLATE_ID não configurado',
        );
      }

      const envelopeResponse =
        await this.docuSignService.createEnvelopeFromTemplate({
          transactionId: dto.operation_id,
          templateId,
          buyerEmail: dto.buyer_email,
          buyerName: dto.buyer_name,
          sellerEmail: dto.seller_email,
          sellerName: dto.seller_name,
          specialistEmail: dto.specialist_email,
          specialistName: dto.specialist_name,
          formFields,
          processId: dto.process_id,
          testimonial1Name: dto.testimonial1_name,
          testimonial1Email: dto.testimonial1_email,
          testimonial2Name: dto.testimonial2_name,
          testimonial2Email: dto.testimonial2_email,
          onEnvelopeCreated: (envelopeId) =>
            registerExternalEnvelope(envelopeId, 'DRAFT_CONFIRMED'),
        });
      registerExternalEnvelope(
        envelopeResponse.envelopeId,
        'SEND_CONFIRMED',
        envelopeResponse.status,
      );

      this.logger.log(
        `✓ Envelope criado (ID: ${envelopeResponse.envelopeId}, Status: ${envelopeResponse.status})`,
      );

      // ===== ETAPA 4: SALVAR NO BANCO EM TRANSAÇÃO =====
      this.logger.log(
        'Etapa 4: Salvando contrato no banco em transação atômica...',
      );

      // A mesma transação que possui o advisory lock faz as leituras e escritas.
      const cleanDocs = stripContractDocumentFields(dto);
      const contract = await tx.contract.create({
        data: {
          process_id: dto.process_id,
          description: dto.description || '',

          // Provider (DocuSign)
          provider_name: 'DOCUSIGN',
          provider_id: envelopeResponse.envelopeId,
          provider_status: mapDocusignStatusToProviderStatus(
            envelopeResponse.status,
          ),
          provider_meta: {
            sentAt: new Date().toISOString(),
            originalStatus: envelopeResponse.status,
            templateId: templateId,
          } as any,

          // Dados do vendedor
          seller_name: dto.seller_name,
          seller_cpf: cleanDocs.seller_cpf,
          seller_rg: cleanDocs.seller_rg,
          seller_address: dto.seller_address ?? '',
          seller_cep: cleanDocs.seller_cep,
          seller_bank: dto.seller_bank ?? '',
          seller_agency: dto.seller_agency ?? '',
          seller_checking_account: dto.seller_checking_account ?? '',

          // Dados do comprador
          buyer_name: dto.buyer_name,
          buyer_cpf: cleanDocs.buyer_cpf,
          buyer_rg: cleanDocs.buyer_rg,
          buyer_address: dto.buyer_address ?? '',
          buyer_cep: cleanDocs.buyer_cep,

          // Dados do veículo
          vehicle_model: dto.vehicle_model ?? '',
          vehicle_year: dto.vehicle_year ?? '',
          vehicle_registration_id: dto.vehicle_registration_id ?? '',
          vehicle_serial_number: dto.vehicle_serial_number ?? '',
          vehicle_technical_information: dto.vehicle_technical_info,
          vehicle_price: dto.vehicle_price,
          vehicle_price_written: numberToWords(dto.vehicle_price),

          // Pagamento ao vendedor
          payment_seller_value: dto.payment_seller_value,
          payment_seller_value_written: numberToWords(dto.payment_seller_value),

          // Dados da Plataforma (Split 1) — taxa travada, calculada no backend
          platform_value: commission.platformValue,
          platform_value_written: numberToWords(commission.platformValue),
          platform_percentage: commission.platformRate,
          platform_name: dto.platform_name,
          platform_cnpj: cleanDocs.platform_cnpj,
          platform_bank: dto.platform_bank,
          platform_agency: dto.platform_agency,
          platform_checking_account: dto.platform_checking_account,

          // Dados do Escritório (Split 2) — taxa travada, calculada no backend
          office_value: commission.officeValue,
          office_value_written: numberToWords(commission.officeValue),
          office_name: dto.office_name,
          office_cnpj: cleanDocs.office_cnpj,
          office_bank: dto.office_bank || null,
          office_agency: dto.office_agency || null,
          office_checking_account: dto.office_checking_account || null,

          // Dados do Especialista (Split 3) — resíduo do total informado
          specialist_commission_value: commission.specialistValue,
          specialist_commission_rate: commission.specialistRate,
          specialist_commission_value_written: numberToWords(
            commission.specialistValue,
          ),
          specialist_name: dto.specialist_name,
          specialist_document: cleanDocs.specialist_document,
          specialist_bank: dto.specialist_bank || null,
          specialist_agency: dto.specialist_agency || null,
          specialist_checking_account: dto.specialist_checking_account || null,

          // Testemunhas (opcionais)
          testimonial1_cpf: cleanDocs.testimonial1_cpf || null,
          testimonial1_email: dto.testimonial1_email || null,
          testimonial2_cpf: cleanDocs.testimonial2_cpf || null,
          testimonial2_email: dto.testimonial2_email || null,

          // Cidade
          city: dto.city ?? '',

          // Template usado
          template_id: templateId,

          // Status synchronized with the provider response. A webhook may have
          // arrived before local persistence.
          status:
            envelopeResponse.status === EnvelopeStatus.COMPLETED
              ? 'SIGNED'
              : 'PENDING',
          ...(envelopeResponse.status === EnvelopeStatus.COMPLETED
            ? { signed_at: new Date() }
            : {}),
          signature_type: 'SIMPLE',

          // Quem criou
          uploaded_by_id: userId,
          uploaded_by_type: uploaderUser.role,

          // Quem vai assinar (null em dev se buyer externo)
          signed_by_id: buyerUser?.id ?? null,

          created_at: new Date(),
        },
      });

      // 4.2 Atualizar processo
      const processClaim = await tx.process.updateMany({
        where: {
          id: dto.process_id,
          status: processRecord.status,
          active_contract_id: processRecord.active_contract_id,
        },
        data: {
          active_contract_id: contract.id,
          status:
            envelopeResponse.status === EnvelopeStatus.COMPLETED
              ? ProcessStatus.COMPLETED
              : ProcessStatus.DOCUMENTATION,
        },
      });
      if (processClaim.count !== 1) {
        throw new ConflictException(
          'O processo mudou durante a geração do contrato.',
        );
      }
      if (envelopeResponse.status === EnvelopeStatus.COMPLETED) {
        await tx.processStatusHistory.create({
          data: {
            processId: dto.process_id,
            status: ProcessStatus.COMPLETED,
            reason: 'CONTRACT_SIGNED',
            changed_at: new Date(),
          },
        });
      }

      this.logger.log(
        `✓ Contrato definido como ativo no processo ${dto.process_id}`,
      );
      this.logger.log(
        `✓ Processo sincronizado com o status ${envelopeResponse.status}`,
      );

      const createdContract = contract;
      this.logger.log(
        `✓ Contrato criado no banco com ID: ${createdContract.id}`,
      );
      this.logger.log(`=== GERAÇÃO DE CONTRATO CONCLUÍDA COM SUCESSO ===`);

      // ===== RETORNAR RESPOSTA =====
      return {
        id: createdContract.id,
        file_name: `contract-${createdContract.id}.pdf`,
        file_type: 'application/pdf',
        file_size: 0,
        description: createdContract.description,
        process_id: createdContract.process_id,
        uploaded_by: {
          id: createdContract.uploaded_by_id,
          name: dto.seller_name,
          type: createdContract.uploaded_by_type,
        },
        created_at: createdContract.created_at,
        status: createdContract.status,
        provider_status: createdContract.provider_status ?? null,
        signed_at: createdContract.signed_at ?? null,
        signed_by: null,
      };
    } catch (error) {
      // ===== TRATAMENTO DE ERROS =====
      if (
        error instanceof EnvelopeEffectError ||
        error instanceof EnvelopeCreationAmbiguousError
      ) {
        throw error;
      }
      if (error instanceof HttpException) {
        throw error;
      }

      if (
        error instanceof ProcessNotFoundException ||
        error instanceof SignerNotFoundException ||
        error instanceof ContractAlreadyExistsException
      ) {
        this.logger.error('Erro esperado na geração de contrato');
        throw error;
      }

      if (
        error.message?.includes('DocuSign') ||
        error.status === 502 ||
        error.status === 504
      ) {
        this.logger.error('Erro do DocuSign na geração de contrato');
        throw error;
      }

      if (error.code && error.code.startsWith('P')) {
        this.logger.error(`Erro de transação Prisma [${error.code}]`);
        throw this.contractOperationFailed(dto.process_id, null, error);
      }

      this.logger.error('Erro inesperado na geração de contrato');
      throw this.contractOperationFailed(dto.process_id, null, error);
    }
  }

  /**
   * Constrói os campos formatados para enviar ao DocuSign
   *
   * IMPORTANTE: Os labels devem corresponder EXATAMENTE aos definidos no template,
   * incluindo erros de digitação como "techinical".
   */
  private buildFormFields(
    dto: GenerateContractDto,
    productType: ProductType | null,
  ): Record<string, string> {
    const fields: Record<string, string> = {
      // Vendedor
      seller_name: dto.seller_name,
      seller_cpf: formatCpf(dto.seller_cpf),
      seller_rg: dto.seller_rg ? formatRg(dto.seller_rg) : '',
      seller_address: dto.seller_address ?? '',
      seller_cep: formatCep(dto.seller_cep),
      seller_bank: dto.seller_bank ?? '',
      seller_agency: dto.seller_agency ?? '',
      seller_checking_account: dto.seller_checking_account ?? '',

      // Comprador
      buyer_name: dto.buyer_name,
      buyer_cpf: formatCpf(dto.buyer_cpf),
      buyer_rg: dto.buyer_rg ? formatRg(dto.buyer_rg) : '',
      buyer_address: dto.buyer_address ?? '',
      buyer_cep: formatCep(dto.buyer_cep),

      // Veículo
      vehicle_model: dto.vehicle_model ?? '',
      vehicle_year: dto.vehicle_year ?? '',
      vehicle_registration_id: dto.vehicle_registration_id ?? '',
      vehicle_serial_number: dto.vehicle_serial_number ?? '',
      // ATENÇÃO: typo no template - "techinical" com 'i' antes de 'n'
      vehicle_techinical_information: dto.vehicle_technical_info || '',
      vehicle_price: formatBRL(dto.vehicle_price),
      vehicle_price_written: numberToWords(dto.vehicle_price),

      // Pagamento ao vendedor
      payment_seller_value: formatBRL(dto.payment_seller_value),
      payment_seller_value_written: numberToWords(dto.payment_seller_value),

      // === Campos do template ANTIGO (compatibilidade) — comissão zerada no contrato ===
      // ponytail: comissão zerada só no payload DocuSign; DB/cálculo intactos (resolveCommissionFromTotal segue igual)
      commission_value: formatBRL(0),
      // ATENÇÃO: typo no template antigo - "commision" com apenas 1 'm'
      commision_value_written: numberToWords(0),
      commission_name: dto.platform_name || '',
      // ATENÇÃO: typo no template antigo - "commision_cpf" com apenas 1 'm'
      commision_cpf: formatCnpj(dto.platform_cnpj || ''),
      commission_bank: dto.platform_bank || '',
      commission_agency: dto.platform_agency || '',
      commission_checking_account: dto.platform_checking_account || '',

      // === Campos do template NOVO (split 3 vias) — valores de comissão zerados; dados das partes mantidos ===
      // Dados da Plataforma (Split 1)
      // ponytail: dados da plataforma são opcionais — nem todo ambiente tem
      // banco/agência/conta cadastrados; sem eles vai vazio, nunca bloqueia o envio
      platform_value: formatBRL(0),
      platform_value_written: numberToWords(0),
      platform_percentage: '0',
      platform_name: dto.platform_name || '',
      platform_cnpj: formatCnpj(dto.platform_cnpj || ''),
      platform_bank: dto.platform_bank || '',
      platform_agency: dto.platform_agency || '',
      platform_checking_account: dto.platform_checking_account || '',

      // Dados do Escritório (Split 2)
      commission_office_value: formatBRL(0),
      commission_office_written: numberToWords(0),
      office_name: dto.office_name || '',
      office_cnpj: formatCnpj(dto.office_cnpj || ''),
      office_bank: dto.office_bank || '',
      office_agency: dto.office_agency || '',
      office_checking_account: dto.office_checking_account || '',

      // Dados do Especialista (Split 3)
      specialist_value: formatBRL(0),
      specialist_value_written: numberToWords(0),
      specialist_bank: dto.specialist_bank || '',
      specialist_agency: dto.specialist_agency || '',
      specialist_checking_account: dto.specialist_checking_account || '',
      // NOTE: variável do template usa nome em português/inglês misturado
      especialista_name: dto.specialist_name || '',
      specialist_document: formatDocument(dto.specialist_document || ''),

      // Testemunhas (opcionais)
      testimonial1_cpf: dto.testimonial1_cpf
        ? formatCpf(dto.testimonial1_cpf)
        : '',
      testimonial2_cpf: dto.testimonial2_cpf
        ? formatCpf(dto.testimonial2_cpf)
        : '',

      // Cidade
      city: dto.city ?? '',
    };

    this.logger.debug(`Form fields built for product type ${productType}`);

    return fields;
  }

  /**
   * Cria um preview do contrato via DocuSign Sender View
   *
   * Este método cria um envelope em modo DRAFT e gera uma URL de preview
   * que pode ser incorporada em um iframe. O usuário pode visualizar e
   * editar o contrato antes de confirmar o envio.
   *
   * Fluxo:
   * 1. Validar integridade de negócio (processo, status, permissões)
   * 2. Formatar dados para DocuSign
   * 3. Criar envelope DRAFT e obter URL do Sender View
   * 4. Retornar URL + envelopeId para uso posterior
   *
   * A URL expira em 10 minutos.
   *
   * @param dto - Dados do contrato para preview
   * @param userId - ID do usuário que está criando o preview
   * @returns PreviewContractResponseDto
   */
  async previewContract(
    dto: PreviewContractDto,
    userId: string,
  ): Promise<PreviewContractResponseDto> {
    let externalEffect: ExternalEnvelopeEffect | null = null;
    try {
      return await this.withContractProcessLock(dto.process_id, (tx) =>
        this.previewContractLocked(dto, userId, tx, (envelopeId) => {
          externalEffect = { envelopeId, state: 'DRAFT_CONFIRMED' };
        }),
      );
    } catch (error) {
      if (error instanceof EnvelopeEffectError) {
        externalEffect = {
          envelopeId: error.envelopeId,
          state: error.effectState,
          providerStatus: error.providerStatus as EnvelopeStatus | undefined,
        };
      }
      if (error instanceof EnvelopeCreationAmbiguousError) {
        throw this.manualReconciliationRequired(
          dto.process_id,
          null,
          'A criação externa não pôde ser confirmada pelo transactionId.',
          error,
          error.transactionId,
        );
      }
      if (this.isManualReconciliationError(error)) throw error;
      if (error instanceof ContractAlreadyExistsException) throw error;
      if (externalEffect) {
        if (externalEffect.state !== 'DRAFT_CONFIRMED') {
          throw this.manualReconciliationRequired(
            dto.process_id,
            externalEffect.envelopeId,
            'O estado do preview externo é indeterminado.',
            error,
          );
        }
        await this.compensateExternalEnvelope(
          externalEffect.envelopeId,
          dto.process_id,
          'Falha ao preparar o preview do contrato',
          error,
          'DRAFT_CONFIRMED',
        );
        throw this.previewCompensated(dto.process_id, dto.operation_id);
      }
      throw error;
    }
  }

  private async previewContractLocked(
    dto: PreviewContractDto,
    userId: string,
    tx: Prisma.TransactionClient,
    registerExternalEnvelope: (envelopeId: string) => void,
  ): Promise<PreviewContractResponseDto> {
    try {
      this.logger.log(`=== INICIANDO PREVIEW DE CONTRATO ===`);
      this.logger.log(`Usuário: ${userId}`);
      this.logger.log(`Process: ${dto.process_id}`);

      // ===== ETAPA 1: VALIDAÇÕES DE INTEGRIDADE =====
      this.logger.log('Preview Etapa 1: Validando integridade de negócio...');

      // 1.1 Verificar se processo existe
      const processRecord = await this.getAuthorizedContractProcess(
        dto.process_id,
        userId,
        tx,
      );

      if (!processRecord) {
        this.logger.warn(`Processo ${dto.process_id} não encontrado`);
        throw new ProcessNotFoundException(dto.process_id);
      }

      this.assertSellerIndependentFromSpecialist(
        dto.seller_email,
        dto.specialist_email,
      );

      // 1.2 Validar status do processo
      this.assertProcessCanPrepareContract(
        dto.process_id,
        processRecord.status,
      );

      // 1.3 Verificar se já existe contrato ativo
      if (processRecord.active_contract_id) {
        const activeContract = await tx.contract.findUnique({
          where: { id: processRecord.active_contract_id },
          select: { id: true, provider_status: true },
        });

        if (
          activeContract &&
          !['DECLINED', 'VOIDED', 'TIMEDOUT'].includes(
            activeContract.provider_status || '',
          )
        ) {
          this.logger.warn(
            `Processo ${dto.process_id} já possui contrato ativo: ${activeContract.id}`,
          );
          throw new ContractAlreadyExistsException(dto.process_id);
        }
      }

      this.logger.log('✓ Validações de integridade passaram');

      // 1.4 Travar plataforma/escritório e derivar o corte do especialista a partir do total
      const commission = await this.resolveCommissionFromTotal(
        dto.process_id,
        dto.total_commission_rate,
        tx,
      );

      // ===== ETAPA 2: FORMATAR DADOS PARA DOCUSIGN =====
      this.logger.log('Preview Etapa 2: Formatando dados para DocuSign...');

      // Reutilizar buildFormFields criando DTO compatível
      const generateDto: GenerateContractDto = {
        operation_id: dto.operation_id,
        process_id: dto.process_id,
        total_commission_rate: dto.total_commission_rate,
        seller_name: dto.seller_name,
        seller_email: dto.seller_email,
        seller_cpf: dto.seller_cpf,
        seller_rg: dto.seller_rg,
        seller_address: dto.seller_address ?? '',
        seller_cep: dto.seller_cep,
        seller_bank: dto.seller_bank ?? '',
        seller_agency: dto.seller_agency ?? '',
        seller_checking_account: dto.seller_checking_account ?? '',
        buyer_name: dto.buyer_name,
        buyer_email: dto.buyer_email,
        buyer_cpf: dto.buyer_cpf,
        buyer_rg: dto.buyer_rg,
        buyer_address: dto.buyer_address ?? '',
        buyer_cep: dto.buyer_cep,
        vehicle_model: dto.vehicle_model ?? '',
        vehicle_year: dto.vehicle_year ?? '',
        vehicle_registration_id: dto.vehicle_registration_id ?? '',
        vehicle_serial_number: dto.vehicle_serial_number ?? '',
        vehicle_technical_info: dto.vehicle_technical_info,
        vehicle_price: dto.vehicle_price,
        payment_seller_value: dto.payment_seller_value,
        platform_value: commission.platformValue,
        platform_percentage: commission.platformRate,
        platform_name: dto.platform_name,
        platform_cnpj: dto.platform_cnpj,
        platform_bank: dto.platform_bank,
        platform_agency: dto.platform_agency,
        platform_checking_account: dto.platform_checking_account,
        office_value: commission.officeValue,
        office_name: dto.office_name,
        office_cnpj: dto.office_cnpj,
        office_bank: dto.office_bank,
        office_agency: dto.office_agency,
        office_checking_account: dto.office_checking_account,
        specialist_value: commission.specialistValue,
        specialist_name: dto.specialist_name,
        specialist_email: dto.specialist_email,
        specialist_document: dto.specialist_document,
        specialist_bank: dto.specialist_bank,
        specialist_agency: dto.specialist_agency,
        specialist_checking_account: dto.specialist_checking_account,
        testimonial1_cpf: dto.testimonial1_cpf,
        testimonial1_email: dto.testimonial1_email,
        testimonial2_cpf: dto.testimonial2_cpf,
        testimonial2_email: dto.testimonial2_email,
        city: dto.city ?? '',
        description: dto.description,
      };

      const formFields = this.buildFormFields(
        generateDto,
        processRecord.product_type,
      );

      this.logger.debug(
        `Form fields preparados: ${Object.keys(formFields).length} campos`,
      );

      // ===== ETAPA 3: CRIAR PREVIEW NO DOCUSIGN =====
      this.logger.log('Preview Etapa 3: Criando preview no DocuSign...');

      const templateId =
        dto.template_id || globalThis.process.env.DOCUSIGN_TEMPLATE_ID;
      if (!templateId) {
        throw new InternalServerErrorException(
          'Nenhum template informado e DOCUSIGN_TEMPLATE_ID não configurado',
        );
      }

      const previewResponse = await this.docuSignService.createEnvelopePreview({
        transactionId: dto.operation_id,
        templateId,
        buyerEmail: dto.buyer_email,
        buyerName: dto.buyer_name,
        sellerEmail: dto.seller_email,
        sellerName: dto.seller_name,
        specialistEmail: dto.specialist_email,
        specialistName: dto.specialist_name,
        formFields,
        processId: dto.process_id,
        returnUrl: dto.return_url,
        testimonial1Name: dto.testimonial1_name,
        testimonial1Email: dto.testimonial1_email,
        testimonial2Name: dto.testimonial2_name,
        testimonial2Email: dto.testimonial2_email,
        onEnvelopeCreated: registerExternalEnvelope,
      });

      this.logger.log(
        `✓ Preview criado (EnvelopeID: ${previewResponse.envelopeId})`,
      );
      this.logger.log(`=== PREVIEW CONCLUÍDO COM SUCESSO ===`);

      return {
        preview_url: previewResponse.previewUrl,
        envelope_id: previewResponse.envelopeId,
        expires_at: previewResponse.expiresAt,
        process_id: dto.process_id,
      };
    } catch (error) {
      if (
        error instanceof EnvelopeEffectError ||
        error instanceof EnvelopeCreationAmbiguousError
      ) {
        throw error;
      }
      if (error instanceof HttpException) {
        throw error;
      }

      if (
        error instanceof ProcessNotFoundException ||
        error instanceof ContractAlreadyExistsException
      ) {
        throw error;
      }

      if (
        error.message?.includes('DocuSign') ||
        error.status === 502 ||
        error.status === 504
      ) {
        this.logger.error('Erro do DocuSign no preview');
        throw error;
      }

      this.logger.error('Erro inesperado no preview');
      throw this.contractOperationFailed(dto.process_id, null, error);
    }
  }

  /**
   * Envia o contrato após preview e salva no banco de dados
   *
   * Este método é chamado após o usuário visualizar o preview e confirmar
   * o envio. Ele envia o envelope que está em modo DRAFT e persiste o
   * contrato no banco de dados.
   *
   * @param envelopeId - ID do envelope no DocuSign
   * @param dto - Dados originais do contrato
   * @param userId - ID do usuário que está enviando
   * @returns SendContractResponseDto
   */
  async sendContractAfterPreview(
    envelopeId: string,
    dto: PreviewContractDto,
    userId: string,
  ): Promise<SendContractResponseDto> {
    let externalEffect: ExternalEnvelopeEffect | null = null;
    let transactionCallbackCompleted = false;
    try {
      const result = await this.withContractProcessLock(
        dto.process_id,
        async (tx) => {
          const contract = await this.sendContractAfterPreviewLocked(
            envelopeId,
            dto,
            userId,
            tx,
            (state) => {
              externalEffect = { envelopeId, state };
            },
          );
          transactionCallbackCompleted = true;
          return contract;
        },
      );
      externalEffect = null;
      this.queueContractGeneratedNotification(
        dto,
        result.id,
        'sendContractAfterPreview',
      );
      return result;
    } catch (error) {
      if (error instanceof EnvelopeEffectError) {
        externalEffect = {
          envelopeId: error.envelopeId,
          state: error.effectState,
          providerStatus: error.providerStatus as EnvelopeStatus | undefined,
        };
      }
      if (this.isManualReconciliationError(error)) throw error;
      if (error instanceof ContractAlreadyExistsException) throw error;
      if (externalEffect) {
        if (
          transactionCallbackCompleted ||
          externalEffect.state !== 'DRAFT_CONFIRMED'
        ) {
          throw this.manualReconciliationRequired(
            dto.process_id,
            externalEffect.envelopeId,
            transactionCallbackCompleted
              ? 'A confirmação do commit falhou depois que a transação concluiu.'
              : 'O provedor não confirmou se o envelope foi enviado.',
            error,
          );
        }
        await this.compensateExternalEnvelope(
          externalEffect.envelopeId,
          dto.process_id,
          'Falha ao persistir o envio do contrato',
          error,
          externalEffect.state,
        );
      }
      throw error;
    }
  }

  private async sendContractAfterPreviewLocked(
    envelopeId: string,
    dto: PreviewContractDto,
    userId: string,
    tx: Prisma.TransactionClient,
    registerEnvelopeEffect: (
      state: EnvelopeEffectState,
      providerStatus?: EnvelopeStatus,
    ) => void,
  ): Promise<SendContractResponseDto> {
    try {
      this.logger.log(`=== ENVIANDO CONTRATO APÓS PREVIEW ===`);
      this.logger.log(`EnvelopeID: ${envelopeId}`);
      this.logger.log(`Process: ${dto.process_id}`);
      this.logger.log(`Usuário: ${userId}`);

      // ===== ETAPA 1: RE-VALIDAR INTEGRIDADE =====
      // (usuário pode ter aguardado muito tempo após preview)
      const processRecord = await this.getAuthorizedContractProcess(
        dto.process_id,
        userId,
        tx,
      );
      await this.assertEnvelopeBelongsToProcess(envelopeId, dto.process_id);

      let previewEnvelope: Awaited<
        ReturnType<DocuSignService['getEnvelopeStatus']>
      >;
      try {
        previewEnvelope =
          await this.docuSignService.getEnvelopeStatus(envelopeId);
      } catch (statusError) {
        throw this.manualReconciliationRequired(
          dto.process_id,
          envelopeId,
          'Não foi possível verificar o estado do envelope antes do envio.',
          statusError,
        );
      }

      const isSentOrBeyond = [
        EnvelopeStatus.SENT,
        EnvelopeStatus.DELIVERED,
        EnvelopeStatus.COMPLETED,
      ].includes(previewEnvelope.status);

      registerEnvelopeEffect(
        isSentOrBeyond ? 'SEND_CONFIRMED' : 'DRAFT_CONFIRMED',
        previewEnvelope.status,
      );

      if (!CONTRACT_PREPARATION_STATUSES.includes(processRecord.status)) {
        if (previewEnvelope.status === EnvelopeStatus.CREATED) {
          try {
            await this.docuSignService.voidDraftEnvelope(
              envelopeId,
              'Preview obsoleto de processo encerrado',
            );
          } catch (voidError) {
            throw this.manualReconciliationRequired(
              dto.process_id,
              envelopeId,
              'Não foi possível confirmar a limpeza do preview obsoleto.',
              voidError,
            );
          }
        } else if (isSentOrBeyond) {
          throw this.manualReconciliationRequired(
            dto.process_id,
            envelopeId,
            'Um envelope enviado pertence a um processo em estado terminal.',
            new Error(`process_status=${processRecord.status}`),
          );
        }
        this.assertProcessCanPrepareContract(
          dto.process_id,
          processRecord.status,
        );
      }

      // Revalidar que não existe contrato ativo (pode ter sido criado enquanto preview)
      if (processRecord.active_contract_id) {
        const activeContract = await tx.contract.findUnique({
          where: { id: processRecord.active_contract_id },
          select: { id: true, provider_id: true, provider_status: true },
        });

        if (activeContract?.provider_id === envelopeId) {
          throw new ContractAlreadyExistsException(dto.process_id);
        }

        if (
          activeContract &&
          !['DECLINED', 'VOIDED', 'TIMEDOUT'].includes(
            activeContract.provider_status || '',
          )
        ) {
          if (previewEnvelope.status === EnvelopeStatus.CREATED) {
            try {
              await this.docuSignService.voidDraftEnvelope(
                envelopeId,
                'Contrato criado por outro processo',
              );
            } catch (voidError) {
              throw this.manualReconciliationRequired(
                dto.process_id,
                envelopeId,
                'Não foi possível confirmar a limpeza do preview concorrente.',
                voidError,
              );
            }
          } else if (isSentOrBeyond) {
            throw this.manualReconciliationRequired(
              dto.process_id,
              envelopeId,
              'Um envelope concorrente já foi enviado e não pode ser descartado automaticamente.',
              new Error(`provider_status=${previewEnvelope.status}`),
            );
          }
          throw new ContractAlreadyExistsException(dto.process_id);
        }
      }

      // Buscar usuário uploader
      const uploaderUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });

      if (!uploaderUser) {
        throw new InternalServerErrorException('Usuário não encontrado');
      }

      // Buscar buyer
      const buyerUser = await tx.user.findUnique({
        where: { email: dto.buyer_email },
        select: { id: true },
      });

      this.assertSellerIndependentFromSpecialist(
        dto.seller_email,
        dto.specialist_email,
      );

      // Recalcular o split de comissão (nunca confiar em valores vindos do preview)
      const commission = await this.resolveCommissionFromTotal(
        dto.process_id,
        dto.total_commission_rate,
        tx,
      );

      // ===== ETAPA 2: ENVIAR ENVELOPE NO DOCUSIGN =====
      this.logger.log('Enviando envelope para DocuSign...');

      const sendResponse =
        await this.docuSignService.sendDraftEnvelope(envelopeId);
      registerEnvelopeEffect('SEND_CONFIRMED', sendResponse.status);

      this.logger.log(`✓ Envelope enviado (Status: ${sendResponse.status})`);

      // ===== ETAPA 3: SALVAR NO BANCO =====
      this.logger.log('Salvando contrato no banco...');

      const templateId =
        dto.template_id || globalThis.process.env.DOCUSIGN_TEMPLATE_ID || '';

      const cleanDocs = stripContractDocumentFields(dto);
      const contract = await tx.contract.create({
        data: {
          process_id: dto.process_id,
          description: dto.description || '',

          // Provider (DocuSign)
          provider_name: 'DOCUSIGN',
          provider_id: envelopeId,
          provider_status: mapDocusignStatusToProviderStatus(
            sendResponse.status,
          ),
          provider_meta: {
            sentAt: new Date().toISOString(),
            originalStatus: sendResponse.status,
            templateId: templateId,
            previewUsed: true,
          } as any,

          // Dados do vendedor
          seller_name: dto.seller_name,
          seller_cpf: cleanDocs.seller_cpf,
          seller_rg: cleanDocs.seller_rg,
          seller_address: dto.seller_address ?? '',
          seller_cep: cleanDocs.seller_cep,
          seller_bank: dto.seller_bank ?? '',
          seller_agency: dto.seller_agency ?? '',
          seller_checking_account: dto.seller_checking_account ?? '',

          // Dados do comprador
          buyer_name: dto.buyer_name,
          buyer_cpf: cleanDocs.buyer_cpf,
          buyer_rg: cleanDocs.buyer_rg,
          buyer_address: dto.buyer_address ?? '',
          buyer_cep: cleanDocs.buyer_cep,

          // Dados do veículo
          vehicle_model: dto.vehicle_model ?? '',
          vehicle_year: dto.vehicle_year ?? '',
          vehicle_registration_id: dto.vehicle_registration_id ?? '',
          vehicle_serial_number: dto.vehicle_serial_number ?? '',
          vehicle_technical_information: dto.vehicle_technical_info,
          vehicle_price: dto.vehicle_price,
          vehicle_price_written: numberToWords(dto.vehicle_price),

          // Pagamento ao vendedor
          payment_seller_value: dto.payment_seller_value,
          payment_seller_value_written: numberToWords(dto.payment_seller_value),

          // Dados da Plataforma (Split 1) — taxa travada, calculada no backend
          platform_value: commission.platformValue,
          platform_value_written: numberToWords(commission.platformValue),
          platform_percentage: commission.platformRate,
          platform_name: dto.platform_name,
          platform_cnpj: cleanDocs.platform_cnpj,
          platform_bank: dto.platform_bank,
          platform_agency: dto.platform_agency,
          platform_checking_account: dto.platform_checking_account,

          // Dados do Escritório (Split 2) — taxa travada, calculada no backend
          office_value: commission.officeValue,
          office_value_written: numberToWords(commission.officeValue),
          office_name: dto.office_name,
          office_cnpj: cleanDocs.office_cnpj,
          office_bank: dto.office_bank || null,
          office_agency: dto.office_agency || null,
          office_checking_account: dto.office_checking_account || null,

          // Dados do Especialista (Split 3) — resíduo do total informado
          specialist_commission_value: commission.specialistValue,
          specialist_commission_rate: commission.specialistRate,
          specialist_commission_value_written: numberToWords(
            commission.specialistValue,
          ),
          specialist_name: dto.specialist_name,
          specialist_document: cleanDocs.specialist_document,
          specialist_bank: dto.specialist_bank || null,
          specialist_agency: dto.specialist_agency || null,
          specialist_checking_account: dto.specialist_checking_account || null,

          // Testemunhas (opcionais)
          testimonial1_cpf: cleanDocs.testimonial1_cpf || null,
          testimonial1_email: dto.testimonial1_email || null,
          testimonial2_cpf: cleanDocs.testimonial2_cpf || null,
          testimonial2_email: dto.testimonial2_email || null,

          // Cidade
          city: dto.city ?? '',

          // Template usado
          template_id: templateId,

          // Status
          status:
            sendResponse.status === EnvelopeStatus.COMPLETED
              ? 'SIGNED'
              : 'PENDING',
          ...(sendResponse.status === EnvelopeStatus.COMPLETED
            ? { signed_at: new Date() }
            : {}),
          signature_type: 'SIMPLE',

          // Quem criou
          uploaded_by_id: userId,
          uploaded_by_type: uploaderUser.role,

          // Quem vai assinar
          signed_by_id: buyerUser?.id ?? null,

          created_at: new Date(),
        },
      });

      // Atualizar processo
      const processClaim = await tx.process.updateMany({
        where: {
          id: dto.process_id,
          status: { in: CONTRACT_PREPARATION_STATUSES },
          active_contract_id: processRecord.active_contract_id,
        },
        data: {
          active_contract_id: contract.id,
          status:
            sendResponse.status === EnvelopeStatus.COMPLETED
              ? ProcessStatus.COMPLETED
              : ProcessStatus.DOCUMENTATION,
        },
      });
      if (processClaim.count !== 1) {
        throw new ConflictException(
          'O processo mudou durante o envio do contrato.',
        );
      }
      if (sendResponse.status === EnvelopeStatus.COMPLETED) {
        await tx.processStatusHistory.create({
          data: {
            processId: dto.process_id,
            status: ProcessStatus.COMPLETED,
            reason: 'CONTRACT_SIGNED',
            changed_at: new Date(),
          },
        });
      }

      const createdContract = contract;
      this.logger.log(`✓ Contrato criado: ${createdContract.id}`);
      this.logger.log(`=== ENVIO DE CONTRATO CONCLUÍDO ===`);

      return {
        id: createdContract.id,
        envelope_id: envelopeId,
        process_id: createdContract.process_id,
        status: createdContract.status,
        created_at: createdContract.created_at.toISOString(),
      };
    } catch (error) {
      if (error instanceof EnvelopeEffectError) {
        throw error;
      }
      if (error instanceof HttpException) {
        throw error;
      }

      if (
        error instanceof ProcessNotFoundException ||
        error instanceof ContractAlreadyExistsException ||
        error instanceof EnvelopeNotInDraftException ||
        error instanceof EnvelopeNotFoundException
      ) {
        throw error;
      }

      this.logger.error('Erro ao enviar contrato');
      throw this.contractOperationFailed(dto.process_id, envelopeId, error);
    }
  }

  /**
   * Cancela um envelope de preview que não será enviado
   *
   * @param envelopeId - ID do envelope a cancelar
   * @param reason - Motivo do cancelamento
   */
  async cancelPreview(
    envelopeId: string,
    processId: string,
    userId: string,
    reason: string,
  ): Promise<void> {
    return this.withContractProcessLock(processId, (tx) =>
      this.cancelPreviewLocked(envelopeId, processId, userId, reason, tx),
    );
  }

  private async cancelPreviewLocked(
    envelopeId: string,
    processId: string,
    userId: string,
    reason: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    this.logger.log(`Cancelando preview: ${envelopeId}`);
    const processRecord = await this.getAuthorizedContractProcess(
      processId,
      userId,
      tx,
    );
    await this.assertEnvelopeBelongsToProcess(envelopeId, processId);

    if (processRecord.active_contract_id) {
      const activeContract = await tx.contract.findUnique({
        where: { id: processRecord.active_contract_id },
        select: { id: true, provider_id: true },
      });
      if (activeContract?.provider_id === envelopeId) {
        throw new ConflictException(
          'O envelope informado já pertence ao contrato ativo e não pode ser cancelado como preview.',
        );
      }
    }

    const envelope = await this.docuSignService.getEnvelopeStatus(envelopeId);
    if (envelope.status === EnvelopeStatus.VOIDED) {
      return;
    }
    if (envelope.status !== EnvelopeStatus.CREATED) {
      throw new EnvelopeNotInDraftException(envelopeId, envelope.status);
    }
    await this.docuSignService.voidDraftEnvelope(envelopeId, reason);
  }
}
