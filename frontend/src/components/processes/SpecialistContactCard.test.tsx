// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Process } from "../../services/processes.service";
import SpecialistContactCard from "./SpecialistContactCard";

const { auth } = vi.hoisted(() => ({
  auth: { user: { id: "customer-1", role: "CUSTOMER" } as { id: string; role: string } | null },
}));
vi.mock("../../store/authStateManager", () => ({
  useAuth: (selector: (state: typeof auth) => unknown) => selector(auth),
}));

const process: Process = {
  id: "process-1", status: "SCHEDULING", client_id: "customer-1",
  specialist_id: "process-specialist", appointment_status: "SCHEDULED",
  product_type: "CAR", product_id: "car-1", created_at: "2026-10-25", updated_at: "2026-10-25",
  client: { id: "customer-1" },
  specialist: { id: "process-specialist", name: "Ana", surname: "Silva", email: "ana@example.test", phone: "(11) 98765-4321" },
};

describe("SpecialistContactCard", () => {
  beforeEach(() => { auth.user = { id: "customer-1", role: "CUSTOMER" }; });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it.each(["EMAIL", "CALENDLY"] as const)("renders full contact and existing copy/WhatsApp actions for %s", async (method) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<SpecialistContactCard process={{ ...process, appointment_scheduling_method: method }} />);
    expect(screen.getByText("Caso tenha uma dúvida, entre em contato:")).toBeTruthy();
    expect(screen.getByText("Ana Silva")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copiar e-mail do especialista: ana@example.test" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("ana@example.test"));
    fireEvent.click(screen.getByRole("button", { name: "Copiar telefone do especialista: (11) 98765-4321" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("(11) 98765-4321"));
    const link = screen.getByRole("link", { name: "WhatsApp do especialista" });
    expect(link.getAttribute("href")).toBe("https://wa.me/5511987654321");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it.each(["SCHEDULING", "NEGOTIATION", "DOCUMENTATION", "PROCESSING_CONTRACT", "COMPLETED"] as const)("keeps completed appointment contacts during %s", (status) => {
    render(<SpecialistContactCard process={{ ...process, status, product_type: null, product_id: null, appointment_status: "COMPLETED" }} />);
    expect(screen.getByRole("region", { name: "Contato do especialista" })).toBeTruthy();
  });

  it.each(["PENDING", "CANCELLED", null, undefined] as const)("hides all card content for appointment %s despite stale contact fields", (appointment_status) => {
    render(<SpecialistContactCard process={{ ...process, appointment_status }} />);
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.queryByText("ana@example.test")).toBeNull();
  });

  it("hides rejected processes even if the appointment remains confirmed", () => {
    render(<SpecialistContactCard process={{ ...process, status: "REJECTED" }} />);
    expect(screen.queryByRole("region")).toBeNull();
  });

  it.each([null, { id: "other-customer", role: "CUSTOMER" }, { id: "customer-1", role: "ADMIN" }])("hides contacts from an anonymous, unrelated or non-customer viewer: %j", (user) => {
    auth.user = user;
    render(<SpecialistContactCard process={process} />);
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("handles the API's nested client ID and rejects contradictory owner data", () => {
    const response = { ...process, client_id: undefined } as unknown as Process;
    const view = render(<SpecialistContactCard process={response} />);
    expect(screen.getByText("Ana Silva")).toBeTruthy();
    view.rerender(<SpecialistContactCard process={{ ...process, client: { id: "other-customer" } }} />);
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("shows absent fields without hiding available data or creating invalid actions", () => {
    render(<SpecialistContactCard process={{ ...process, specialist: { id: "process-specialist", name: "Ana", email: " ", phone: null } }} />);
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("E-mail não informado")).toBeTruthy();
    expect(screen.getByText("Telefone não informado")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("keeps a supplied phone available for copying without creating an invalid WhatsApp link", () => {
    render(<SpecialistContactCard process={{ ...process, specialist: { ...process.specialist!, phone: "ramal 42" } }} />);
    expect(screen.getByRole("button", { name: /Copiar telefone do especialista/ })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("makes missing specialist identity explicit without using another person's contact", () => {
    render(<SpecialistContactCard process={{ ...process, specialist: undefined }} />);
    expect(screen.getByText("Nome do especialista não informado")).toBeTruthy();
    expect(screen.getByText("E-mail não informado")).toBeTruthy();
    expect(screen.getByText("Telefone não informado")).toBeTruthy();
  });
});
