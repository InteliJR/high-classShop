/**
 * Exceções Customizadas para o Sistema de Contratos
 *
 * Cada exceção herda de HttpException e mapeia para um status HTTP apropriado.
 * Estrutura:
 * - Exceções de Validação: 400 Bad Request
 * - Exceções de Autorização: 403 Forbidden
 * - Exceções de Não Encontrado: 404 Not Found
 * - Exceções de Conflito: 409 Conflict
 * - Exceções de Provedor: 502/503 Bad/Service Unavailable
 * - Exceções de Sistema: 500 Internal Server Error
 */

import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * VALIDAÇÃO DE ENTRADA
 */

/**
 * PDF inválido (formato corrompido, MIME type incorreto, etc.)
 * Status HTTP: 400
 */
export class InvalidPdfException extends HttpException {
  constructor(message: string = 'PDF fornecido é inválido ou corrompido') {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'INVALID_PDF',
        message,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Arquivo com tamanho excedido (maior que limite permitido)
 * Status HTTP: 413
 */
export class FileTooLargeException extends HttpException {
  constructor(
    maxSizeInMb: number = 10,
    message: string = `Arquivo muito grande. Máximo: ${maxSizeInMb}MB`,
  ) {
    super(
      {
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        error: 'FILE_TOO_LARGE',
        message,
      },
      HttpStatus.PAYLOAD_TOO_LARGE,
    );
  }
}

/**
 * MIME type do arquivo não permitido
 * Status HTTP: 400
 */
export class InvalidMimeTypeException extends HttpException {
  constructor(
    receivedMimeType: string = 'unknown',
    allowedMimeTypes: string[] = ['application/pdf'],
  ) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'INVALID_MIME_TYPE',
        message: `MIME type '${receivedMimeType}' não permitido. Tipos aceitos: ${allowedMimeTypes.join(', ')}`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * INTEGRIDADE DE NEGÓCIO
 */

/**
 * Processo não encontrado no banco de dados
 * Status HTTP: 404
 */
export class ProcessNotFoundException extends HttpException {
  constructor(processId: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'PROCESS_NOT_FOUND',
        message: `Processo com ID '${processId}' não encontrado ou não pertence ao usuário`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

/**
 * Usuário (signer) não encontrado ou não existe
 * Status HTTP: 404
 */
export class SignerNotFoundException extends HttpException {
  constructor(email: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'SIGNER_NOT_FOUND',
        message: `Usuário com email '${email}' não encontrado no sistema`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

/**
 * Usuário não tem permissão para criar contrato para este processo
 * Status HTTP: 403
 */
export class UnauthorizedContractCreationException extends HttpException {
  constructor(userId: string, processId: string) {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'UNAUTHORIZED_CONTRACT_CREATION',
        message: `Usuário '${userId}' não tem permissão para criar contrato no processo '${processId}'`,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

/**
 * Contrato já existe para este processo
 * Status HTTP: 409
 */
export class ContractAlreadyExistsException extends HttpException {
  constructor(processId: string) {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        error: 'CONTRACT_ALREADY_EXISTS',
        message: `Já existe um contrato para o processo '${processId}'. Não é permitido criar múltiplos contratos`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

/**
 * PROVEDOR EXTERNO (DocuSign)
 */

/**
 * API do provedor (DocuSign) indisponível ou com erro
 * Status HTTP: 502 Bad Gateway
 */
export class ProviderUnavailableException extends HttpException {
  constructor(providerName: string = 'DocuSign', originalError?: string) {
    super(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        error: 'PROVIDER_UNAVAILABLE',
        message: `Serviço '${providerName}' está indisponível no momento. Tente novamente em poucos minutos.`,
        // Não exponha detalhes do erro original em produção
        ...(process.env.NODE_ENV === 'development' && {
          details: originalError,
        }),
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}

/**
 * Timeout na requisição para o provedor
 * Status HTTP: 504 Gateway Timeout
 */
export class ProviderTimeoutException extends HttpException {
  constructor(providerName: string = 'DocuSign', timeoutMs: number = 30000) {
    super(
      {
        statusCode: HttpStatus.GATEWAY_TIMEOUT,
        error: 'PROVIDER_TIMEOUT',
        message: `Requisição para '${providerName}' expirou após ${timeoutMs}ms. Tente novamente.`,
      },
      HttpStatus.GATEWAY_TIMEOUT,
    );
  }
}

/**
 * Falha ao criar envelope no DocuSign
 * Status HTTP: 502
 */
export class EnvelopeCreationFailedException extends HttpException {
  constructor(reason: string) {
    super(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        error: 'ENVELOPE_CREATION_FAILED',
        message: `Não foi possível criar o envelope de assinatura: ${reason}`,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}

/**
 * WEBHOOK E SEGURANÇA
 */

/**
 * Assinatura HMAC do webhook é inválida (possível ataque)
 * Status HTTP: 401
 */
export class InvalidWebhookSignatureException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.UNAUTHORIZED,
        error: 'INVALID_WEBHOOK_SIGNATURE',
        message:
          'Assinatura HMAC do webhook não é válida. Requisição rejeitada.',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * PDF PROCESSING
 */

/**
 * Erro ao processar/mesclar PDFs
 * Status HTTP: 400
 */
export class PdfProcessingException extends HttpException {
  constructor(reason: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'PDF_PROCESSING_ERROR',
        message: `Erro ao processar PDF: ${reason}. PDF pode estar corrompido.`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * S3 STORAGE
 */

/**
 * Falha ao fazer upload para S3
 * Status HTTP: 502
 */
export class S3UploadFailedException extends HttpException {
  constructor(fileName: string, reason?: string) {
    super(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        error: 'S3_UPLOAD_FAILED',
        message: `Falha ao fazer upload do arquivo '${fileName}' para o storage. Tente novamente.`,
        ...(process.env.NODE_ENV === 'development' && { details: reason }),
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}

/**
 * SISTEMA
 */

/**
 * Erro inesperado no servidor (fallback genérico)
 * Status HTTP: 500
 */
export class InternalSystemException extends HttpException {
  constructor(operationName: string, originalError?: Error) {
    // Em produção, não exponha o stack trace ou mensagem original do erro
    const isProduction = process.env.NODE_ENV === 'production';

    super(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'INTERNAL_SERVER_ERROR',
        message: isProduction
          ? 'Erro interno do servidor. Por favor, contate o suporte.'
          : `Erro interno ao executar '${operationName}'`,
        ...(process.env.NODE_ENV === 'development' && {
          originalMessage: originalError?.message,
          stack: originalError?.stack?.split('\n').slice(0, 5), // Apenas primeiras 5 linhas
        }),
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * TIPO: Exceção de Transação (quando Prisma.$transaction falha)
 */
export class TransactionFailedException extends HttpException {
  constructor(reason: string) {
    super(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'TRANSACTION_FAILED',
        message: `Erro ao processar transação do contrato: ${reason}. O contrato pode estar em estado inconsistente.`,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
