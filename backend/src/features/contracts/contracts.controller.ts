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
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { GenerateContractDto } from './dto/generate-contract.dto';
import { PrefillContractResponseDto } from './dto/prefill-contract-response.dto';
import { ApiResponseDto } from 'src/shared/dto/api-response.dto';
import { ContractResponse } from './entity/contracts.response';
import type { RequestWithUser } from 'src/auth/dto/auth';

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
}
