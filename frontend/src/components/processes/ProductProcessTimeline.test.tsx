// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ProductProcessTimeline from "./ProductProcessTimeline";
import type { ProductProcessSummary } from "../../services/appointments.service";

const base: ProductProcessSummary = {
  id: "process-1",
  status: "SCHEDULING",
  is_active: true,
  status_history: [
    { status: "SCHEDULING", changed_at: "2099-01-01T12:00:00.000Z" },
  ],
};

function steps() {
  return screen.getAllByRole("listitem").map((item) => ({
    label: item.textContent,
    current: item.getAttribute("aria-current") === "step",
  }));
}

afterEach(cleanup);

describe("ProductProcessTimeline", () => {
  it("highlights the current active stage with neutral styling", () => {
    render(<ProductProcessTimeline process={{ ...base, status: "DOCUMENTATION" }} />);
    const region = screen.getByRole("region", { name: "Etapa do processo" });
    expect(region.className).toContain("border-border");
    expect(steps().find((step) => step.current)?.label).toContain("Documentação");
    expect(steps().at(-1)?.label).toContain("Concluído");
  });

  it("keeps PROCESSING_CONTRACT inside the negotiation step", () => {
    render(<ProductProcessTimeline process={{ ...base, status: "PROCESSING_CONTRACT" }} />);
    expect(steps().find((step) => step.current)?.label).toContain("Negociação");
    expect(screen.getByText("O contrato está sendo preparado.")).toBeTruthy();
  });

  it("shows completion with the success tone and recorded dates", () => {
    render(
      <ProductProcessTimeline
        process={{
          ...base,
          status: "COMPLETED",
          is_active: false,
          status_history: [
            ...base.status_history,
            { status: "COMPLETED", changed_at: "2099-02-01T12:00:00.000Z" },
          ],
        }}
      />,
    );
    const region = screen.getByRole("region", { name: "Etapa do processo" });
    expect(region.className).toContain("bg-status-ok-wash");
    expect(steps().some((step) => step.current)).toBe(false);
    expect(region.textContent).toContain(
      new Date("2099-02-01T12:00:00.000Z").toLocaleDateString("pt-BR", { dateStyle: "short" }),
    );
  });

  it("shows rejection with the danger tone, only reached steps and no reason", () => {
    render(
      <ProductProcessTimeline
        process={{
          ...base,
          status: "REJECTED",
          is_active: false,
          status_history: [
            ...base.status_history,
            { status: "NEGOTIATION", changed_at: "2099-01-05T12:00:00.000Z" },
            { status: "REJECTED", changed_at: "2099-01-06T12:00:00.000Z" },
          ],
        }}
      />,
    );
    const region = screen.getByRole("region", { name: "Etapa do processo" });
    expect(region.className).toContain("bg-status-bad-wash");
    expect(steps().at(-1)?.label).toContain("Rejeitado");
    // Documentação não foi alcançada: sem data e sem check.
    const documentation = screen.getAllByRole("listitem")[2];
    expect(documentation.querySelector("svg")).toBeNull();
    expect(region.textContent).toContain("Este processo foi encerrado sem conclusão.");
  });
});
