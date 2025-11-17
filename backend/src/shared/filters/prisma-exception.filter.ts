import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Filtro para exceções do Prisma
 * Converte erros do Prisma em respostas HTTP apropriadas
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const { status, message } = this.handlePrismaError(exception);

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      code: exception.code,
    };

    this.logger.error(
      `Prisma Error [${exception.code}]: ${message}`,
      exception.stack,
    );

    response.status(status).json(errorResponse);
  }

  private handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status: HttpStatus;
    message: string;
  } {
    switch (error.code) {
      case 'P2000':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'O valor fornecido é muito longo para o campo',
        };

      case 'P2001':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Registro não encontrado',
        };

      case 'P2002': {
        const fields = (error.meta?.target as string[]) || ['campo'];
        return {
          status: HttpStatus.CONFLICT,
          message: `Já existe um registro com ${fields.join(', ')} informado(s)`,
        };
      }

      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Violação de chave estrangeira. Registro relacionado não existe',
        };

      case 'P2004':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Violação de constraint no banco de dados',
        };

      case 'P2014':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Violação de relacionamento obrigatório',
        };

      case 'P2015':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Registro relacionado não encontrado',
        };

      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Registro não encontrado para atualização ou exclusão',
        };

      default:
        this.logger.error(`Erro Prisma não mapeado: ${error.code}`, error);
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Erro no banco de dados',
        };
    }
  }
}

