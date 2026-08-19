import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export function localizedValidationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  const messages = collectValidationMessages(errors);

  return new BadRequestException({
    statusCode: 400,
    message:
      messages.length > 0 ? messages : ['Os dados informados não são válidos.'],
    error: 'Requisição inválida',
  });
}

function collectValidationMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}).map((message) =>
      error.constraints?.whitelistValidation
        ? `O campo ${error.property} não é permitido.`
        : message,
    ),
    ...collectValidationMessages(error.children ?? []),
  ]);
}
