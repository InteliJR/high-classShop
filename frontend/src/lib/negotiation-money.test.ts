import { describe, expect, it } from "vitest";
import {
  getMinimumPresentation,
  normalizeMinimumFormError,
} from "./negotiation-money";

describe("minimum presentation", () => {
  it("hides minimum when the admin disables it", () => {
    expect(
      getMinimumPresentation({
        currency: "USD",
        minimum_enabled: false,
        minimum_value: null,
      }),
    ).toEqual({ visible: false, formattedValue: null });
  });

  it("hides a disabled minimum even when the API still returns a value", () => {
    expect(
      getMinimumPresentation({
        currency: "USD",
        minimum_enabled: false,
        minimum_value: 80000,
      }),
    ).toEqual({ visible: false, formattedValue: null });
  });

  it("hides minimum when an enabled process has no minimum value", () => {
    expect(
      getMinimumPresentation({
        currency: "BRL",
        minimum_enabled: true,
        minimum_value: null,
      }),
    ).toEqual({ visible: false, formattedValue: null });
  });

  it("formats an enabled minimum in the process currency", () => {
    expect(
      getMinimumPresentation({
        currency: "USD",
        minimum_enabled: true,
        minimum_value: 80000,
      }),
    ).toEqual({ visible: true, formattedValue: "US$ 80.000,00" });
  });
});

describe("minimum form error normalization", () => {
  const hiddenMinimum = {
    currency: "USD" as const,
    minimum_enabled: false,
    minimum_value: 80000,
  };

  it("clears an obsolete minimum error when the minimum is hidden", () => {
    expect(
      normalizeMinimumFormError(
        "O valor mínimo permitido é US$ 80.000,00.",
        hiddenMinimum,
      ),
    ).toBeNull();
  });

  it("preserves an unrelated error when the minimum is hidden", () => {
    expect(
      normalizeMinimumFormError("Erro ao enviar proposta.", hiddenMinimum),
    ).toBe("Erro ao enviar proposta.");
  });
});
