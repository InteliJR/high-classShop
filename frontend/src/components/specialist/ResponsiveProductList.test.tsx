// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ResponsiveProductList, {
  type ProductListItem,
} from "./ResponsiveProductList";

const products: ProductListItem[] = [
  {
    id: "brl",
    marca: "Aurum",
    modelo: "Sedan 120",
    ano: 2025,
    valor: 120000,
    currency: "BRL",
    estado: "novo",
  },
  {
    id: "usd",
    marca: "Aurum",
    modelo: "Grand Tourer 120",
    ano: 2026,
    valor: 120000,
    currency: "USD",
    estado: "seminovo",
  },
];

afterEach(cleanup);

describe("ResponsiveProductList", () => {
  it("exibe cartões em telas estreitas e tabela em telas amplas com moeda junto ao produto", () => {
    render(
      <ResponsiveProductList
        products={products}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByTestId("product-card-list").className).toContain(
      "xl:hidden",
    );
    expect(screen.getByTestId("product-table").className).toContain(
      "hidden",
    );
    expect(screen.getByTestId("product-table").className).toContain(
      "xl:block",
    );

    expect(screen.getAllByText("Aurum Sedan 120")).toHaveLength(2);
    expect(screen.getAllByText("Aurum Grand Tourer 120")).toHaveLength(2);
    expect(screen.getAllByText("Produto BRL")).toHaveLength(2);
    expect(screen.getAllByText("Produto USD")).toHaveLength(2);
    expect(screen.getAllByText("R$ 120.000,00")).toHaveLength(2);
    expect(screen.getAllByText("US$ 120.000,00")).toHaveLength(2);
  });

  it("mantém ações de editar e excluir acessíveis nos cartões", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <ResponsiveProductList
        products={products}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Editar Aurum Sedan 120",
      })[0],
    );
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Excluir Aurum Sedan 120",
      })[0],
    );

    expect(onEdit).toHaveBeenCalledWith("brl");
    expect(onDelete).toHaveBeenCalledWith("brl");
  });
});
