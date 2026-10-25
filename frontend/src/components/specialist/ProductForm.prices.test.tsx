// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductForm from "./ProductForm";
import type { RawCar } from "../../services/cars.service";

const { create, update } = vi.hoisted(() => ({
  create: vi.fn().mockResolvedValue({ id: "product-248" }),
  update: vi.fn().mockResolvedValue({ id: "product-248" }),
}));
vi.mock("../../services/cars.service", () => ({
  createCar: create,
  updateCar: update,
}));
vi.mock("../../services/boats.service", () => ({
  createBoat: create,
  updateBoat: update,
}));
vi.mock("../../services/aircrafts.service", () => ({
  createAircraft: create,
  updateAircraft: update,
}));
vi.mock("../../store/authStateManager", () => ({
  useAuth: (selector: (state: unknown) => unknown) =>
    selector({ user: { id: "admin-1", role: "ADMIN" } }),
}));
vi.mock("../../components/shared/XlsxImporter", () => ({
  XlsxImporter: () => null,
}));
vi.mock("../../components/shared/ImageUploader", () => ({
  ImageUploader: ({ onChange }: { onChange: (images: unknown[]) => void }) => (
    <button
      type="button"
      onClick={() =>
        onChange([{ data: "data:image/png;base64,dGVzdA==", is_primary: true }])
      }
    >
      Adicionar imagem de teste
    </button>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "alert").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const baseProduct: RawCar = {
  id: "product-248",
  marca: "Marca",
  modelo: "Modelo",
  identificador: "PRECO-248",
  ano: 2026,
  estado: "novo",
  valor: "1500000.01",
  currency: "BRL",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

describe.each(["CAR", "BOAT", "AIRCRAFT"] as const)(
  "%s price forms",
  (productType) => {
    it.each([
      [950000, "BRL"],
      ["950000.00", "USD"],
      [1000000, "USD"],
      ["1000000.00", "BRL"],
      [1500000, "BRL"],
      ["1500000.00", "USD"],
      ["1500000.50", "BRL"],
      ["1500000.01", "USD"],
    ] as const)(
      "reopens and saves %s %s without changing the stored amount",
      async (valor, currency) => {
        const product = { ...baseProduct, valor, currency };
        render(
          <MemoryRouter>
            <ProductForm
              mode="edit"
              productType={productType}
              productId={product.id}
              productData={product}
            />
          </MemoryRouter>,
        );
        expect(
          (screen.getByLabelText("Valor *") as HTMLInputElement).valueAsNumber,
        ).toBe(Number(valor));
        expect(update).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText("Adicionar imagem de teste"));
        fireEvent.click(
          screen.getByRole("button", { name: "Salvar Alterações" }),
        );
        await waitFor(() =>
          expect(update).toHaveBeenCalledWith(
            product.id,
            expect.objectContaining({ valor: Number(valor), currency }),
          ),
        );
        expect(product.valor).toBe(valor);
      },
    );

    it.each([
      ["1500000.01", 1500000.01],
      ["1e6", 1000000],
      [".5", 0.5],
    ])(
      "creates a product from numeric input %s in its original currency",
      async (input, expected) => {
        render(
          <MemoryRouter>
            <ProductForm mode="create" productType={productType} />
          </MemoryRouter>,
        );
        for (const [label, value] of [
          ["Marca *", "Marca"],
          ["Modelo *", "Modelo"],
          ["Identificador *", "PRECO-248"],
          ["Ano *", "2026"],
          ["Valor *", String(input)],
          ["Moeda *", "USD"],
          ["Estado *", "novo"],
        ]) {
          fireEvent.change(screen.getByLabelText(label), { target: { value } });
        }
        fireEvent.click(screen.getByText("Adicionar imagem de teste"));
        fireEvent.click(screen.getByRole("button", { name: "Criar Produto" }));
        await waitFor(() =>
          expect(create).toHaveBeenCalledWith(
            expect.objectContaining({ valor: expected, currency: "USD" }),
          ),
        );
      },
    );

    it.each([null, undefined, "", "invalid", Infinity, "1.500.000,00"])(
      "does not silently save invalid %s as zero",
      async (valor) => {
        render(
          <MemoryRouter>
            <ProductForm
              mode="edit"
              productType={productType}
              productId={baseProduct.id}
              productData={{ ...baseProduct, valor } as RawCar}
            />
          </MemoryRouter>,
        );
        expect(
          (screen.getByLabelText("Valor *") as HTMLInputElement).value,
        ).toBe("");
        fireEvent.click(screen.getByText("Adicionar imagem de teste"));
        fireEvent.click(
          screen.getByRole("button", { name: "Salvar Alterações" }),
        );
        await screen.findByText("Valor é obrigatório");
        expect(update).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText("Valor *"), {
          target: { value: "1500000.50" },
        });
        fireEvent.click(
          screen.getByRole("button", { name: "Salvar Alterações" }),
        );
        await waitFor(() =>
          expect(update).toHaveBeenCalledWith(
            baseProduct.id,
            expect.objectContaining({ valor: 1500000.5 }),
          ),
        );
      },
    );
  },
);
