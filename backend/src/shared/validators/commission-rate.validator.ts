import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const MIN_COMMISSION_RATE = 0;
const MAX_COMMISSION_RATE = 100;
const MAX_DECIMAL_PLACES = 2;

function decimalPlaces(value: number): number {
  const [coefficient, exponentText] = value.toString().toLowerCase().split('e');
  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  const fractionLength = (coefficient.split('.')[1] ?? '').length;

  return Math.max(0, fractionLength - exponent);
}

export function hasValidCommissionRatePrecision(
  value: unknown,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    decimalPlaces(value) <= MAX_DECIMAL_PLACES
  );
}

export function isValidCommissionRate(value: unknown): value is number {
  return (
    hasValidCommissionRatePrecision(value) &&
    value >= MIN_COMMISSION_RATE &&
    value <= MAX_COMMISSION_RATE
  );
}

@ValidatorConstraint({ name: 'hasValidCommissionRatePrecision', async: false })
export class HasValidCommissionRatePrecisionConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    if (typeof value !== 'number' || !Number.isFinite(value)) return true;
    return hasValidCommissionRatePrecision(value);
  }

  defaultMessage(): string {
    return 'A comissão deve ter no máximo duas casas decimais.';
  }
}

export function HasValidCommissionRatePrecision(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: HasValidCommissionRatePrecisionConstraint,
    });
  };
}
