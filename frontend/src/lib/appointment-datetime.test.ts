import { describe, expect, it } from "vitest";
import { browserTimeZone, localDateTimeToIso } from "./appointment-datetime";

describe("appointment datetime helpers", () => {
  it("converts a future local datetime to ISO", () => {
    expect(localDateTimeToIso("2099-09-20T14:30")).toBe(
      new Date("2099-09-20T14:30").toISOString(),
    );
  });

  it.each(["", "invalid"])("rejects invalid input %j", (value) => {
    expect(() => localDateTimeToIso(value)).toThrow(
      "Selecione uma data e hora válidas",
    );
  });

  it("rejects a datetime in the past", () => {
    expect(() => localDateTimeToIso("2000-01-01T00:00")).toThrow(
      "Selecione uma data e hora futuras",
    );
  });

  it("returns a visible browser timezone label", () => {
    expect(browserTimeZone().trim().length).toBeGreaterThan(0);
  });
});
