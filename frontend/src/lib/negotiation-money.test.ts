import { describe, expect, it } from "vitest";
import {
  getProposalSubmissionError,
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

  it("hides minimum even when an outdated API marks it as enabled", () => {
    expect(
      getMinimumPresentation({
        currency: "USD",
        minimum_enabled: true,
        minimum_value: 80000,
      }),
    ).toEqual({ visible: false, formattedValue: null });
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

  it("clears a legacy minimum error even when an outdated API enables it", () => {
    expect(
      normalizeMinimumFormError(
        "O valor mínimo permitido é US$ 80.000,00.",
        {
          currency: "USD",
          minimum_enabled: true,
          minimum_value: 80000,
        },
      ),
    ).toBeNull();
  });
});

describe("proposal submission decision", () => {
  it("does not block a positive value using a cached minimum", () => {
    expect(getProposalSubmissionError(1)).toBeNull();
  });

  it.each([Number.NaN, 0, -1])("rejects an invalid local value: %s", (value) => {
    expect(getProposalSubmissionError(value)).toBe(
      "Por favor, insira um valor válido",
    );
  });
});
