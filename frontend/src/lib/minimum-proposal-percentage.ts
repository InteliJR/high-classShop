function stableDecimal(value: number): string {
  return String(Number(value.toFixed(10)));
}

export function fractionToPercentageInput(value: string): string {
  const fraction = Number(value);
  return Number.isFinite(fraction)
    ? stableDecimal(fraction * 100)
    : value;
}

export function percentageInputToFraction(value: string): string {
  const percentage = Number(value);
  return Number.isFinite(percentage)
    ? stableDecimal(percentage / 100)
    : value;
}
