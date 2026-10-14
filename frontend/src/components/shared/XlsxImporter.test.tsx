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
        element.textContent?.includes("Produtos com") === true &&
        element.textContent?.includes("identificador") === true,
    );
    const sentence = tip.children[1];

    expect(sentence?.tagName).toBe("SPAN");
    expect(sentence?.textContent).toBe(
      "Produtos com o mesmo identificador serão atualizados em vez de duplicados (marca e modelo podem se repetir entre produtos diferentes).",
    );
    expect(sentence?.querySelector("strong")?.textContent).toBe(
      "identificador",
    );
  });
});
