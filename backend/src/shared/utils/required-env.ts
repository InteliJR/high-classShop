export function requiredEnv(
  value: string | undefined,
  name: string,
): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}
