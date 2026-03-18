import {
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
  TransactionFailedException,
  EnvelopeNotInDraftException,
  EnvelopeNotFoundException,
} from 'src/shared/exceptions/custom-exceptions';
import {
  formatCpf,
  formatCnpj,
  formatCep,
  formatRg,
  formatBRL,
  numberToWords,
} from 'src/shared/utils/format.utils';
import { ProductType } from '@prisma/client';
import { NotificationService } from 'src/features/notifications/notification.service';
import { PlatformCompanyService } from 'src/features/platform-company/platform-company.service';

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
  ): Promise<PrefillContractResponseDto> {
    this.logger.debug(`Prefill contract data for process: ${processId}`);

    // Buscar processo com todas as relações necessárias
    const processData = await this.prismaService.process.findUnique({
      where: { id: processId },
      include: {
        client: {
          include: { address: true },
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

    // Determinar produto baseado no tipo
    let product: {
      id: number;
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
          price: Number(processData.car.valor) || 0,
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
          price: Number(processData.boat.valor) || 0,
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
          price: Number(processData.aircraft.valor) || 0,
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
    const { platformRate, officeRate, officeData, specialistRate, specialistData } =
      await this.calculateCommissionSplit(
        processData.specialist,
        platformCompany,
      );

    this.logger.debug(
      `Prefill data loaded successfully for process ${processId}`,
    );

    // Valor da proposta ou do produto
    const proposalValue = processData.accepted_proposal
      ? Number(processData.accepted_proposal.proposed_value)
      : product.price;

    // Calcular valores de comissão com base nas taxas
    const platformValue = platformRate
      ? (proposalValue * platformRate) / 100
      : 0;
    const officeValue = officeRate ? (proposalValue * officeRate) / 100 : 0;
    const specialistValue = specialistRate
      ? (proposalValue * specialistRate) / 100
      : 0;

    return {
      process_id: processData.id,
      product_type: processData.product_type,
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
        id: processData.specialist.id,
        name: `${processData.specialist.name || ''} ${processData.specialist.surname || ''}`.trim(),
        email: processData.specialist.email,
        cpf: processData.specialist.cpf || undefined,
        rg: processData.specialist.rg || undefined,
        address: buildFullAddress(processData.specialist.address),
        cep: processData.specialist.address?.cep || undefined,
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
            cpf: specialistData.cpf || undefined,
            bank: specialistData.bank || undefined,
            agency: specialistData.agency || undefined,
            checking_account: specialistData.checking_account || undefined,
            rate: specialistRate,
            value: Math.round(specialistValue * 100) / 100,
          }
        : undefined,
    };
  }

  /**
   * Calcula as taxas de comissão da plataforma, escritório e especialista separadamente
   *
   * Taxas de comissão:
   * - Plataforma: sempre usa default_commission_rate da PlatformCompany
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
      cpf?: string;
      company_id?: string | null;
      commission_rate?: any;
      bank?: string | null;
      agency?: string | null;
      checking_account?: string | null;
    },
    platformCompany: { default_commission_rate: number } | null,
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
      cpf?: string | null;
      bank?: string | null;
      agency?: string | null;
      checking_account?: string | null;
    } | null;
  }> {
    // Taxa da plataforma: sempre vem da PlatformCompany
    const platformRate = platformCompany?.default_commission_rate ?? 0;

    // Taxa do escritório: vem da empresa do especialista
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
          cpf: specialist.cpf,
          bank: specialist.bank,
          agency: specialist.agency,
          checking_account: specialist.checking_account,
        }
      : null;

    // 1. Verificar se especialista tem empresa associada
    if (specialist.company_id) {
      const company = await this.prismaService.company.findUnique({
        where: { id: specialist.company_id },
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
      }
    }

    return { platformRate, officeRate, officeData, specialistRate, specialistData };
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
    try {
      this.logger.log(`=== INICIANDO GERAÇÃO DE CONTRATO ===`);
      this.logger.log(`Usuário: ${userId}`);
      this.logger.log(`Process: ${dto.process_id}`);
      this.logger.log(`Buyer: ${dto.buyer_email}`);

      // ===== ETAPA 1: VALIDAÇÕES DE INTEGRIDADE =====
      this.logger.log('Etapa 1: Validando integridade de negócio...');

      // 1.1 Verificar se processo existe
      const processRecord = await this.prismaService.process.findUnique({
        where: { id: dto.process_id },
        select: {
          id: true,
          status: true,
          active_contract_id: true,
          product_type: true,
        },
      });

      if (!processRecord) {
        this.logger.warn(`Processo ${dto.process_id} não encontrado`);
        throw new ProcessNotFoundException(dto.process_id);
      }

      // 1.2 Validar status do processo
      const allowedStatuses = ['PROCESSING_CONTRACT', 'DOCUMENTATION'];
      if (!allowedStatuses.includes(processRecord.status)) {
        this.logger.warn(
          `Processo ${dto.process_id} não está em status adequado. Status atual: ${processRecord.status}`,
        );
        throw new InternalServerErrorException({
          success: false,
          error: {
            code: 400,
            message:
              'Processo deve estar em fase de preparação de contrato ou documentação',
            details: {
              current_status: processRecord.status,
              allowed_statuses: allowedStatuses,
            },
          },
        });
      }

      // 1.3 Verificar se já existe contrato ativo
      if (processRecord.active_contract_id) {
        const activeContract = await this.prismaService.contract.findUnique({
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
      const buyerUser = await this.prismaService.user.findUnique({
        where: { email: dto.buyer_email },
        select: { id: true, email: true, name: true, surname: true },
      });

      // Em desenvolvimento, permitir emails externos para testes
      const isDevelopment = globalThis.process.env.NODE_ENV !== 'production';

      if (!buyerUser && !isDevelopment) {
        this.logger.warn(`Buyer ${dto.buyer_email} não encontrado`);
        throw new SignerNotFoundException(dto.buyer_email);
      }

      if (!buyerUser && isDevelopment) {
        this.logger.warn(
          `[DEV MODE] Buyer ${dto.buyer_email} não encontrado no sistema, mas permitido em desenvolvimento`,
        );
      }

      // 1.5 Buscar dados do usuário que está criando (seller/specialist)
      const uploaderUser = await this.prismaService.user.findUnique({
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

      // ===== ETAPA 2: FORMATAR DADOS PARA DOCUSIGN =====
      this.logger.log('Etapa 2: Formatando dados para DocuSign...');

      const formFields = this.buildFormFields(dto, processRecord.product_type);

      this.logger.debug(
        `Form fields preparados: ${Object.keys(formFields).length} campos`,
      );

      // ===== ETAPA 3: CRIAR ENVELOPE NO DOCUSIGN =====
      this.logger.log('Etapa 3: Criando envelope no DocuSign via template...');

      const templateId = globalThis.process.env.DOCUSIGN_TEMPLATE_ID;
      if (!templateId) {
        throw new InternalServerErrorException(
          'DOCUSIGN_TEMPLATE_ID não configurado',
        );
      }

      const envelopeResponse =
        await this.docuSignService.createEnvelopeFromTemplate({
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
        });

      this.logger.log(
        `✓ Envelope criado (ID: ${envelopeResponse.envelopeId}, Status: ${envelopeResponse.status})`,
      );

      // ===== ETAPA 4: SALVAR NO BANCO EM TRANSAÇÃO =====
      this.logger.log(
        'Etapa 4: Salvando contrato no banco em transação atômica...',
      );

      const createdContract = await this.prismaService.$transaction(
        async (tx) => {
          // 4.1 Criar contrato no BD com todos os dados do formulário
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
              seller_cpf: dto.seller_cpf,
              seller_rg: dto.seller_rg,
              seller_address: dto.seller_address,
              seller_cep: dto.seller_cep,
              seller_bank: dto.seller_bank,
              seller_agency: dto.seller_agency,
              seller_checking_account: dto.seller_checking_account,

              // Dados do comprador
              buyer_name: dto.buyer_name,
              buyer_cpf: dto.buyer_cpf,
              buyer_rg: dto.buyer_rg,
              buyer_address: dto.buyer_address,
              buyer_cep: dto.buyer_cep,

              // Dados do veículo
              vehicle_model: dto.vehicle_model,
              vehicle_year: dto.vehicle_year,
              vehicle_registration_id: dto.vehicle_registration_id,
              vehicle_serial_number: dto.vehicle_serial_number,
              vehicle_technical_information: dto.vehicle_technical_info,
              vehicle_price: dto.vehicle_price,
              vehicle_price_written: numberToWords(dto.vehicle_price),

              // Pagamento ao vendedor
              payment_seller_value: dto.payment_seller_value,
              payment_seller_value_written: numberToWords(
                dto.payment_seller_value,
              ),

              // Dados da Plataforma (Split 1)
              platform_value: dto.platform_value,
              platform_value_written: numberToWords(dto.platform_value),
              platform_percentage: dto.platform_percentage,
              platform_name: dto.platform_name,
              platform_cnpj: dto.platform_cnpj,
              platform_bank: dto.platform_bank,
              platform_agency: dto.platform_agency,
              platform_checking_account: dto.platform_checking_account,

              // Dados do Escritório (Split 2)
              office_value: dto.office_value,
              office_value_written: numberToWords(dto.office_value),
              office_name: dto.office_name,
              office_cnpj: dto.office_cnpj,
              office_bank: dto.office_bank || null,
              office_agency: dto.office_agency || null,
              office_checking_account: dto.office_checking_account || null,

              // Dados do Especialista (Split 3)
              specialist_commission_value: dto.specialist_value,
              specialist_commission_value_written: numberToWords(
                dto.specialist_value,
              ),
              specialist_name: dto.specialist_name,
              specialist_document: dto.specialist_document,
              specialist_bank: dto.specialist_bank || null,
              specialist_agency: dto.specialist_agency || null,
              specialist_checking_account: dto.specialist_checking_account || null,

              // Testemunhas (opcionais)
              testimonial1_cpf: dto.testimonial1_cpf || null,
              testimonial1_email: dto.testimonial1_email || null,
              testimonial2_cpf: dto.testimonial2_cpf || null,
              testimonial2_email: dto.testimonial2_email || null,

              // Cidade
              city: dto.city,

              // Template usado
              template_id: templateId,

              // Status
              status: 'PENDING',
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
          await tx.process.update({
            where: { id: dto.process_id },
            data: {
              active_contract_id: contract.id,
              status: 'PROCESSING_CONTRACT',
            },
          });

          this.logger.log(
            `✓ Contrato definido como ativo no processo ${dto.process_id}`,
          );
          this.logger.log(`✓ Processo atualizado para PROCESSING_CONTRACT`);

          return contract;
        },
      );

      this.logger.log(
        `✓ Contrato criado no banco com ID: ${createdContract.id}`,
      );
      this.logger.log(`=== GERAÇÃO DE CONTRATO CONCLUÍDA COM SUCESSO ===`);

      // Fire-and-forget: Enviar notificação de contrato gerado
      setImmediate(() => {
        this.notificationService
          .sendContractGeneratedEmail({
            buyerEmail: dto.buyer_email,
            buyerName: dto.buyer_name,
            sellerEmail: dto.seller_email,
            sellerName: dto.seller_name,
            contractId: createdContract.id,
            vehicleDetails: `${dto.vehicle_model} ${dto.vehicle_year}`,
            processId: dto.process_id,
          })
          .catch((err) => {
            this.logger.error('Notification failed (non-critical)', {
              method: 'generateContract',
              contractId: createdContract.id,
              error: err.message,
            });
          });
      });

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
      };
    } catch (error) {
      // ===== TRATAMENTO DE ERROS =====
      if (
        error instanceof ProcessNotFoundException ||
        error instanceof SignerNotFoundException ||
        error instanceof ContractAlreadyExistsException
      ) {
        this.logger.error(
          `Erro esperado na geração de contrato: ${error.message}`,
        );
        throw error;
      }

      if (
        error.message?.includes('DocuSign') ||
        error.status === 502 ||
        error.status === 504
      ) {
        this.logger.error(`Erro do DocuSign: ${error.message}`);
        throw error;
      }

      if (error.code && error.code.startsWith('P')) {
        this.logger.error(
          `Erro de transação Prisma [${error.code}]: ${error.message}`,
        );
        throw new TransactionFailedException(
          error.meta?.cause || error.message,
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Erro inesperado na geração de contrato: ${errorMessage}`,
        error,
      );
      throw new InternalServerErrorException(
        `Erro ao gerar contrato: ${errorMessage}`,
      );
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
      seller_address: dto.seller_address,
      seller_cep: formatCep(dto.seller_cep),
      seller_bank: dto.seller_bank,
      seller_agency: dto.seller_agency,
      seller_checking_account: dto.seller_checking_account,

      // Comprador
      buyer_name: dto.buyer_name,
      buyer_cpf: formatCpf(dto.buyer_cpf),
      buyer_rg: dto.buyer_rg ? formatRg(dto.buyer_rg) : '',
      buyer_address: dto.buyer_address,
      buyer_cep: formatCep(dto.buyer_cep),

      // Veículo
      vehicle_model: dto.vehicle_model,
      vehicle_year: dto.vehicle_year,
      vehicle_registration_id: dto.vehicle_registration_id,
      vehicle_serial_number: dto.vehicle_serial_number,
      // ATENÇÃO: typo no template - "techinical" com 'i' antes de 'n'
      vehicle_techinical_information: dto.vehicle_technical_info || '',
      vehicle_price: formatBRL(dto.vehicle_price),
      vehicle_price_written: numberToWords(dto.vehicle_price),

      // Pagamento ao vendedor
      payment_seller_value: formatBRL(dto.payment_seller_value),
      payment_seller_value_written: numberToWords(dto.payment_seller_value),

      // === Campos do template ANTIGO (compatibilidade) ===
      commission_value: formatBRL(dto.platform_value),
      // ATENÇÃO: typo no template antigo - "commision" com apenas 1 'm'
      commision_value_written: numberToWords(dto.platform_value),
      commission_name: dto.platform_name,
      // ATENÇÃO: typo no template antigo - "commision_cpf" com apenas 1 'm'
      commision_cpf: formatCnpj(dto.platform_cnpj),
      commission_bank: dto.platform_bank,
      commission_agency: dto.platform_agency,
      commission_checking_account: dto.platform_checking_account,

      // === Campos do template NOVO (split 3 vias) ===
      // Dados da Plataforma (Split 1)
      platform_value: formatBRL(dto.platform_value),
      platform_value_written: numberToWords(dto.platform_value),
      platform_percentage: String(dto.platform_percentage),
      platform_name: dto.platform_name,
      platform_cnpj: formatCnpj(dto.platform_cnpj),
      platform_bank: dto.platform_bank,
      platform_agency: dto.platform_agency,
      platform_checking_account: dto.platform_checking_account,

      // Dados do Escritório (Split 2)
      commission_office_value: formatBRL(dto.office_value),
      commission_office_written: numberToWords(dto.office_value),
      office_name: dto.office_name,
      office_cnpj: formatCnpj(dto.office_cnpj),
      office_bank: dto.office_bank || '',
      office_agency: dto.office_agency || '',
      office_checking_account: dto.office_checking_account || '',

      // Dados do Especialista (Split 3)
      specialist_value: formatBRL(dto.specialist_value),
      specialist_value_written: numberToWords(dto.specialist_value),
      specialist_bank: dto.specialist_bank || '',
      specialist_agency: dto.specialist_agency || '',
      specialist_checking_account: dto.specialist_checking_account || '',
      // NOTE: variável do template usa nome em português/inglês misturado
      especialista_name: dto.specialist_name,
      specialist_document: formatCpf(dto.specialist_document),

      // Testemunhas (opcionais)
      testimonial1_cpf: dto.testimonial1_cpf
        ? formatCpf(dto.testimonial1_cpf)
        : '',
      testimonial2_cpf: dto.testimonial2_cpf
        ? formatCpf(dto.testimonial2_cpf)
        : '',

      // Cidade
      city: dto.city,
    };

    this.logger.debug(
      `Form fields built for ${productType}: registration=${dto.vehicle_registration_id}, serial=${dto.vehicle_serial_number}`,
    );

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
    try {
      this.logger.log(`=== INICIANDO PREVIEW DE CONTRATO ===`);
      this.logger.log(`Usuário: ${userId}`);
      this.logger.log(`Process: ${dto.process_id}`);

      // ===== ETAPA 1: VALIDAÇÕES DE INTEGRIDADE =====
      this.logger.log('Preview Etapa 1: Validando integridade de negócio...');

      // 1.1 Verificar se processo existe
      const processRecord = await this.prismaService.process.findUnique({
        where: { id: dto.process_id },
        select: {
          id: true,
          status: true,
          active_contract_id: true,
          product_type: true,
        },
      });

      if (!processRecord) {
        this.logger.warn(`Processo ${dto.process_id} não encontrado`);
        throw new ProcessNotFoundException(dto.process_id);
      }

      // 1.2 Validar status do processo
      const allowedStatuses = ['PROCESSING_CONTRACT', 'DOCUMENTATION'];
      if (!allowedStatuses.includes(processRecord.status)) {
        this.logger.warn(
          `Processo ${dto.process_id} não está em status adequado. Status atual: ${processRecord.status}`,
        );
        throw new InternalServerErrorException({
          success: false,
          error: {
            code: 400,
            message:
              'Processo deve estar em fase de preparação de contrato ou documentação',
            details: {
              current_status: processRecord.status,
              allowed_statuses: allowedStatuses,
            },
          },
        });
      }

      // 1.3 Verificar se já existe contrato ativo
      if (processRecord.active_contract_id) {
        const activeContract = await this.prismaService.contract.findUnique({
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

      // ===== ETAPA 2: FORMATAR DADOS PARA DOCUSIGN =====
      this.logger.log('Preview Etapa 2: Formatando dados para DocuSign...');

      // Reutilizar buildFormFields criando DTO compatível
      const generateDto: GenerateContractDto = {
        process_id: dto.process_id,
        seller_name: dto.seller_name,
        seller_email: dto.seller_email,
        seller_cpf: dto.seller_cpf,
        seller_rg: dto.seller_rg,
        seller_address: dto.seller_address,
        seller_cep: dto.seller_cep,
        seller_bank: dto.seller_bank,
        seller_agency: dto.seller_agency,
        seller_checking_account: dto.seller_checking_account,
        buyer_name: dto.buyer_name,
        buyer_email: dto.buyer_email,
        buyer_cpf: dto.buyer_cpf,
        buyer_rg: dto.buyer_rg,
        buyer_address: dto.buyer_address,
        buyer_cep: dto.buyer_cep,
        vehicle_model: dto.vehicle_model,
        vehicle_year: dto.vehicle_year,
        vehicle_registration_id: dto.vehicle_registration_id,
        vehicle_serial_number: dto.vehicle_serial_number,
        vehicle_technical_info: dto.vehicle_technical_info,
        vehicle_price: dto.vehicle_price,
        payment_seller_value: dto.payment_seller_value,
        platform_value: dto.platform_value,
        platform_percentage: dto.platform_percentage,
        platform_name: dto.platform_name,
        platform_cnpj: dto.platform_cnpj,
        platform_bank: dto.platform_bank,
        platform_agency: dto.platform_agency,
        platform_checking_account: dto.platform_checking_account,
        office_value: dto.office_value,
        office_name: dto.office_name,
        office_cnpj: dto.office_cnpj,
        office_bank: dto.office_bank,
        office_agency: dto.office_agency,
        office_checking_account: dto.office_checking_account,
        specialist_value: dto.specialist_value,
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
        city: dto.city,
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

      const templateId = globalThis.process.env.DOCUSIGN_TEMPLATE_ID;
      if (!templateId) {
        throw new InternalServerErrorException(
          'DOCUSIGN_TEMPLATE_ID não configurado',
        );
      }

      const previewResponse = await this.docuSignService.createEnvelopePreview({
        templateId,
        buyerEmail: dto.buyer_email,
        buyerName: dto.buyer_name,
        sellerEmail: dto.seller_email,
        sellerName: dto.seller_name,
        formFields,
        processId: dto.process_id,
        returnUrl: dto.return_url,
        testimonial1Name: dto.testimonial1_name,
        testimonial1Email: dto.testimonial1_email,
        testimonial2Name: dto.testimonial2_name,
        testimonial2Email: dto.testimonial2_email,
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
        this.logger.error(`Erro do DocuSign no preview: ${error.message}`);
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro inesperado no preview: ${errorMessage}`, error);
      throw new InternalServerErrorException(
        `Erro ao criar preview: ${errorMessage}`,
      );
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
    try {
      this.logger.log(`=== ENVIANDO CONTRATO APÓS PREVIEW ===`);
      this.logger.log(`EnvelopeID: ${envelopeId}`);
      this.logger.log(`Process: ${dto.process_id}`);
      this.logger.log(`Usuário: ${userId}`);

      // ===== ETAPA 1: RE-VALIDAR INTEGRIDADE =====
      // (usuário pode ter aguardado muito tempo após preview)
      const processRecord = await this.prismaService.process.findUnique({
        where: { id: dto.process_id },
        select: {
          id: true,
          status: true,
          active_contract_id: true,
          product_type: true,
        },
      });

      if (!processRecord) {
        throw new ProcessNotFoundException(dto.process_id);
      }

      // Revalidar que não existe contrato ativo (pode ter sido criado enquanto preview)
      if (processRecord.active_contract_id) {
        const activeContract = await this.prismaService.contract.findUnique({
          where: { id: processRecord.active_contract_id },
          select: { id: true, provider_status: true },
        });

        if (
          activeContract &&
          !['DECLINED', 'VOIDED', 'TIMEDOUT'].includes(
            activeContract.provider_status || '',
          )
        ) {
          // Cancelar o envelope draft
          await this.docuSignService.voidDraftEnvelope(
            envelopeId,
            'Contrato criado por outro processo',
          );
          throw new ContractAlreadyExistsException(dto.process_id);
        }
      }

      // Buscar usuário uploader
      const uploaderUser = await this.prismaService.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });

      if (!uploaderUser) {
        throw new InternalServerErrorException('Usuário não encontrado');
      }

      // Buscar buyer
      const buyerUser = await this.prismaService.user.findUnique({
        where: { email: dto.buyer_email },
        select: { id: true },
      });

      // ===== ETAPA 2: ENVIAR ENVELOPE NO DOCUSIGN =====
      this.logger.log('Enviando envelope para DocuSign...');

      const sendResponse =
        await this.docuSignService.sendDraftEnvelope(envelopeId);

      this.logger.log(`✓ Envelope enviado (Status: ${sendResponse.status})`);

      // ===== ETAPA 3: SALVAR NO BANCO =====
      this.logger.log('Salvando contrato no banco...');

      const templateId = globalThis.process.env.DOCUSIGN_TEMPLATE_ID || '';

      const createdContract = await this.prismaService.$transaction(
        async (tx) => {
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
              seller_cpf: dto.seller_cpf,
              seller_rg: dto.seller_rg,
              seller_address: dto.seller_address,
              seller_cep: dto.seller_cep,
              seller_bank: dto.seller_bank,
              seller_agency: dto.seller_agency,
              seller_checking_account: dto.seller_checking_account,

              // Dados do comprador
              buyer_name: dto.buyer_name,
              buyer_cpf: dto.buyer_cpf,
              buyer_rg: dto.buyer_rg,
              buyer_address: dto.buyer_address,
              buyer_cep: dto.buyer_cep,

              // Dados do veículo
              vehicle_model: dto.vehicle_model,
              vehicle_year: dto.vehicle_year,
              vehicle_registration_id: dto.vehicle_registration_id,
              vehicle_serial_number: dto.vehicle_serial_number,
              vehicle_technical_information: dto.vehicle_technical_info,
              vehicle_price: dto.vehicle_price,
              vehicle_price_written: numberToWords(dto.vehicle_price),

              // Pagamento ao vendedor
              payment_seller_value: dto.payment_seller_value,
              payment_seller_value_written: numberToWords(
                dto.payment_seller_value,
              ),

              // Dados da Plataforma (Split 1)
              platform_value: dto.platform_value,
              platform_value_written: numberToWords(dto.platform_value),
              platform_percentage: dto.platform_percentage,
              platform_name: dto.platform_name,
              platform_cnpj: dto.platform_cnpj,
              platform_bank: dto.platform_bank,
              platform_agency: dto.platform_agency,
              platform_checking_account: dto.platform_checking_account,

              // Dados do Escritório (Split 2)
              office_value: dto.office_value,
              office_value_written: numberToWords(dto.office_value),
              office_name: dto.office_name,
              office_cnpj: dto.office_cnpj,
              office_bank: dto.office_bank || null,
              office_agency: dto.office_agency || null,
              office_checking_account: dto.office_checking_account || null,

              // Dados do Especialista (Split 3)
              specialist_commission_value: dto.specialist_value,
              specialist_commission_value_written: numberToWords(
                dto.specialist_value,
              ),
              specialist_name: dto.specialist_name,
              specialist_document: dto.specialist_document,
              specialist_bank: dto.specialist_bank || null,
              specialist_agency: dto.specialist_agency || null,
              specialist_checking_account: dto.specialist_checking_account || null,

              // Testemunhas (opcionais)
              testimonial1_cpf: dto.testimonial1_cpf || null,
              testimonial1_email: dto.testimonial1_email || null,
              testimonial2_cpf: dto.testimonial2_cpf || null,
              testimonial2_email: dto.testimonial2_email || null,

              // Cidade
              city: dto.city,

              // Template usado
              template_id: templateId,

              // Status
              status: 'PENDING',
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
          await tx.process.update({
            where: { id: dto.process_id },
            data: {
              active_contract_id: contract.id,
              status: 'PROCESSING_CONTRACT',
            },
          });

          return contract;
        },
      );

      this.logger.log(`✓ Contrato criado: ${createdContract.id}`);
      this.logger.log(`=== ENVIO DE CONTRATO CONCLUÍDO ===`);

      // Fire-and-forget: Enviar notificação
      setImmediate(() => {
        this.notificationService
          .sendContractGeneratedEmail({
            buyerEmail: dto.buyer_email,
            buyerName: dto.buyer_name,
            sellerEmail: dto.seller_email,
            sellerName: dto.seller_name,
            contractId: createdContract.id,
            vehicleDetails: `${dto.vehicle_model} ${dto.vehicle_year}`,
            processId: dto.process_id,
          })
          .catch((err) => {
            this.logger.error('Notification failed (non-critical)', {
              method: 'sendContractAfterPreview',
              contractId: createdContract.id,
              error: err.message,
            });
          });
      });

      return {
        id: createdContract.id,
        envelope_id: envelopeId,
        process_id: createdContract.process_id,
        status: 'PENDING',
        created_at: createdContract.created_at.toISOString(),
      };
    } catch (error) {
      if (
        error instanceof ProcessNotFoundException ||
        error instanceof ContractAlreadyExistsException ||
        error instanceof EnvelopeNotInDraftException ||
        error instanceof EnvelopeNotFoundException
      ) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro ao enviar contrato: ${errorMessage}`, error);
      throw new InternalServerErrorException(
        `Erro ao enviar contrato: ${errorMessage}`,
      );
    }
  }

  /**
   * Cancela um envelope de preview que não será enviado
   *
   * @param envelopeId - ID do envelope a cancelar
   * @param reason - Motivo do cancelamento
   */
  async cancelPreview(envelopeId: string, reason: string): Promise<void> {
    this.logger.log(`Cancelando preview: ${envelopeId}`);
    await this.docuSignService.voidDraftEnvelope(envelopeId, reason);
  }
}
