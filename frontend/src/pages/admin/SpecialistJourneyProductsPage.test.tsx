// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SpecialistJourneyProductsPage from "./SpecialistJourneyProductsPage";
import {
  getAdminSpecialistProducts,
  previewAdminCatalogCsv,
} from "../../services/admin-specialist-journey.service";

vi.mock("../../contexts/AdminSpecialistJourneyContext", () => ({
  useAdminSpecialistJourney: () => ({
    targetSpecialistId: "specialist-1",
    specialist: { id: "specialist-1", name: "Ana", speciality: "CAR" },
  }),
}));

vi.mock("../../services/admin-specialist-journey.service", async (original) => ({
  ...(await original<object>()),
  getAdminSpecialistProducts: vi.fn(),
  previewAdminCatalogCsv: vi.fn(),
  importAdminCatalogCsv: vi.fn(),
}));

afterEach(cleanup);

describe("SpecialistJourneyProductsPage", () => {
  beforeEach(() => {
    vi.mocked(getAdminSpecialistProducts).mockResolvedValue({
      products: [],
      pagination: { current_page: 1, total_pages: 1 } as any,
    });
    vi.mocked(previewAdminCatalogCsv).mockResolvedValue({
      productType: "CAR",
      targetSpecialistId: "specialist-1",
      mode: "SYNCHRONIZE",
      requiresExplicitConfirmation: true,
      synchronizePreviewToken: "signed-token",
      impact: {
        incomingItems: 4,
        activeItemsBefore: 8,
        matchingItems: 3,
        newOrReactivatedItems: 1,
        deactivationCandidates: 5,
      },
    });
  });

  it("exibe exatamente o impacto devolvido pela prévia de sincronização", async () => {
    render(
      <MemoryRouter>
        <SpecialistJourneyProductsPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Modo da importação"), {
      target: { value: "SYNCHRONIZE" },
    });
    fireEvent.change(screen.getByLabelText("Arquivo CSV"), {
      target: {
        files: [new File(["csv"], "catalog.csv", { type: "text/csv" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pré-visualizar impacto" }));

    expect(
      await screen.findByText(/4 linhas · 1 criações\/reativações · 3 atualizações/),
    ).toBeTruthy();
    expect(screen.getByText("5 desativações")).toBeTruthy();
  });
});
