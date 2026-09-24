import { describe, expect, it } from "vitest";
import {
  effectiveCommissionRate,
  isCommissionConfigured,
  parseCommissionRateInput,
} from "./commission-rate";

describe("commission-rate", () => {
  it.each([
    ["0", 0],
    ["12.34", 12.34],
    ["100", 100],
  ])("aceita %s", (raw, value) => {
    expect(parseCommissionRateInput(raw)).toEqual({ ok: true, value });
  });

  it.each(["", "-1", "100.01", "12.345", "abc"])(
    "rejeita %s",
    (raw) => expect(parseCommissionRateInput(raw).ok).toBe(false),
  );

  it("distingue comissão não configurada de zero configurado", () => {
    expect(effectiveCommissionRate(null)).toBe(0);
    expect(isCommissionConfigured(null)).toBe(false);
    expect(isCommissionConfigured(0)).toBe(true);
  });
});
