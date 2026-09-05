import { describe, expect, it } from "vitest";
import { getProductSaveErrorMessage } from "./product-error-message";

describe("getProductSaveErrorMessage", () => {
  it("maps the monetary lock domain code to the stable product message", () => {
    expect(
      getProductSaveErrorMessage({
        response: {
          data: {
            code: "PRODUCT_MONETARY_FIELDS_LOCKED",
            message: "backend detail that may change",
          },
        },
      }),
    ).toBe(
      "Valor e moeda não podem ser alterados enquanto o produto estiver em negociação.",
    );
  });

  it("preserves validation message arrays for other errors", () => {
    expect(
      getProductSaveErrorMessage({
        response: { data: { message: ["valor inválido", "moeda inválida"] } },
      }),
    ).toBe("valor inválido, moeda inválida");
  });
});
