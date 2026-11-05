// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { XlsxImporter } from "./XlsxImporter";

afterEach(cleanup);

describe("XlsxImporter", () => {
  it("mantém a dica do identificador em uma única frase com espaços e acentos", () => {
    render(
      <XlsxImporter
        productType="CAR"
        onImport={vi.fn()}
        onDownloadTemplate={vi.fn()}
      />,
    );

    const tip = screen.getByText(
      (_, element) =>
        element?.tagName === "LI" &&
        element.textContent?.includes("Reimportar a mesma linha") === true &&
        element.textContent?.includes("identificador") === true,
    );
    const sentence = tip.children[1];

    expect(sentence?.tagName).toBe("SPAN");
    expect(sentence?.textContent).toBe(
      "Reimportar a mesma linha atualiza o produto em vez de duplicar. Sem identificador, ele é gerado a partir da linha inteira: mudar qualquer dado, inclusive o valor, cria um produto novo. Preencha-o se for atualizar a linha depois (na sincronização do catálogo ele é obrigatório).",
    );
    expect(sentence?.querySelector("strong")?.textContent).toBe(
      "identificador",
    );
  });
});
