// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NewSpecialistForm from "./NewSpecialistForm";
import { inviteSpecialist } from "../../services/specialists.service";

vi.mock("../../services/specialists.service", () => ({
  inviteSpecialist: vi.fn(),
}));

afterEach(cleanup);

describe("NewSpecialistForm", () => {
  it("exige comissão e envia zero como valor configurado", async () => {
    vi.mocked(inviteSpecialist).mockResolvedValue({
      inviteLink: "https://example.test/invite",
      email: "especialista@example.com",
    });
    render(<NewSpecialistForm onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("E-mail do especialista"), {
      target: { value: "especialista@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gerar convite" }));
    expect(
      await screen.findByText("Informe a comissão do especialista."),
    ).toBeTruthy();

    fireEvent.change(
      screen.getByLabelText(
        "Comissão do especialista (% da comissão total)",
      ),
      { target: { value: "0" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Gerar convite" }));

    await waitFor(() =>
      expect(inviteSpecialist).toHaveBeenCalledWith({
        email: "especialista@example.com",
        speciality: "CAR",
        commission_rate: 0,
      }),
    );
  });
});
