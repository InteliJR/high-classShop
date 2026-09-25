// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import CommissionConfigurationBadge from "./CommissionConfigurationBadge";

afterEach(cleanup);

describe("CommissionConfigurationBadge", () => {
  it("sinaliza null e não sinaliza zero explícito", () => {
    const { rerender } = render(<CommissionConfigurationBadge rate={null} />);
    expect(screen.getByText("Comissão não configurada")).toBeTruthy();

    rerender(<CommissionConfigurationBadge rate={0} />);
    expect(screen.queryByText("Comissão não configurada")).toBeNull();
  });
});
