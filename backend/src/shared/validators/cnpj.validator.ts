import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validates if a CNPJ (Cadastro Nacional da Pessoa Jurídica) is valid
 * CNPJ must be 14 digits and pass the verification algorithm
 */
@ValidatorConstraint({ name: 'isValidCNPJ', async: false })
export class IsValidCNPJConstraint implements ValidatorConstraintInterface {
  validate(cnpj: string): boolean {
    if (!cnpj) return false;

    const cleanCNPJ = cnpj.replace(/\D/g, '');

    // CNPJ must have exactly 14 digits
    if (cleanCNPJ.length !== 14) return false;

    // Check if all digits are the same (invalid CNPJs like 11.111.111/1111-11)
    if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;

    const calculateDigit = (base: string): number => {
      const weights =
        base.length === 12
          ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
          : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      let sum = 0;
      for (let i = 0; i < base.length; i++) {
        sum += parseInt(base.charAt(i)) * weights[i];
      }
      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };

    const firstDigit = calculateDigit(cleanCNPJ.substring(0, 12));
    if (firstDigit !== parseInt(cleanCNPJ.charAt(12))) return false;

    const secondDigit = calculateDigit(cleanCNPJ.substring(0, 13));
    if (secondDigit !== parseInt(cleanCNPJ.charAt(13))) return false;

    return true;
  }

  defaultMessage(): string {
    return 'CNPJ inválido';
  }
}

/**
 * Decorator to validate CNPJ
 * @param validationOptions - Class-validator validation options
 */
export function IsValidCNPJ(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidCNPJConstraint,
    });
  };
}
