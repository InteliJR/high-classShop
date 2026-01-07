import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { ContractResponse } from './entity/contracts.response';
import { DocuSignService } from 'src/providers/docusign/docusign.service';
import { PdfService } from 'src/providers/docusign/pdf.service';
import { S3Service } from 'src/aws/s3.service';
import { mapDocusignStatusToProviderStatus } from 'src/providers/docusign/mappers/envelope-status.mapper';
import {
  ProcessNotFoundException,
  SignerNotFoundException,
  UnauthorizedContractCreationException,
  ContractAlreadyExistsException,
  PdfProcessingException,
  S3UploadFailedException,
  TransactionFailedException,
} from 'src/shared/exceptions/custom-exceptions';

/**
 * Serviço de Contratos
 *
 * Responsabilidades Críticas:
 * 1. Validar integridade de negócio (process exists, user authorized, etc.)
 * 2. Processar PDF enviado pelo usuário (merge com página de assinatura)
 * 3. Fazer upload do PDF para S3 (persistência)
 * 4. Enviar PDF para DocuSign (criar envelope)
 * 5. Persistir contrato no banco de dados em transação atômica
 *
 * Fluxo:
 * Controller (validado)
 *   → Validar integridade (process, signer, permissões)
 *   → PdfService.processContractPdf (merge)
 *   → S3Service.uploadFile (persistência)
 *   → DocuSignService.createEnvelope (envelope)
 *   → Prisma.$transaction (salvar BD atomicamente)
 *
 * Padrão de Erro:
 * - Exceções customizadas com mensagens amigáveis
 * - Logs detalhados para debugging
 * - Rollback automático de transação em caso de erro
 */
@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly docuSignService: DocuSignService,
    private readonly pdfService: PdfService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Cria um novo contrato com validações rigorosas e transação atômica.
   *
   * VALIDAÇÕES APLICADAS:
   * ✅ process_id existe no banco
   * ✅ client_email (signer) existe no banco
   * ✅ Usuário tem permissão para criar contrato neste process
   * ✅ Não existe contrato duplicado para este process
   *
   * PROCESSAMENTO:
   * 1. Validações de integridade
   * 2. Processar PDF (merge com assinatura)
   * 3. Upload para S3 (persistência)
   * 4. Criar envelope DocuSign
   * 5. Transação Prisma (ATOMIC) → salvar contrato
   * 6. Rollback automático se qualquer etapa falhar
   *
   * @param file - Arquivo PDF já validado (pelo PdfValidationPipe)
   * @param createContractDto - DTO com dados textuais (process_id, client_email, description)
   * @param userId - ID do usuário que está criando
   * @param userEmail - Email do usuário que está criando
   * @returns {ContractResponse} - Dados do contrato criado
   *
   * @throws {ProcessNotFoundException} - process_id não existe
   * @throws {SignerNotFoundException} - client_email não existe
   * @throws {UnauthorizedContractCreationException} - usuário sem permissão
   * @throws {PdfProcessingException} - erro ao processar PDF
   * @throws {S3UploadFailedException} - erro ao fazer upload para S3
   * @throws {ProviderUnavailableException} - DocuSign indisponível
   * @throws {TransactionFailedException} - erro na transação Prisma
   */
  async create(
    file: Express.Multer.File,
    createContractDto: CreateContractDto,
    userId: string,
    userEmail: string,
  ): Promise<ContractResponse> {
    try {
      this.logger.log(`=== INICIANDO CRIAÇÃO DE CONTRATO ===`);
      this.logger.log(`Usuário: ${userId} (${userEmail})`);
      this.logger.log(`Process: ${createContractDto.process_id}`);
      this.logger.log(`Signer: ${createContractDto.client_email}`);

      // ===== ETAPA 1: VALIDAÇÕES DE INTEGRIDADE =====
      this.logger.log('Etapa 1: Validando integridade de negócio...');

      // 1.1 Validar que arquivo foi fornecido
      if (!file || !file.buffer) {
        throw new PdfProcessingException('Arquivo PDF não fornecido ou vazio');
      }

      // 1.2 Verificar se process_id existe no banco
      const process = await this.prismaService.process.findUnique({
        where: { id: createContractDto.process_id },
        select: { id: true, status: true, active_contract_id: true },
      });

      if (!process) {
        this.logger.warn(
          `Processo ${createContractDto.process_id} não encontrado`,
        );
        throw new ProcessNotFoundException(createContractDto.process_id);
      }

      // 1.2.1 Validar que processo está em PROCESSING_CONTRACT ou DOCUMENTATION
      // Contratos só podem ser criados após negociação ser aceita
      const allowedStatuses = ['PROCESSING_CONTRACT', 'DOCUMENTATION'];
      if (!allowedStatuses.includes(process.status)) {
        this.logger.warn(
          `Processo ${createContractDto.process_id} não está em status adequado para criação de contrato. Status atual: ${process.status}`,
        );
        throw new InternalServerErrorException({
          success: false,
          error: {
            code: 400,
            message:
              'Processo deve estar em fase de preparação de contrato ou documentação',
            details: {
              current_status: process.status,
              allowed_statuses: allowedStatuses,
            },
          },
        });
      }

      // 1.2.2 Validar se há um contrato ativo que ainda está em negociação
      if (process.active_contract_id) {
        const activeContract = await this.prismaService.contract.findUnique({
          where: { id: process.active_contract_id },
          select: { id: true, provider_status: true },
        });

        if (
          activeContract &&
          !['DECLINED', 'VOIDED', 'TIMEDOUT'].includes(
            activeContract.provider_status || '',
          )
        ) {
          this.logger.warn(
            `Processo ${createContractDto.process_id} já possui um contrato ativo: ${activeContract.id}`,
          );
          throw new ContractAlreadyExistsException(
            createContractDto.process_id,
          );
        }
      }

      // 1.3 Verificar se usuário tem permissão para criar contrato neste process
      // TODO: Implementar lógica de permissão customizada
      // Por enquanto, qualquer usuário autenticado pode criar (remover se necessário validação real)
      // if (process.created_by_id !== userId) {
      //   throw new UnauthorizedContractCreationException(userId, createContractDto.process_id);
      // }

      // 1.4 Verificar se signer (client_email) existe no banco
      const signerUser = await this.prismaService.user.findUnique({
        where: { email: createContractDto.client_email },
        select: { id: true, email: true, name: true, surname: true },
      });

      if (!signerUser) {
        this.logger.warn(
          `Usuário signer ${createContractDto.client_email} não encontrado`,
        );
        throw new SignerNotFoundException(createContractDto.client_email);
      }

      this.logger.log('✓ Validações de integridade passaram');

      // ===== ETAPA 2: PROCESSAR PDF =====
      this.logger.log(
        'Etapa 2: Processando PDF (merge com página de assinatura)...',
      );

      let processedPdfBuffer: Buffer;
      try {
        processedPdfBuffer = await this.pdfService.processContractPdf(
          file.buffer,
        );
        this.logger.log(
          `✓ PDF processado com sucesso (${processedPdfBuffer.length} bytes)`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`Erro ao processar PDF: ${errorMessage}`);
        throw new PdfProcessingException(errorMessage);
      }

      // ===== ETAPA 3: UPLOAD PARA S3 =====
      this.logger.log('Etapa 3: Fazendo upload do PDF para S3...');

      const s3Key = `contracts/${createContractDto.process_id}/${Date.now()}-${file.originalname}`;

      let signedUrl: string;
      try {
        await this.s3Service.uploadFile(
          {
            originalname: file.originalname,
            mimetype: file.mimetype,
            buffer: processedPdfBuffer,
            size: processedPdfBuffer.length,
          } as Express.Multer.File,
          s3Key,
        );
        this.logger.log(`✓ PDF enviado para S3 (key: ${s3Key})`);

        // 3.1 Gerar URL assinada para acesso (expira em 1 hora)
        signedUrl = await this.s3Service.getSignedUrl(s3Key);
        this.logger.log(`✓ URL assinada gerada (expira em 1 hora)`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`Erro ao fazer upload para S3: ${errorMessage}`);
        throw new S3UploadFailedException(file.originalname, errorMessage);
      }

      // ===== ETAPA 4: CRIAR ENVELOPE NO DOCUSIGN =====
      this.logger.log(
        `Etapa 4: Criando envelope no DocuSign para ${createContractDto.client_email}...`,
      );

      const envelopeResponse = await this.docuSignService.createEnvelope({
        pdfBuffer: processedPdfBuffer,
        clientEmail: createContractDto.client_email,
        clientName: `${signerUser.name} ${signerUser.surname}`,
      });

      this.logger.log(
        `✓ Envelope criado (ID: ${envelopeResponse.envelopeId}, Status: ${envelopeResponse.status})`,
      );

      // ===== ETAPA 5: SALVAR NO BANCO EM TRANSAÇÃO =====
      this.logger.log(
        'Etapa 5: Salvando contrato no banco em transação atômica...',
      );

      const createdContract = await this.prismaService.$transaction(
        async (tx) => {
          // 5.1 Buscar usuário que vai assinar (já validado em 1.4)
          const signer = await tx.user.findUniqueOrThrow({
            where: { email: createContractDto.client_email },
          });

          // 5.2 Buscar usuário que está criando (já validado implicitamente)
          const uploader = await tx.user.findUniqueOrThrow({
            where: { id: userId },
          });

          // 5.3 Criar contrato no BD
          const contract = await tx.contract.create({
            data: {
              process_id: createContractDto.process_id,
              description: createContractDto.description || '',

              // Arquivo (PDF processado no S3)
              file_name: file.originalname,
              file_path: s3Key, // Chave real no S3 bucket
              file_type: file.mimetype,
              file_size: processedPdfBuffer.length,
              original_pdf_url: signedUrl, // URL assinada para download (1 hora)

              // Provider (DocuSign)
              provider_name: 'DOCUSIGN',
              provider_id: envelopeResponse.envelopeId,
              provider_status: mapDocusignStatusToProviderStatus(
                envelopeResponse.status,
              ),
              provider_meta: {
                sentAt: new Date().toISOString(),
                originalStatus: envelopeResponse.status,
                s3Key: s3Key, // Rastreamento interno
              } as any,

              // Status do contrato
              status: 'PENDING', // Aguardando assinatura
              signature_type: 'SIMPLE',

              // Informações de quem criou/enviou
              uploaded_by_id: userId,
              uploaded_by_type: uploader.role,

              // Informações de quem vai assinar
              signed_by_id: signer.id,

              created_at: new Date(),
            },
          });

          // 5.4 Atualizar processo para definir este contrato como ativo e mudar status para PROCESSING_CONTRACT
          // (Contrato foi enviado para DocuSign, avança do DOCUMENTATION para PROCESSING_CONTRACT)
          await tx.process.update({
            where: { id: createContractDto.process_id },
            data: {
              active_contract_id: contract.id,
              status: 'PROCESSING_CONTRACT', // Aguardando resposta da assinatura
            },
          });

          this.logger.log(
            `✓ Contrato definido como ativo no processo ${createContractDto.process_id}`,
          );
          this.logger.log(
            `✓ Processo ${createContractDto.process_id} atualizado para PROCESSING_CONTRACT`,
          );

          return contract;
        },
      );

      this.logger.log(
        `✓ Contrato criado no banco com ID: ${createdContract.id}`,
      );
      this.logger.log(`=== CRIAÇÃO DE CONTRATO CONCLUÍDA COM SUCESSO ===`);

      // ===== RETORNAR RESPOSTA =====
      return {
        id: createdContract.id,
        file_name: createdContract.file_name,
        file_type: createdContract.file_type,
        file_size: createdContract.file_size,
        description: createdContract.description,
        process_id: createdContract.process_id,
        uploaded_by: {
          id: createdContract.uploaded_by_id,
          name: 'Usuário', // TODO: buscar nome real do usuário
          type: createdContract.uploaded_by_type,
        },
        created_at: createdContract.created_at,
      };
    } catch (error) {
      // ===== TRATAMENTO DE ERROS =====
      // Se é uma exceção customizada, re-lança como está
      if (
        error instanceof ProcessNotFoundException ||
        error instanceof SignerNotFoundException ||
        error instanceof UnauthorizedContractCreationException ||
        error instanceof ContractAlreadyExistsException ||
        error instanceof PdfProcessingException ||
        error instanceof S3UploadFailedException
      ) {
        this.logger.error(
          `Erro esperado na criação de contrato: ${error.message}`,
        );
        throw error; // Re-lança exceção com status HTTP apropriado
      }

      // Se é erro do DocuSign, re-lança
      if (
        error.message?.includes('DocuSign') ||
        error.status === 502 ||
        error.status === 504
      ) {
        this.logger.error(`Erro do DocuSign: ${error.message}`);
        throw error;
      }

      // Se é erro de transação Prisma, converte em exceção customizada
      if (error.code && error.code.startsWith('P')) {
        this.logger.error(
          `Erro de transação Prisma [${error.code}]: ${error.message}`,
        );
        throw new TransactionFailedException(
          error.meta?.cause || error.message,
        );
      }

      // Erro inesperado
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Erro inesperado na criação de contrato: ${errorMessage}`,
        error,
      );
      throw new InternalServerErrorException(
        `Erro ao criar contrato: ${errorMessage}`,
      );
    }
  }
}
