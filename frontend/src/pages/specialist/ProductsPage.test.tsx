// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductsPage from "./ProductsPage";
import {
  getAdminSpecialistProducts,
  type AdminCatalogProduct,
} from "../../services/admin-specialist-journey.service";
import type { PaginationMeta } from "../../types/types";
import { deleteBoat } from "../../services/boats.service";

const authState: { user: Record<string, unknown> | null } = { user: null };

vi.mock("../../store/authStateManager", () => ({
  useAuth: (selector: (state: typeof authState) => unknown) =>
    selector(authState),
}));

vi.mock("../../services/admin-specialist-journey.service", () => ({
  getAdminSpecialistProducts: vi.fn(),
}));

vi.mock("../../services/cars.service", () => ({ deleteCar: vi.fn() }));
vi.mock("../../services/boats.service", () => ({ deleteBoat: vi.fn() }));
vi.mock("../../services/aircrafts.service", () => ({
  deleteAircraft: vi.fn(),
}));

const getProducts = vi.mocked(getAdminSpecialistProducts);

function boat(id: string, modelo: string, isActive = true): AdminCatalogProduct {
  return {
    id,
    marca: "Azimut",
    modelo,
    ano: 2024,
    valor: 1000000,
    currency: "BRL",
    estado: "novo",
    imageUrl: "",
    specialist_id: "paulo",
    is_active: isActive,
  } as unknown as AdminCatalogProduct;
}

function pageResult(
  products: AdminCatalogProduct[],
  pagination: Partial<PaginationMeta>,
) {
  return {
    products,
    pagination: {
      current_page: 1,
      per_page: 20,
      total: products.length,
      total_pages: 1,
      has_next: false,
      has_prev: false,
      ...pagination,
    } as PaginationMeta,
  };
}

function renderPage() {
  const utils = render(
    <MemoryRouter>
      <ProductsPage />
    </MemoryRouter>,
  );
  return {
    ...utils,
    setSearch: (term: string) =>
      fireEvent.change(screen.getByLabelText("Buscar produtos"), {
        target: { value: term },
      }),
  };
}

beforeEach(() => {
  authState.user = { id: "paulo", role: "SPECIALIST", speciality: "BOAT" };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("ProductsPage (especialista)", () => {
  it("pagina no servidor só os produtos do especialista, incluindo inativos", async () => {
    getProducts
      .mockResolvedValueOnce(
        pageResult([boat("b1", "Flybridge 68"), boat("b2", "S7", false)], {
          total: 45,
          total_pages: 3,
          has_next: true,
        }),
      )
      .mockResolvedValueOnce(
        pageResult([boat("b21", "Magellano 60")], {
          current_page: 2,
          total: 45,
          total_pages: 3,
          has_next: true,
          has_prev: true,
        }),
      );

    renderPage();

    expect(await screen.findAllByText("Azimut Flybridge 68")).toHaveLength(2);
    expect(getProducts).toHaveBeenCalledWith("BOAT", 1, 20, "");
    expect(screen.getByText("45 produtos")).toBeTruthy();
    expect(screen.getAllByText("Inativo")).toHaveLength(2);
    expect(screen.getByText(/Página/).textContent).toContain("1 de 3");

    fireEvent.click(screen.getByTitle("Próxima"));

    expect(await screen.findAllByText("Azimut Magellano 60")).toHaveLength(2);
    expect(getProducts).toHaveBeenLastCalledWith("BOAT", 2, 20, "");
    expect(screen.getByText(/Página/).textContent).toContain("2 de 3");
  });

  it("envia a busca ao servidor com debounce e volta para a primeira página", async () => {
    getProducts
      .mockResolvedValueOnce(
        pageResult([boat("b21", "Magellano 60")], {
          current_page: 1,
          total: 45,
          total_pages: 3,
        }),
      )
      .mockResolvedValueOnce(pageResult([boat("b7", "S7")], {}));

    const { setSearch } = renderPage();
    await screen.findAllByText("Azimut Magellano 60");

    setSearch("  s7 ");

    expect(await screen.findAllByText("Azimut S7")).toHaveLength(2);
    expect(getProducts).toHaveBeenCalledTimes(2);
    expect(getProducts).toHaveBeenLastCalledWith("BOAT", 1, 20, "s7");
    expect(screen.queryByText(/Página/)).toBeNull();
  });

  it("ignora resposta antiga que chega depois da busca mais recente", async () => {
    let resolveFirst: (value: ReturnType<typeof pageResult>) => void = () => {};
    getProducts
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFirst = resolve)),
      )
      .mockResolvedValueOnce(pageResult([boat("b7", "S7")], {}));

    const { setSearch } = renderPage();
    setSearch("S7");

    expect(await screen.findAllByText("Azimut S7")).toHaveLength(2);

    await act(async () => {
      resolveFirst(pageResult([boat("old", "Antigo")], {}));
    });

    expect(screen.queryByText("Azimut Antigo")).toBeNull();
    expect(screen.getAllByText("Azimut S7")).toHaveLength(2);
  });

  it("avisa quando o especialista não tem especialidade e não chama a API", async () => {
    authState.user = { id: "paulo", role: "SPECIALIST" };

    renderPage();

    expect(screen.getByText(/não tem uma especialidade definida/)).toBeTruthy();
    await waitFor(() => expect(getProducts).not.toHaveBeenCalled());
  });

  it("mostra erro amigável quando a listagem falha", async () => {
    getProducts.mockRejectedValueOnce({ friendlyMessage: "Sem permissão." });

    renderPage();

    expect(await screen.findByText("Sem permissão.")).toBeTruthy();
    expect(screen.queryByText("Nenhum produto cadastrado")).toBeNull();
  });

  it("confirma a desativação e marca o item como inativo sem recarregar", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(deleteBoat).mockResolvedValueOnce(undefined as never);
    getProducts.mockResolvedValueOnce(
      pageResult([boat("b1", "Flybridge 68")], {}),
    );

    renderPage();
    await screen.findAllByText("Azimut Flybridge 68");

    fireEvent.click(
      screen.getAllByRole("button", { name: "Desativar Azimut Flybridge 68" })[0],
    );

    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "Produto desativado",
    );
    expect(deleteBoat).toHaveBeenCalledWith("b1");
    expect(getProducts).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Inativo")).toHaveLength(2);
    expect(screen.queryByRole("alert", { name: /Não foi possível/ })).toBeNull();
  });

  it("não sobrescreve uma busca feita enquanto a desativação está em andamento", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let resolveDelete: () => void = () => {};
    vi.mocked(deleteBoat).mockImplementationOnce(
      () => new Promise<never>((resolve) => (resolveDelete = () => resolve(undefined as never))),
    );
    getProducts
      .mockResolvedValueOnce(
        pageResult([boat("b1", "Flybridge 68"), boat("b2", "S7")], {}),
      )
      .mockResolvedValueOnce(pageResult([boat("b2", "S7")], {}));

    const { setSearch } = renderPage();
    await screen.findAllByText("Azimut Flybridge 68");

    fireEvent.click(
      screen.getAllByRole("button", { name: "Desativar Azimut Flybridge 68" })[0],
    );
    setSearch("s7");
    await waitFor(() =>
      expect(getProducts).toHaveBeenLastCalledWith("BOAT", 1, 20, "s7"),
    );
    await waitFor(() =>
      expect(screen.queryByText("Azimut Flybridge 68")).toBeNull(),
    );

    await act(async () => resolveDelete());

    expect(await screen.findByRole("status")).toBeTruthy();
    // Nenhuma nova listagem com o termo antigo depois do DELETE.
    expect(getProducts).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Azimut Flybridge 68")).toBeNull();
    expect(screen.getAllByText("Azimut S7")).toHaveLength(2);
    expect(screen.queryByText("Inativo")).toBeNull();
  });

  it("bloqueia a paginação enquanto a busca digitada ainda não foi aplicada", async () => {
    getProducts.mockResolvedValue(
      pageResult([boat("b1", "Flybridge 68")], {
        total: 45,
        total_pages: 3,
        has_next: true,
      }),
    );

    const { setSearch } = renderPage();
    await screen.findAllByText("Azimut Flybridge 68");
    const next = screen.getByTitle("Próxima") as HTMLButtonElement;
    expect(next.disabled).toBe(false);

    setSearch("bmw");

    expect((screen.getByTitle("Próxima") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
