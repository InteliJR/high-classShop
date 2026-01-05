/**
 * Filtro Global de Exceções
 *
 * Responsabilidades:
 * - Capturar TODAS as exceções não tratadas
 * - Converter em respostas HTTP padronizadas
 * - NÃO expor detalhes de infraestrutura em PRODUÇÃO
 * - Logs detalhados para debugging
 *
 * Por que global:
 * - Garante consistência nas respostas de erro
 * - Evita que stack traces vazem para cliente
 * - Centraliza tratamento de erros
 * - Facilita auditoria e debugging
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    // Determinar status HTTP e mensagem
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Erro interno do servidor';
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let details: any = null;

    // ===== EXCEÇÕES HTTP (NestJS) =====
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Se é objeto customizado, extrair campos
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const obj = exceptionResponse as any;
        message = obj.message || obj.error || exception.message;
        errorCode = obj.error || errorCode;
        details = obj.details || null;
      } else {
        message = exceptionResponse as string;
      }

      this.logger.warn(`HTTP Exception [${status}] ${errorCode}: ${message}`, {
        path: request.url,
        method: request.method,
      });
    }
    // ===== EXCEÇÕES PRISMA =====
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Erros conhecidos do Prisma (P2000, P2001, etc.)
      const prismaError = exception as Prisma.PrismaClientKnownRequestError;
      status = this.getPrismaHttpStatus(prismaError.code);
      message = this.getPrismaErrorMessage(prismaError);
      errorCode = `PRISMA_${prismaError.code}`;

      this.logger.error(
        `Prisma Error [${prismaError.code}] ${message}`,
        prismaError.stack,
      );
    }
    // ===== EXCEÇÕES DE VALIDAÇÃO =====
    else if (exception instanceof Error) {
      // Erros genéricos (validação, etc.)
      message = exception.message;
      errorCode = 'VALIDATION_ERROR';

      // Não expor stack trace em produção
      if (process.env.NODE_ENV === 'development') {
        details = {
          stack: exception.stack?.split('\n').slice(0, 5),
        };
      }

      this.logger.error(
        `Error [${exception.name}]: ${message}`,
        exception.stack,
      );
    } else {
      // Erro completamente desconhecido
      const errorString = String(exception);
      message = 'Erro inesperado do servidor';
      errorCode = 'UNKNOWN_ERROR';

      this.logger.error(`Unknown Error: ${errorString}`, exception);
    }

    // ===== CONSTRUIR RESPOSTA =====

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: errorCode,
      message,
      ...(details && { details }), // Incluir detalhes apenas se disponível
    };

    // Responder
    response.status(status).json(errorResponse);
  }

  /**
   * Mapeia código de erro Prisma para status HTTP
   */
  private getPrismaHttpStatus(code: string): HttpStatus {
    switch (code) {
      case 'P2000': // String muito longa
        return HttpStatus.BAD_REQUEST;
      case 'P2001': // Registro não encontrado
        return HttpStatus.NOT_FOUND;
      case 'P2002': // Unique constraint
        return HttpStatus.CONFLICT;
      case 'P2003': // Foreign key constraint
        return HttpStatus.BAD_REQUEST;
      case 'P2004': // Constraint violation
        return HttpStatus.BAD_REQUEST;
      case 'P2014': // Required relation
        return HttpStatus.BAD_REQUEST;
      case 'P2015': // Registro relacionado não encontrado
        return HttpStatus.NOT_FOUND;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }

  /**
   * Mapeia código de erro Prisma para mensagem legível
   */
  private getPrismaErrorMessage(
    error: Prisma.PrismaClientKnownRequestError,
  ): string {
    const meta = error.meta as any;

    switch (error.code) {
      case 'P2000':
        return `O valor fornecido é muito longo para o campo ${meta?.column_name || 'desconhecido'}`;
      case 'P2001':
        return 'Registro não encontrado';
      case 'P2002': {
        const fields = (meta?.target as string[]) || [];
        return `Já existe um registro com ${fields.join(', ')} informado(s)`;
      }
      case 'P2003':
        return `Violação de chave estrangeira: registro relacionado não existe`;
      case 'P2004':
        return 'Violação de constraint no banco de dados';
      case 'P2014':
        return 'Não é possível criar/atualizar registro: relacionamento obrigatório não existe';
      case 'P2015':
        return 'Registro relacionado não encontrado';
      default:
        return `Erro no banco de dados [${error.code}]`;
    }
  }
}
