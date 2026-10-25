// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product } from "../../types/types";
import ProductCard from "./ProductCard";
import ProductDetails from "./ProductDetails";
import ResponsiveProductList from "../specialist/ResponsiveProductList";

vi.mock("./ProductCarousel", () => ({ default: () => null }));
afterEach(cleanup);

function renderPrices(value: unknown, currency: Product["currency"]) {
  const product: Product = {
    id: "product-248",
    marca: "Marca",
    modelo: "Modelo",
    ano: 2026,
    estado: "novo",
    valor: value as Product["valor"],
    currency,
  };
  render(
    <>
      <ProductCard {...product} />
      <ProductDetails product={product} />
      <ResponsiveProductList
        products={[product]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    </>,
  );
}

describe.each(["BRL", "USD"] as const)("product prices in %s", (currency) => {
  it.each([
    [950000, "950.000,00"],
    ["950000.00", "950.000,00"],
    [1000000, "1.000.000,00"],
    ["1000000.00", "1.000.000,00"],
    [1500000, "1.500.000,00"],
    ["1500000.00", "1.500.000,00"],
    [1500000.5, "1.500.000,50"],
    ["1500000.50", "1.500.000,50"],
    [1500000.01, "1.500.000,01"],
    ["1500000.01", "1.500.000,01"],
    ["950000.01", "950.000,01"],
  ])(
    "keeps %s consistent across catalog, detail and both specialist layouts",
    (value, formatted) => {
      renderPrices(value, currency);
      const symbol = currency === "BRL" ? "R$" : "US$";
      expect(screen.getAllByText(`${symbol} ${formatted}`)).toHaveLength(4);
    },
  );

  it.each([null, undefined, "", "invalid", NaN, Infinity])(
    "shows missing/invalid %s without a zero price",
    (value) => {
      renderPrices(value, currency);
      expect(screen.getAllByText("Não informado")).toHaveLength(4);
      expect(screen.queryByText(/(?:R\$|US\$) 0,00/)).toBeNull();
    },
  );
});
