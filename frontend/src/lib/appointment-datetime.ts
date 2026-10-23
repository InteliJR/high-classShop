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

/** Parses an ISO instant with an explicit offset, rejecting normalized invalid calendar dates. */
export function parseAppointmentIso(value: string): Date {
  const match = typeof value === "string"
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/.exec(value)
    : null;
  if (!match) throw new Error("Selecione uma data e hora válidas");

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const parsed = new Date(value);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]
    || Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText ?? 0) > 59
    || Number.isNaN(parsed.getTime())) {
    throw new Error("Selecione uma data e hora válidas");
  }
  return parsed;
}

/** Local wall-clock value; callers retain the original ISO when this value is unchanged. */
export function isoToLocalDateTimeInput(iso: string): string {
  const date = parseAppointmentIso(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
