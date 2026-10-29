// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "../../services/api";
import CustomerProcessesPage from "./CustomerProcessesPage";

const { auth } = vi.hoisted(() => ({
  auth: { user: { id: "customer-1", role: "CUSTOMER" } },
}));

vi.mock("../../store/authStateManager", () => ({
  useAuth: (selector?: (state: typeof auth) => unknown) =>
    selector ? selector(auth) : auth,
}));
vi.mock("../../services/api", () => ({ default: { get: vi.fn() } }));
vi.mock("../../services/processes.service", () => ({
  getProcessCompletionReason: vi.fn().mockResolvedValue(null),
  getProcessWithActiveContract: vi.fn().mockResolvedValue({ activeContract: null }),
  getMeetingByProcess: vi.fn().mockResolvedValue(null),
  confirmAppointment: vi.fn(),
  cancelAppointment: vi.fn(),
  markConversationDone: vi.fn(),
  startMeeting: vi.fn(),
  updateProcessStatus: vi.fn(),
}));

const process = {
  id: "process-1",
  status: "NEGOTIATION",
  appointment_status: "COMPLETED",
  appointment_scheduling_method: "EMAIL",
  product_type: "CAR",
  product_id: "car-1",
  created_at: "2026-10-25",
  client: { id: "customer-1", name: "Cliente" },
  // This is the private API response shape: owner ID is nested in client.
  specialist: {
    id: "assigned-specialist",
    name: "Ana",
    surname: "Silva",
    email: "ana@example.test",
    phone: "11987654321",
  },
};

function response(record: typeof process) {
  return {
    data: {
      success: true,
      data: [record],
      meta: {
        pagination: {
          current_page: 1,
          total_pages: 1,
          total: 1,
          has_next: false,
          has_prev: false,
        },
      },
    },
  };
}

function renderPage() {
  return render(<MemoryRouter><CustomerProcessesPage /></MemoryRouter>);
}

describe("CustomerProcessesPage specialist contact integration", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue(response(process));
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("renders the assigned specialist from a fetched process and retains it on a fresh page load", async () => {
    const first = renderPage();
    expect(await screen.findByRole("region", { name: "Contato do especialista" })).toBeTruthy();
    expect(screen.getByText("Ana Silva")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copiar e-mail do especialista: ana@example.test" })).toBeTruthy();
    expect(vi.mocked(api.get).mock.calls[0][0]).toBe("/processes/client/customer-1");
    first.unmount();

    renderPage();
    expect(await screen.findByRole("region", { name: "Contato do especialista" })).toBeTruthy();
    expect(screen.getByText("Ana Silva")).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it.each([
    { status: "REJECTED", appointment_status: "COMPLETED" },
    { status: "SCHEDULING", appointment_status: "CANCELLED" },
    { status: "SCHEDULING", appointment_status: "PENDING" },
  ])("hides stale contacts for a fetched $status/$appointment_status process", async (state) => {
    vi.mocked(api.get).mockResolvedValue(response({ ...process, ...state }));
    renderPage();
    await screen.findByRole("heading", { name: "Meus Processos" });
    expect(screen.queryByRole("region", { name: "Contato do especialista" })).toBeNull();
    expect(screen.queryByText("ana@example.test")).toBeNull();
  });
});
