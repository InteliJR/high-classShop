import { describe, expect, it } from "vitest";
import { buildEmailSchedulingLinks } from "./email-scheduling";

const input = {
  recipient: "ana@example.com",
  specialistName: "Ana",
  clientName: "João",
  productLabel: "Carro A&B?#",
  appointmentDatetime: "2026-10-20T17:30:00.000Z",
  timeZone: "America/Sao_Paulo",
};

describe("email scheduling links", () => {
  it("encodes each field independently for mailto and Gmail", () => {
    const links = buildEmailSchedulingLinks(input);
    const mailto = new URL(links.mailtoHref);
    const gmail = new URL(links.gmailHref);
    expect(decodeURIComponent(mailto.pathname)).toBe(input.recipient);
    expect(mailto.searchParams.get("subject")).toBe(links.subject);
    expect(mailto.searchParams.get("body")).toBe(links.body);
    expect(links.subject).toContain(input.productLabel);
    expect(links.body).toContain(input.clientName);
    expect(links.body).toContain(input.specialistName);
    expect(links.body).toContain(input.productLabel);
    expect(mailto.searchParams.size).toBe(2);
    expect(links.mailtoHref).toContain("%26B%3F%23");
    expect(gmail.origin + gmail.pathname).toBe("https://mail.google.com/mail/");
    expect(gmail.searchParams.get("view")).toBe("cm");
    expect(gmail.searchParams.get("fs")).toBe("1");
    expect(gmail.searchParams.get("to")).toBe(input.recipient);
    expect(gmail.searchParams.get("su")).toBe(links.subject);
    expect(gmail.searchParams.get("body")).toBe(links.body);
  });

  it("shows the proposed instant in the provided IANA timezone", () => {
    const { body } = buildEmailSchedulingLinks(input);
    expect(body).toContain("20/10/2026 14:30 (America/Sao_Paulo)");
    expect(body).toContain("\n");
  });

  it("removes header line breaks and encodes hostile recipient delimiters", () => {
    const links = buildEmailSchedulingLinks({
      ...input,
      recipient: "ana@example.com\r\nBcc:evil@example.com?subject=evil&bcc=x#y",
      productLabel: "Carro\r\nBcc:evil@example.com",
    });
    // Body line breaks are intentional; sanitize only the recipient and subject headers.
    expect(decodeURIComponent(new URL(links.mailtoHref).pathname)).not.toContain("\r\nBcc:");
    expect(links.subject).not.toMatch(/[\r\n]/);
    expect(new URL(links.mailtoHref).searchParams.size).toBe(2);
    expect(new URL(links.gmailHref).searchParams.get("to")).not.toMatch(/[\r\n]/);
  });

  it("bounds the subject and body without breaking Unicode encoding", () => {
    const links = buildEmailSchedulingLinks({
      ...input,
      productLabel: "🚗".repeat(1000),
      clientName: "á".repeat(3000),
    });
    expect(Array.from(links.subject).length).toBeLessThanOrEqual(160);
    expect(Array.from(links.body).length).toBeLessThanOrEqual(1800);
    expect(links.body).toContain("20/10/2026 14:30 (America/Sao_Paulo)");
    expect(links.body).toContain(input.specialistName);
    expect(links.body).toContain("á");
    expect(links.body).toContain("🚗");
    expect(new URL(links.mailtoHref).searchParams.get("subject")).toBe(links.subject);
    expect(new URL(links.gmailHref).searchParams.get("body")).toBe(links.body);
  });

  it("rejects an invalid instant or timezone", () => {
    expect(() => buildEmailSchedulingLinks({ ...input, appointmentDatetime: "invalid" })).toThrow();
    expect(() => buildEmailSchedulingLinks({ ...input, timeZone: "invalid" })).toThrow();
    expect(() => buildEmailSchedulingLinks({ ...input, timeZone: "" })).toThrow();
  });
});
