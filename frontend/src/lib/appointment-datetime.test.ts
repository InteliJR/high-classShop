import { describe, expect, it } from "vitest";
import { browserTimeZone, isoToLocalDateTimeInput, localDateTimeToIso, parseAppointmentIso } from "./appointment-datetime";

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

  it.each([
    "2026-10-20T17:30:45.123Z",
    "2026-11-01T05:30:45.123Z",
    "2026-11-01T06:30:45.123Z",
  ])("renders existing instant %s using local calendar fields rather than UTC", (iso) => {
    const date = new Date(iso);
    const pad = (value: number) => String(value).padStart(2, "0");
    expect(isoToLocalDateTimeInput(iso)).toBe(
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`,
    );
  });

  it.each(["", "invalid"])("rejects an invalid existing ISO %j", (iso) => {
    expect(() => isoToLocalDateTimeInput(iso)).toThrow("Selecione uma data e hora válidas");
  });

  it.each([
    ["2026-10-20T14:30:45.123-03:00", "2026-10-20T17:30:45.123Z"],
    ["2028-02-29T17:30Z", "2028-02-29T17:30:00.000Z"],
  ])("parses valid explicit-offset instant %s", (iso, expected) => {
    expect(parseAppointmentIso(iso).toISOString()).toBe(expected);
  });

  it.each(["2026-02-29T17:30Z", "2026-00-20T17:30Z", "2026-10-20T17:60Z", "2026-10-20T17:30:60Z", "2026-10-20T17:30", "2026-10-20T17:30+03:60"])("rejects impossible or offsetless ISO %s", (iso) => {
    expect(() => parseAppointmentIso(iso)).toThrow("Selecione uma data e hora válidas");
  });
});
