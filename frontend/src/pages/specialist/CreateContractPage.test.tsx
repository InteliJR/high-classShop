// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateContractPage from "./CreateContractPage";
import {
  cancelContractPreview,
  listContractTemplates,
  prefillContract,
  previewContract,
  sendContractAfterPreview,
} from "../../services/contracts.service";

vi.mock("../../hooks/use-is-mobile", () => ({ useIsMobile: () => false }));
vi.mock("../../services/contracts.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/contracts.service")>();
  return {
    ...actual,
    cancelContractPreview: vi.fn(),
    listContractTemplates: vi.fn(),
    prefillContract: vi.fn(),
    previewContract: vi.fn(),
    sendContractAfterPreview: vi.fn(),
  };
});

const processId = "11111111-1111-4111-8111-111111111111";
const preview = {
  preview_url: "https://demo.docusign.net/preview",
  envelope_id: "envelope-1",
  expires_at: "2099-01-01T00:00:00.000Z",
  process_id: processId,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/specialist/contracts/create?processId=${processId}`]}>
      <CreateContractPage />
    </MemoryRouter>,
  );
}

async function openPreview() {
  renderPage();
  await screen.findByText("Gerar Contrato de Venda");
  fireEvent.click(
    screen.getByRole("button", { name: /Continuar para os dados do contrato/i }),
  );
  const previewButton = await screen.findByRole("button", {
    name: /Pré-visualizar e Enviar Contrato/i,
  });
  await waitFor(() => expect((previewButton as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(previewButton);
  await screen.findByTitle("DocuSign Contract Preview");
}

describe("CreateContractPage preview lifecycle", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(prefillContract).mockResolvedValue({
      process_id: processId,
      product_type: "CAR",
      currency: "BRL",
      buyer: {
        id: "buyer-1",
        name: "Buyer",
        email: "buyer@example.test",
        cpf: "12345678901",
        address: "Buyer Street",
        cep: "01001000",
      },
      seller: {
        id: "seller-1",
        name: "Seller",
        email: "seller@example.test",
        cpf: "10987654321",
        address: "Seller Street",
        cep: "02002000",
      },
      product: {
        id: "car-1",
        brand: "Race",
        model: "Car",
        year: 2026,
        price: 100000,
        registration_id: "ABC1234",
        serial_number: "SERIAL",
      },
      platform: { name: "Platform", rate: 10 },
      specialist: {
        name: "Specialist",
        email: "specialist@example.test",
        rate: 0,
      },
      suggested_total_rate: 10,
    } as any);
    vi.mocked(listContractTemplates).mockResolvedValue([
      { templateId: "template-1", name: "Contrato de carro" },
    ]);
    vi.mocked(previewContract).mockResolvedValue(preview);
    vi.mocked(cancelContractPreview).mockResolvedValue(undefined);
    vi.mocked(sendContractAfterPreview).mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("retains the real modal and shows the safe message on reconciliation errors", async () => {
    vi.mocked(sendContractAfterPreview).mockRejectedValue({
      response: {
        data: {
          error: {
            code: "CONTRACT_MANUAL_RECONCILIATION_REQUIRED",
            message: "O estado do contrato precisa ser reconciliado.",
          },
        },
      },
    });
    await openPreview();

    fireEvent.click(
      screen.getByRole("button", { name: /Confirmar e Enviar/i }),
    );

    await waitFor(() => expect(sendContractAfterPreview).toHaveBeenCalledTimes(1));
    const modal = screen
      .getByTitle("DocuSign Contract Preview")
      .closest(".fixed") as HTMLElement;
    expect(modal).toBeTruthy();
    expect(within(modal).getByRole("alert").textContent).toContain(
      "O estado do contrato precisa ser reconciliado.",
    );
  });

  it("retains the real modal when cancellation fails", async () => {
    vi.mocked(cancelContractPreview).mockRejectedValue(
      new Error("provider cancellation failed"),
    );
    await openPreview();

    const modal = screen
      .getByTitle("DocuSign Contract Preview")
      .closest(".fixed") as HTMLElement;
    fireEvent.click(within(modal).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(cancelContractPreview).toHaveBeenCalledTimes(1));
    expect(screen.getByTitle("DocuSign Contract Preview")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "Não foi possível cancelar o preview",
    );
  });

  it("retains the real modal when send has no HTTP response", async () => {
    vi.mocked(sendContractAfterPreview).mockRejectedValue(
      new Error("network response lost"),
    );
    await openPreview();

    fireEvent.click(
      screen.getByRole("button", { name: /Confirmar e Enviar/i }),
    );

    await waitFor(() => expect(sendContractAfterPreview).toHaveBeenCalledTimes(1));
    expect(screen.getByTitle("DocuSign Contract Preview")).toBeTruthy();
  });

  it("reuses one operation id when a public preview request is retried", async () => {
    vi.mocked(previewContract)
      .mockRejectedValueOnce(new Error("lost response"))
      .mockResolvedValueOnce(preview);

    renderPage();
    await screen.findByText("Gerar Contrato de Venda");
    fireEvent.click(
      screen.getByRole("button", {
        name: /Continuar para os dados do contrato/i,
      }),
    );
    const previewButton = await screen.findByRole("button", {
      name: /Pré-visualizar e Enviar Contrato/i,
    });
    await waitFor(() =>
      expect((previewButton as HTMLButtonElement).disabled).toBe(false),
    );

    fireEvent.click(previewButton);
    await waitFor(() => expect(previewContract).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect((previewButton as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(previewButton);
    await screen.findByTitle("DocuSign Contract Preview");

    const firstOperationId = vi.mocked(previewContract).mock.calls[0][0]
      .operation_id;
    const secondOperationId = vi.mocked(previewContract).mock.calls[1][0]
      .operation_id;
    expect(firstOperationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(secondOperationId).toBe(firstOperationId);
  });

  it("rotates the operation id after the backend confirms draft compensation", async () => {
    vi.mocked(previewContract)
      .mockRejectedValueOnce({
        response: {
          data: {
            error: {
              code: "CONTRACT_PREVIEW_COMPENSATED",
              message: "Rascunho cancelado com segurança.",
            },
          },
        },
      })
      .mockResolvedValueOnce(preview);

    renderPage();
    await screen.findByText("Gerar Contrato de Venda");
    fireEvent.click(
      screen.getByRole("button", {
        name: /Continuar para os dados do contrato/i,
      }),
    );
    const previewButton = await screen.findByRole("button", {
      name: /Pré-visualizar e Enviar Contrato/i,
    });
    await waitFor(() => expect((previewButton as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(previewButton);
    await waitFor(() => expect(previewContract).toHaveBeenCalledTimes(1));
    await waitFor(() => expect((previewButton as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(previewButton);
    await screen.findByTitle("DocuSign Contract Preview");

    expect(vi.mocked(previewContract).mock.calls[1][0].operation_id).not.toBe(
      vi.mocked(previewContract).mock.calls[0][0].operation_id,
    );
  });
});
