import { describe, expect, it } from "vitest";
import {
  stripFormatting,
  applyCpfMask,
  applyCnpjMask,
  applyCepMask,
  applyRgMask,
  applyPhoneMask,
} from "./mask";

describe("stripFormatting", () => {
  it("remove tudo que não é dígito", () => {
    expect(stripFormatting("123.456.789-00")).toBe("12345678900");
    expect(stripFormatting("(11) 99999-9999")).toBe("11999999999");
    expect(stripFormatting("")).toBe("");
  });
});

describe("applyCpfMask", () => {
  it("aplica pontuação progressivamente enquanto digita", () => {
    expect(applyCpfMask("123")).toBe("123");
    expect(applyCpfMask("123456")).toBe("123.456");
    expect(applyCpfMask("123456789")).toBe("123.456.789");
    expect(applyCpfMask("12345678900")).toBe("123.456.789-00");
  });

  it("ignora pontuação já existente e trunca em 11 dígitos", () => {
    expect(applyCpfMask("123.456.789-00")).toBe("123.456.789-00");
    expect(applyCpfMask("1234567890099999")).toBe("123.456.789-00");
  });
});

describe("applyCnpjMask", () => {
  it("aplica pontuação progressivamente enquanto digita", () => {
    expect(applyCnpjMask("12")).toBe("12");
    expect(applyCnpjMask("12345678000199")).toBe("12.345.678/0001-99");
  });

  it("trunca em 14 dígitos", () => {
    expect(applyCnpjMask("123456780001999999")).toBe("12.345.678/0001-99");
  });
});

describe("applyCepMask", () => {
  it("formata CEP de 8 dígitos", () => {
    expect(applyCepMask("01234567")).toBe("01234-567");
    expect(applyCepMask("01234")).toBe("01234");
  });
});

describe("applyRgMask", () => {
  it("agrupa RG de 7, 8 ou 9 dígitos", () => {
    expect(applyRgMask("1234567")).toBe("1.234.567");
    expect(applyRgMask("12345678")).toBe("12.345.678");
    expect(applyRgMask("123456789")).toBe("12.345.678-9");
  });

  it("delega para máscara de CPF a partir de 10 dígitos (unificação RG/CPF)", () => {
    expect(applyRgMask("1234567890")).toBe("123.456.789-0");
    expect(applyRgMask("12345678900")).toBe("123.456.789-00");
  });

  it("trunca em 11 dígitos", () => {
    expect(applyRgMask("123456789001234")).toBe("123.456.789-00");
  });
});

describe("applyPhoneMask", () => {
  it("formata celular de 9 dígitos locais (DDD + 9)", () => {
    expect(applyPhoneMask("11987654321")).toBe("(11) 98765-4321");
  });

  it("formata fixo de 8 dígitos locais (DDD + 8)", () => {
    expect(applyPhoneMask("1132654321")).toBe("(11) 3265-4321");
  });

  it("formata progressivamente enquanto digita", () => {
    expect(applyPhoneMask("11")).toBe("(11");
    expect(applyPhoneMask("1198765")).toBe("(11) 98765");
  });

  it("trunca em 11 dígitos", () => {
    expect(applyPhoneMask("119876543219999")).toBe("(11) 98765-4321");
  });
});
