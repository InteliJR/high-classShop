import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validates if a CPF (Cadastro de Pessoas Físicas) is valid
 * CPF must be 11 digits and pass the verification algorithm
 */
@ValidatorConstraint({ name: 'isValidCPF', async: false })
export class IsValidCPFConstraint implements ValidatorConstraintInterface {
  validate(cpf: string): boolean {
    if (!cpf) return false;

    // Remove any non-digit characters
    const cleanCPF = cpf.replace(/\D/g, '');

    // CPF must have exactly 11 digits
    if (cleanCPF.length !== 11) return false;

    // Check if all digits are the same (invalid CPFs like 111.111.111-11)
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

    // Validate first verification digit
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(9))) return false;

    // Validate second verification digit
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(10))) return false;

    return true;
  }

  defaultMessage(): string {
    return 'CPF inválido';
  }
}

/**
 * Decorator to validate CPF
 * @param validationOptions - Class-validator validation options
 */
export function IsValidCPF(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidCPFConstraint,
    });
  };
}
