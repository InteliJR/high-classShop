import {
  Body,
  Controller,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  HttpStatus,
  BadRequestException,
  Logger,
  Injectable,
  PipeTransform,
  ArgumentMetadata,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiResponseDto } from 'src/shared/dto/api-response.dto';
import { ContractResponse } from './entity/contracts.response';
import { AuthGuard } from 'src/auth/auth.guard';
import type { RequestWithUser } from 'src/auth/dto/auth';
import { validatePdfFile } from 'src/shared/validators/pdf.validator';
import { InvalidPdfException } from 'src/shared/exceptions/custom-exceptions';

/**
 * Pipe customizado para validar arquivo PDF antes de processar
 *
 * Responsabilidades:
 * - Verificar se arquivo foi fornecido
 * - Validar MIME type
 * - Validar Magic Number (assinatura do arquivo)
 * - Verificar tamanho máximo
 *
 * Por que usar Pipe: Realiza validação no nível de middleware,
 * antes do controller executar a lógica de negócio
 */
@Injectable()
export class PdfValidationPipe implements PipeTransform {
  private readonly logger = new Logger(PdfValidationPipe.name);

  transform(
    file: Express.Multer.File,
    metadata: ArgumentMetadata,
  ): Express.Multer.File {
    // Validação 1: Arquivo foi fornecido?
    if (!file) {
      this.logger.warn('Arquivo PDF não foi fornecido na requisição');
      throw new InvalidPdfException('Nenhum arquivo PDF foi fornecido');
    }

    // Validação 2: MIME type, Magic Number e tamanho
    try {
      validatePdfFile(file.buffer, file.mimetype, file.originalname);
    } catch (error) {
      this.logger.warn(
        `Validação de PDF falhou para arquivo '${file.originalname}': ${error.message}`,
      );
      throw error;
    }

    this.logger.debug(`PDF válido: ${file.originalname} (${file.size} bytes)`);
    return file;
  }
}

/**
 * Controller para gerenciar contratos.
 *
 * Responsabilidades:
 * - Receber upload de PDF via multipart/form-data
 * - Validar autenticação (AuthGuard)
 * - Validar arquivo PDF (PdfValidationPipe)
 * - Delegar processamento para ContractsService
 *
 * Segurança:
 * - FileInterceptor: Limita tamanho de arquivo no middleware
 * - PdfValidationPipe: Valida MIME type e Magic Number
 * - AuthGuard: Garante que apenas usuários autenticados podem criar contratos
 */
@Controller('contracts')
export class ContractsController {
  private readonly logger = new Logger(ContractsController.name);

  constructor(private readonly contractsService: ContractsService) {}

  /**
   * POST /api/contracts
   *
   * Cria um novo contrato com DocuSign.
   *
   * Fluxo:
   * 1. Valida autenticação (AuthGuard)
   * 2. Recebe e valida PDF (PdfValidationPipe)
   * 3. Valida DTO (class-validator)
   * 4. Processa PDF (merge com página de assinatura)
   * 5. Envia para DocuSign (cria envelope)
   * 6. Salva no banco de dados em transação atômica
   * 7. Retorna informações do contrato criado
   *
   * Validações Aplicadas:
   * - ✅ Usuário autenticado
   * - ✅ Arquivo PDF fornecido
   * - ✅ MIME type == application/pdf
   * - ✅ Magic Number válido (%PDF)
   * - ✅ Tamanho máximo 10MB
   * - ✅ PDF não corrompido (tem %%EOF)
   * - ✅ process_id é UUID válido
   * - ✅ client_email é email válido
   * - ✅ description < 1000 caracteres
   *
   * @param file - Arquivo PDF enviado pelo usuário (multipart/form-data, campo 'file')
   * @param createContractDto - DTO com dados textuais (process_id, client_email, description)
   * @param req - Requisição com usuário autenticado
   * @returns ApiResponseDto<ContractResponse> - Resposta com dados do contrato criado
   *
   * @throws InvalidPdfException - Se PDF não é válido
   * @throws FileTooLargeException - Se PDF > 10MB
   * @throws ProcessNotFoundException - Se process_id não existe
   * @throws SignerNotFoundException - Se client_email não existe
   * @throws UnauthorizedContractCreationException - Se usuário não tem permissão
   * @throws ProviderUnavailableException - Se DocuSign está fora
   * @throws S3UploadFailedException - Se falhar upload para S3
   *
   * @example
   * POST /contracts
   * Authorization: Bearer <JWT_TOKEN>
   * Content-Type: multipart/form-data
   *
   * Body:
   * {
   *   "file": <arquivo PDF>,
   *   "process_id": "550e8400-e29b-41d4-a716-446655440000",
   *   "client_email": "cliente@example.com",
   *   "description": "Contrato de compra de Ferrari Testarossa"
   * }
   *
   * Response (201 Created):
   * {
   *   "success": true,
   *   "message": "Contrato enviado para assinatura com sucesso",
   *   "data": {
   *     "id": "uuid",
   *     "file_name": "contract.pdf",
   *     "process_id": "uuid",
   *     "created_at": "2025-12-16T10:30:00Z"
   *   }
   * }
   */
  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile(new PdfValidationPipe()) file: Express.Multer.File,
    @Body() createContractDto: CreateContractDto,
    @Request() req: RequestWithUser,
  ): Promise<ApiResponseDto<ContractResponse>> {
    const { id: userId, email: userEmail } = req.user;

    this.logger.log(
      `Iniciando criação de contrato para usuário ${userId} (${userEmail})`,
    );
    this.logger.debug(
      `PDF: ${file.originalname}, Tamanho: ${file.size} bytes, Process: ${createContractDto.process_id}`,
    );

    const contract = await this.contractsService.create(
      file,
      createContractDto,
      userId,
      userEmail,
    );

    this.logger.log(
      `Contrato criado com sucesso. ID: ${contract.id}, Process: ${contract.process_id}`,
    );

    return {
      sucess: true,
      message: 'Contrato enviado para assinatura com sucesso',
      data: contract,
    };
  }
}
