import { describe, expect, it } from "vitest";
import { getMinimumPresentation } from "./negotiation-money";

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
