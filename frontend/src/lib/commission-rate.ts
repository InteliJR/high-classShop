export type CommissionRateParseResult =
  | { ok: true; value: number }
  | { ok: false; message: string };

export function parseCommissionRateInput(
  raw: string,
): CommissionRateParseResult {
  const value = raw.trim();
  if (!value) {
    return { ok: false, message: "Informe a comissão do especialista." };
  }

  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return { ok: false, message: "A comissão deve ser um número." };
  }
  if (parsed < 0 || parsed > 100) {
    return {
      ok: false,
      message: "A comissão deve estar entre 0% e 100%.",
    };
  }
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) {
    return {
      ok: false,
      message: "A comissão deve ter no máximo duas casas decimais.",
    };
  }

  return { ok: true, value: parsed };
}

export function effectiveCommissionRate(rate?: number | null): number {
  return rate ?? 0;
}

export function isCommissionConfigured(rate?: number | null): rate is number {
  return rate != null;
}
