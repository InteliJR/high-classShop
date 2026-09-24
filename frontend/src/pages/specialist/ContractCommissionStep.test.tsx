// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useForm } from "react-hook-form";
import { formatCurrency, type ProductCurrency } from "../../lib/currency";
import ContractCommissionStep from "./ContractCommissionStep";

function TestCommissionStep({
  currency,
  showEarningsPreview = true,
}: {
  currency: ProductCurrency;
  showEarningsPreview?: boolean;
}) {
  const {
    register,
    formState: { errors },
  } = useForm({ defaultValues: { total_commission_rate: 10 } });

  return (
    <ContractCommissionStep
      register={register}
      errors={errors}
      productLabel="veículo"
      currency={currency}
      vehiclePrice={100_000}
      specialistValue={7_000}
      showEarningsPreview={showEarningsPreview}
      onContinue={vi.fn()}
      onCancel={vi.fn()}
    />
  );
}

describe("ContractCommissionStep", () => {
  afterEach(cleanup);

  it("mostra somente o ganho estimado do especialista em BRL", () => {
    render(<TestCommissionStep currency="BRL" />);

    expect(screen.getByText("Seu ganho estimado")).toBeTruthy();
    expect(
      screen.getByText(formatCurrency(7_000, "BRL").replace(/\u00a0/g, " ")),
    ).toBeTruthy();
    expect(screen.queryByText("Comissão total")).toBeNull();
    expect(screen.queryByText("Valor líquido do vendedor")).toBeNull();
    expect(screen.queryByText("Distribuição da comissão")).toBeNull();
    expect(screen.queryByText("Plataforma")).toBeNull();
    expect(screen.queryByText("Escritório")).toBeNull();
  });

  it("formata o ganho estimado em USD sem converter o valor", () => {
    render(<TestCommissionStep currency="USD" />);

    expect(
      screen.getByText(formatCurrency(7_000, "USD").replace(/\u00a0/g, " ")),
    ).toBeTruthy();
  });

  it("não mostra o ganho antes de existir uma comissão válida", () => {
    render(
      <TestCommissionStep currency="BRL" showEarningsPreview={false} />,
    );

    expect(screen.queryByText("Seu ganho estimado")).toBeNull();
    expect(screen.queryByText(formatCurrency(7_000, "BRL"))).toBeNull();
  });
});
