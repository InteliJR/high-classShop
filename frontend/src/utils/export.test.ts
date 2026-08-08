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
});
