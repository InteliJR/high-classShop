import { describe, expect, it } from "vitest";
import { formatCurrency } from "./currency";

describe("formatCurrency", () => {
  it("formats BRL by default", () => {
    expect(formatCurrency(2500)).toBe("R$ 2.500,00");
  });

  it("formats USD without converting the original amount", () => {
    expect(formatCurrency(2500, "USD")).toBe("US$ 2.500,00");
  });
});
