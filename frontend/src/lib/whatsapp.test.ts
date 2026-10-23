import { describe, expect, it } from "vitest";
import { buildWhatsAppHref } from "./whatsapp";

describe("WhatsApp contact links", () => {
  it.each([
    ["(11) 98765-4321", "5511987654321"],
    ["+55 11 98765-4321", "5511987654321"],
    ["(11) 3456-7890", "551134567890"],
    ["55 11 3456-7890", "551134567890"],
    ["(55) 98765-4321", "5555987654321"],
  ])("normalizes Brazilian contact %s", (phone, digits) => {
    expect(buildWhatsAppHref(phone)).toBe(`https://wa.me/${digits}`);
  });

  it.each(["", "123", "abc", "+1 234 567 89012", "551198765432100", "123456789012"])(
    "does not link invalid contact %j", (phone) => {
      expect(buildWhatsAppHref(phone)).toBeNull();
    },
  );
});
