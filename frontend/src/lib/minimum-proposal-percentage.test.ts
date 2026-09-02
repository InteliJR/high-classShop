import { describe, expect, it } from "vitest";
import {
  fractionToPercentageInput,
  percentageInputToFraction,
} from "./minimum-proposal-percentage";

describe("minimum proposal percentage units", () => {
  it("displays stored fraction 0.8 as 80", () => {
    expect(fractionToPercentageInput("0.8")).toBe("80");
  });

  it("saves displayed 80 as fraction 0.8", () => {
    expect(percentageInputToFraction("80")).toBe("0.8");
  });

  it("keeps decimal percentages stable without floating point artifacts", () => {
    expect(fractionToPercentageInput("0.333")).toBe("33.3");
    expect(percentageInputToFraction("33.3")).toBe("0.333");
  });
});
