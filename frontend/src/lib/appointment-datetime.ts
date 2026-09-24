export function localDateTimeToIso(value: string): string {
  const parsed = new Date(value);

  if (!value || Number.isNaN(parsed.getTime())) {
    throw new Error("Selecione uma data e hora válidas");
  }

  if (parsed.getTime() <= Date.now()) {
    throw new Error("Selecione uma data e hora futuras");
  }

  return parsed.toISOString();
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "horário local";
}
