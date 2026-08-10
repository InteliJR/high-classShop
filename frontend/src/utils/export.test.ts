import { describe, expect, it } from "vitest";
import { toCsv } from "./export";

describe("toCsv", () => {
  it("usa ponto e vírgula como separador (padrão do Excel pt-BR)", () => {
    expect(toCsv(["A", "B"], [["1", "2"]])).toBe("A;B\n1;2");
  });

  it("remove o prefixo R$ para o Excel pt-BR ler o valor como número", () => {
    // Com separador ";" e vírgula decimal, "2.400.000,00" é número no Excel
    // pt-BR; com "R$ " na frente viraria texto e não somaria.
    const csv = toCsv(["Valor"], [["R$ 2.400.000,00"]]);
    expect(csv).toBe("Valor\n2.400.000,00");
  });

  it("mantém o R$ quando não está no início da célula", () => {
    expect(toCsv(["Obs"], [["cobrado em R$ 100,00"]])).toBe(
      "Obs\ncobrado em R$ 100,00",
    );
  });

  it("escapa aspas, ponto e vírgula e quebra de linha", () => {
    expect(toCsv(["A"], [['diz "oi"; ok']])).toBe('A\n"diz ""oi""; ok"');
    expect(toCsv(["A"], [["linha1\nlinha2"]])).toBe('A\n"linha1\nlinha2"');
  });

  it("neutraliza fórmula em célula vinda de campo livre", () => {
    // Descrição de produto é texto livre: sem o apóstrofo, o Excel executaria.
    expect(toCsv(["Obs"], [['=HYPERLINK("http://x","clique")']])).toBe(
      'Obs\n"\'=HYPERLINK(""http://x"",""clique"")"',
    );
    expect(toCsv(["Obs"], [["-2+3+cmd|'/c calc'!A0"]])).toBe(
      "Obs\n'-2+3+cmd|'/c calc'!A0",
    );
    expect(toCsv(["Obs"], [["@SUM(A1)"]])).toBe("Obs\n'@SUM(A1)");
  });

  it("não mexe em texto que só parece perigoso no meio", () => {
    expect(toCsv(["Obs"], [["motor 2.0 turbo = potente"]])).toBe(
      "Obs\nmotor 2.0 turbo = potente",
    );
  });
});
