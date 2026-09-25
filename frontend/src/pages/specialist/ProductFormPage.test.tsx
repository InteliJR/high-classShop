// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProductFormPage from "./ProductFormPage";
import { getCalendlyOAuthStatus } from "../../services/appointments.service";

vi.mock("../../components/specialist/ProductForm", () => ({
  default: () => <div data-testid="product-form">Formulário de produto</div>,
}));

vi.mock("../../services/appointments.service", () => ({
  getCalendlyOAuthStatus: vi.fn().mockResolvedValue({
    connected: false,
    calendly_user_uri: null,
    expires_at: null,
    is_active: false,
  }),
  getCalendlyAuthorizeUrl: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProductFormPage", () => {
  it("renders product creation without waiting for Calendly", () => {
    render(
      <MemoryRouter initialEntries={["/specialist/products/new"]}>
        <Routes>
          <Route
            path="/specialist/products/new"
            element={<ProductFormPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("product-form")).toBeTruthy();
    expect(getCalendlyOAuthStatus).not.toHaveBeenCalled();
    expect(screen.queryByText(/Conecte seu Calendly para anunciar/i)).toBeNull();
  });
});
