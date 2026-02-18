import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Request,
  HttpStatus,
  Logger,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { GenerateContractDto } from './dto/generate-contract.dto';
import { PreviewContractDto } from './dto/preview-contract.dto';
import {
  PreviewContractResponseDto,
  SendContractResponseDto,
} from './dto/preview-contract-response.dto';
import { PrefillContractResponseDto } from './dto/prefill-contract-response.dto';
import { ApiResponseDto } from 'src/shared/dto/api-response.dto';
import { ContractResponse } from './entity/contracts.response';
import type { RequestWithUser } from 'src/auth/dto/auth';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { RateLimitGuard } from 'src/shared/guards/rate-limit.guard';
import { RateLimit } from 'src/shared/decorators/rate-limit.decorator';

/**
 * Controller para gerenciar contratos via formulário.
 *
 * Responsabilidades:
 * - Fornecer dados para pré-preenchimento do formulário (GET /prefill/:processId)
 * - Receber dados do formulário e gerar contrato no DocuSign (POST /generate)
 *
 * Segurança:
 * - AuthGuard: Garante que apenas usuários autenticados podem acessar
 *
 * Fluxo:
 * 1. Frontend busca dados pré-preenchidos via GET /contracts/prefill/:processId
 * 2. Especialista preenche/edita formulário
 * 3. Frontend envia dados via POST /contracts/generate
 * 4. Backend valida, formata e cria envelope no DocuSign
 */
@Controller('contracts')
export class ContractsController {
  private readonly logger = new Logger(ContractsController.name);

  constructor(private readonly contractsService: ContractsService) {}

  /**
   * GET /api/contracts/prefill/:processId
   *
   * Retorna dados para pré-preencher o formulário de contrato.
   *
   * Dados retornados:
   * - Informações do comprador (cliente)
   * - Informações do vendedor (especialista)
   * - Informações do produto (carro/embarcação/aeronave)
   * - Valor da proposta aceita
   * - Configurações de comissão da plataforma
   *
   * @param processId - UUID do processo
   * @param req - Requisição com usuário autenticado
   * @returns ApiResponseDto<PrefillContractResponseDto>
   *
   * @throws ProcessNotFoundException - Se processo não existe
   *
   * @example
   * GET /contracts/prefill/550e8400-e29b-41d4-a716-446655440000
   * Authorization: Bearer <JWT_TOKEN>
   *
   * Response (200 OK):
   * {
   *   "success": true,
   *   "message": "Dados do contrato carregados com sucesso",
   *   "data": {
   *     "process_id": "uuid",
   *     "product_type": "CAR",
   *     "buyer": { "id": "uuid", "name": "João Silva", ... },
   *     "seller": { "id": "uuid", "name": "Maria Santos", ... },
   *     "product": { "brand": "Ferrari", "model": "488", ... },
   *     "proposal": { "value": 1500000 },
   *     "commission": { "name": "High Class Shop", ... }
   *   }
   * }
   */
  @Get('prefill/:processId')
  async prefillContract(
    @Param('processId', new ParseUUIDPipe({ version: '4' })) processId: string,
    @Request() req: RequestWithUser,
  ): Promise<ApiResponseDto<PrefillContractResponseDto>> {
    const { id: userId, email: userEmail } = req.user;

    this.logger.log(
      `Prefill contract requested by user ${userId} (${userEmail}) for process ${processId}`,
    );

    const prefillData = await this.contractsService.prefillContract(processId);

    this.logger.debug(`Prefill data returned for process ${processId}`);

    return {
      sucess: true,
      message: 'Dados do contrato carregados com sucesso',
      data: prefillData,
    };
  }

  /**
   * POST /api/contracts/generate
   *
   * Gera um novo contrato via formulário e envia para DocuSign.
   *
   * Fluxo:
   * 1. Valida autenticação (AuthGuard)
   * 2. Valida DTO (class-validator)
   * 3. Valida integridade de negócio (processo existe, status correto, etc.)
   * 4. Formata dados para DocuSign (CPF, CNPJ, CEP, valores monetários)
   * 5. Cria envelope via template no DocuSign
   * 6. Salva contrato no banco em transação atômica
   * 7. Retorna informações do contrato criado
   *
   * Validações Aplicadas:
   * - ✅ Usuário autenticado
   * - ✅ process_id é UUID válido e existe
   * - ✅ Processo está em status PROCESSING_CONTRACT ou DOCUMENTATION
   * - ✅ Não existe contrato ativo pendente
   * - ✅ buyer_email existe no sistema
   * - ✅ Todos os campos obrigatórios preenchidos
   *
   * @param generateContractDto - DTO com dados do formulário de contrato
   * @param req - Requisição com usuário autenticado
   * @returns ApiResponseDto<ContractResponse> - Resposta com dados do contrato criado
   *
   * @throws ProcessNotFoundException - Se processo não existe
   * @throws SignerNotFoundException - Se buyer_email não existe
   * @throws ContractAlreadyExistsException - Se já existe contrato ativo
   * @throws ProviderUnavailableException - Se DocuSign está fora
   *
   * @example
   * POST /contracts/generate
   * Authorization: Bearer <JWT_TOKEN>
   * Content-Type: application/json
   *
   * Body:
   * {
   *   "process_id": "550e8400-e29b-41d4-a716-446655440000",
   *   "seller_name": "Maria Santos",
   *   "seller_cpf": "12345678901",
   *   "seller_address": "Rua das Flores, 123",
   *   "seller_cep": "01234567",
   *   ...
   * }
   *
   * Response (201 Created):
   * {
   *   "success": true,
   *   "message": "Contrato gerado e enviado para assinatura com sucesso",
   *   "data": {
   *     "id": "uuid",
   *     "process_id": "uuid",
   *     "created_at": "2026-02-05T10:30:00Z"
   *   }
   * }
   */
  @Post('generate')
  async generateContract(
    @Body() generateContractDto: GenerateContractDto,
    @Request() req: RequestWithUser,
  ): Promise<ApiResponseDto<ContractResponse>> {
    const { id: userId, email: userEmail } = req.user;

    this.logger.log(
      `Iniciando geração de contrato para usuário ${userId} (${userEmail})`,
    );
    this.logger.debug(
      `Process: ${generateContractDto.process_id}, Buyer: ${generateContractDto.buyer_email}`,
    );

    const contract = await this.contractsService.generateContract(
      generateContractDto,
      userId,
    );

    this.logger.log(
      `Contrato gerado com sucesso. ID: ${contract.id}, Process: ${contract.process_id}`,
    );

    return {
      sucess: true,
      message: 'Contrato gerado e enviado para assinatura com sucesso',
      data: contract,
    };
  }

  /**
   * POST /api/contracts/preview
   *
   * Cria um preview do contrato via DocuSign Sender View.
   *
   * O preview permite ao especialista visualizar e editar o contrato
   * antes de enviá-lo definitivamente para assinatura.
   *
   * Segurança:
   * - Apenas SPECIALIST e ADMIN podem acessar
   * - Rate limit: 10 requisições por minuto
   *
   * A URL retornada expira em 10 minutos.
   *
   * @param previewContractDto - DTO com dados do contrato e returnUrl
   * @param req - Requisição com usuário autenticado
   * @returns ApiResponseDto<PreviewContractResponseDto>
   *
   * @example
   * POST /contracts/preview
   * Authorization: Bearer <JWT_TOKEN>
   *
   * Body:
   * {
   *   "process_id": "uuid",
   *   "seller_name": "Maria Santos",
   *   ...
   * }
   *
   * Response (201 Created):
   * {
   *   "success": true,
   *   "message": "Preview criado com sucesso",
   *   "data": {
   *     "pdf_base64": "JVBERi0xLjQK...",
   *     "envelope_id": "uuid",
   *     "expires_at": "2026-02-19T10:35:00.000Z",
   *     "process_id": "uuid"
   *   }
   * }
   */
  @Post('preview')
  @Roles(UserRole.SPECIALIST, UserRole.ADMIN)
  @UseGuards(RateLimitGuard)
  @RateLimit({ windowMs: 60, max: 10 })
  async previewContract(
    @Body() previewContractDto: PreviewContractDto,
    @Request() req: RequestWithUser,
  ): Promise<ApiResponseDto<PreviewContractResponseDto>> {
    const { id: userId, email: userEmail } = req.user;

    this.logger.log(
      `Criando preview de contrato para usuário ${userId} (${userEmail})`,
    );
    this.logger.debug(
      `Process: ${previewContractDto.process_id}`,
    );

    const preview = await this.contractsService.previewContract(
      previewContractDto,
      userId,
    );

    this.logger.log(
      `Preview criado com sucesso. EnvelopeID: ${preview.envelope_id}`,
    );

    return {
      sucess: true,
      message: 'Preview criado com sucesso. A URL expira em 10 minutos.',
      data: preview,
    };
  }

  /**
   * POST /api/contracts/send/:envelopeId
   *
   * Envia um contrato que está em modo preview (draft) e salva no banco.
   *
   * Este endpoint é chamado após o usuário visualizar e confirmar o preview.
   * Ele envia o envelope no DocuSign e persiste o contrato no banco de dados.
   *
   * Segurança:
   * - Apenas SPECIALIST e ADMIN podem acessar
   * - Rate limit: 10 requisições por minuto
   *
   * @param envelopeId - ID do envelope no DocuSign
   * @param previewContractDto - Dados originais do contrato
   * @param req - Requisição com usuário autenticado
   * @returns ApiResponseDto<SendContractResponseDto>
   *
   * @example
   * POST /contracts/send/93be49ab-xxxx-xxxx-xxxx-f752070d71ec
   * Authorization: Bearer <JWT_TOKEN>
   *
   * Body:
   * {
   *   "process_id": "uuid",
   *   "return_url": "...",
   *   "seller_name": "Maria Santos",
   *   ...
   * }
   *
   * Response (201 Created):
   * {
   *   "success": true,
   *   "message": "Contrato enviado com sucesso",
   *   "data": {
   *     "id": "uuid",
   *     "envelope_id": "uuid",
   *     "process_id": "uuid",
   *     "status": "PENDING",
   *     "created_at": "2026-02-18T10:30:00.000Z"
   *   }
   * }
   */
  @Post('send/:envelopeId')
  @Roles(UserRole.SPECIALIST, UserRole.ADMIN)
  @UseGuards(RateLimitGuard)
  @RateLimit({ windowMs: 60, max: 10 })
  async sendContractAfterPreview(
    @Param('envelopeId') envelopeId: string,
    @Body() previewContractDto: PreviewContractDto,
    @Request() req: RequestWithUser,
  ): Promise<ApiResponseDto<SendContractResponseDto>> {
    const { id: userId, email: userEmail } = req.user;

    this.logger.log(
      `Enviando contrato após preview para usuário ${userId} (${userEmail})`,
    );
    this.logger.debug(
      `EnvelopeID: ${envelopeId}, Process: ${previewContractDto.process_id}`,
    );

    const result = await this.contractsService.sendContractAfterPreview(
      envelopeId,
      previewContractDto,
      userId,
    );

    this.logger.log(
      `Contrato enviado com sucesso. ID: ${result.id}, EnvelopeID: ${result.envelope_id}`,
    );

    return {
      sucess: true,
      message: 'Contrato enviado para assinatura com sucesso',
      data: result,
    };
  }

  /**
   * POST /api/contracts/cancel-preview/:envelopeId
   *
   * Cancela um envelope de preview que não será enviado.
   *
   * Este endpoint deve ser chamado se o usuário decidir não enviar
   * o contrato após visualizar o preview.
   *
   * @param envelopeId - ID do envelope no DocuSign
   * @param req - Requisição com usuário autenticado
   * @returns ApiResponseDto<void>
   */
  @Post('cancel-preview/:envelopeId')
  @Roles(UserRole.SPECIALIST, UserRole.ADMIN)
  async cancelPreview(
    @Param('envelopeId') envelopeId: string,
    @Request() req: RequestWithUser,
  ): Promise<ApiResponseDto<null>> {
    const { id: userId, email: userEmail } = req.user;

    this.logger.log(`Cancelando preview para usuário ${userId} (${userEmail})`);
    this.logger.debug(`EnvelopeID: ${envelopeId}`);

    await this.contractsService.cancelPreview(
      envelopeId,
      `Cancelado pelo usuário ${userEmail}`,
    );

    this.logger.log(`Preview cancelado com sucesso. EnvelopeID: ${envelopeId}`);

    return {
      sucess: true,
      message: 'Preview cancelado com sucesso',
      data: null,
    };
  }
}
