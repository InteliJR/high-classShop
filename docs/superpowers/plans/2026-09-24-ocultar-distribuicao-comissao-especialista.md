# Ocultar a distribuição da comissão do especialista — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer com que o especialista veja somente o próprio ganho final, em BRL ou USD, durante todo o fluxo de criação do contrato.

**Architecture:** A correção será exclusivamente de apresentação. `CreateContractPage` continuará usando `getCommissionPreview` e preservará `totalCommissionValue` para calcular `payment_seller_value`, enquanto `ContractCommissionStep` receberá somente o valor final do especialista e um booleano que controla a prévia.

**Tech Stack:** React 19, TypeScript, react-hook-form, Vitest 4, Testing Library.

## Global Constraints

- Manter o valor total do produto e o percentual editável como contexto da negociação.
- Exibir ao especialista somente o valor final que ele receberá, formatado como `BRL` ou `USD` sem conversão.
- Não exibir comissão total, valor líquido do vendedor, plataforma, escritório ou percentuais internos do split.
- Não alterar regras financeiras, DTOs, serviços, endpoints, documento gerado ou payload do contrato.
- Executar Vitest com no máximo dois workers por causa do limite de memória da máquina.

---

## File Structure

- Create: `frontend/src/pages/specialist/ContractCommissionStep.test.tsx` — regressões unitárias da primeira etapa e da formatação monetária.
- Modify: `frontend/src/pages/specialist/ContractCommissionStep.tsx` — apresenta somente o ganho estimado do especialista.
- Modify: `frontend/src/pages/specialist/CreateContractPage.test.tsx` — regressões da segunda etapa e preservação do payload.
- Modify: `frontend/src/pages/specialist/CreateContractPage.tsx` — remove parcelas internas do resumo e simplifica as props da primeira etapa.

### Task 1: Restringir a primeira etapa ao ganho do especialista

**Files:**
- Create: `frontend/src/pages/specialist/ContractCommissionStep.test.tsx`
- Modify: `frontend/src/pages/specialist/ContractCommissionStep.tsx:16-165`
- Modify: `frontend/src/pages/specialist/CreateContractPage.tsx:816-828`

**Interfaces:**
- Consumes: `formatCurrency(value: number, currency: ProductCurrency): string` e o registro `total_commission_rate` do `react-hook-form`.
- Produces: `ContractCommissionStep` com as props `vehiclePrice`, `specialistValue` e `showEarningsPreview`; nenhuma parcela de plataforma, escritório ou vendedor entra na interface do componente.

- [ ] **Step 1: Escrever os testes que exigem somente o ganho em BRL/USD**

Criar `frontend/src/pages/specialist/ContractCommissionStep.test.tsx`:

```tsx
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
    expect(screen.getByText(formatCurrency(7_000, "BRL"))).toBeTruthy();
    expect(screen.queryByText("Comissão total")).toBeNull();
    expect(screen.queryByText("Valor líquido do vendedor")).toBeNull();
    expect(screen.queryByText("Distribuição da comissão")).toBeNull();
    expect(screen.queryByText("Plataforma")).toBeNull();
    expect(screen.queryByText("Escritório")).toBeNull();
  });

  it("formata o ganho estimado em USD sem converter o valor", () => {
    render(<TestCommissionStep currency="USD" />);

    expect(screen.getByText(formatCurrency(7_000, "USD"))).toBeTruthy();
  });

  it("não mostra o ganho antes de existir uma comissão válida", () => {
    render(
      <TestCommissionStep currency="BRL" showEarningsPreview={false} />,
    );

    expect(screen.queryByText("Seu ganho estimado")).toBeNull();
    expect(screen.queryByText(formatCurrency(7_000, "BRL"))).toBeNull();
  });
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha correta**

Run:

```bash
cd frontend
rtk npm test -- src/pages/specialist/ContractCommissionStep.test.tsx --maxWorkers=2
```

Expected: FAIL porque `Seu ganho estimado` ainda não é renderizado e a interface atual exige props do split completo.

- [ ] **Step 3: Simplificar as props e a renderização da primeira etapa**

Em `ContractCommissionStep.tsx`, substituir as props financeiras internas por:

```tsx
interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: FieldErrors<any>;
  productLabel: string;
  currency: ProductCurrency;
  vehiclePrice: number;
  specialistValue: number;
  showEarningsPreview: boolean;
  onContinue: () => void;
  onCancel: () => void;
}
```

Desestruturar somente `specialistValue` e `showEarningsPreview`. Trocar o texto auxiliar por:

```tsx
<p className="text-xs text-subtle mt-1">
  Informe o percentual combinado para calcular o seu ganho estimado.
</p>
```

Substituir todo o bloco iniciado pelo comentário `Consequência do percentual` por:

```tsx
{showEarningsPreview && (
  <div className="mt-6 pt-5 border-t">
    <p className="text-xs text-subtle">Seu ganho estimado</p>
    <p className="text-sm font-medium text-ink mt-0.5">
      {formatCurrency(specialistValue, currency)}
    </p>
  </div>
)}
```

Em `CreateContractPage.tsx`, ajustar a chamada do componente:

```tsx
<ContractCommissionStep
  register={register}
  errors={errors}
  productLabel={getProductTypeLabel(prefillData.product_type)}
  currency={prefillData.currency}
  vehiclePrice={vehiclePrice || 0}
  specialistValue={specialistValue}
  showEarningsPreview={vehiclePrice > 0 && totalCommissionValue > 0}
  onCancel={() => navigate(-1)}
  onContinue={async () => {
    const ok = await trigger("total_commission_rate");
    if (ok) setStep(2);
  }}
/>
```

- [ ] **Step 4: Executar testes da primeira etapa e da página**

Run:

```bash
cd frontend
rtk npm test -- src/pages/specialist/ContractCommissionStep.test.tsx src/pages/specialist/CreateContractPage.test.tsx --maxWorkers=2
```

Expected: 2 arquivos PASS; 8 testes PASS.

- [ ] **Step 5: Commitar a primeira etapa**

```bash
rtk git add frontend/src/pages/specialist/ContractCommissionStep.tsx frontend/src/pages/specialist/ContractCommissionStep.test.tsx frontend/src/pages/specialist/CreateContractPage.tsx
rtk git commit -m "fix: oculta split da comissão do especialista"
```

### Task 2: Restringir o resumo financeiro e preservar o payload

**Files:**
- Modify: `frontend/src/pages/specialist/CreateContractPage.test.tsx:1-180`
- Modify: `frontend/src/pages/specialist/CreateContractPage.tsx:231-245,1388-1453`

**Interfaces:**
- Consumes: `getCommissionPreview`, que continua retornando o split completo, e `previewContract(data: PreviewContractData)`.
- Produces: resumo financeiro contendo `Valor total do veículo` e `Valor da sua comissão`; `previewContract` continua recebendo `total_commission_rate` e `payment_seller_value`.

- [ ] **Step 1: Escrever as regressões da segunda etapa e do payload**

Em `CreateContractPage.test.tsx`, importar:

```tsx
import { formatCurrency } from "../../lib/currency";
```

No prefill de `beforeEach`, incluir o escritório e tornar o repasse do especialista observável:

```tsx
office: { name: "Office", rate: 20 },
specialist: {
  name: "Specialist",
  email: "specialist@example.test",
  rate: 70,
},
```

Adicionar ao `describe`:

```tsx
it("mostra somente a comissão do especialista no resumo financeiro", async () => {
  renderPage();
  await screen.findByText("Gerar Contrato de Venda");
  fireEvent.click(
    screen.getByRole("button", {
      name: /Continuar para os dados do contrato/i,
    }),
  );
  await screen.findByText("Modelo de contrato");

  expect(screen.getByText("Valor da sua comissão")).toBeTruthy();
  expect(screen.getByText(formatCurrency(7_000, "BRL"))).toBeTruthy();
  expect(screen.queryByText("Valor do Vendedor")).toBeNull();
  expect(screen.queryByText("Comissão Total")).toBeNull();
  expect(screen.queryByText("Valor da Plataforma")).toBeNull();
  expect(screen.queryByText("Valor do Escritório")).toBeNull();
  expect(screen.queryByText(/% da comissão/)).toBeNull();
});

it("preserva percentual e líquido do vendedor no payload do contrato", async () => {
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
  expect(previewContract).toHaveBeenCalledWith(
    expect.objectContaining({
      total_commission_rate: 10,
      payment_seller_value: 90_000,
    }),
  );
});
```

- [ ] **Step 2: Executar os novos testes e confirmar a exposição atual**

Run:

```bash
cd frontend
rtk npm test -- src/pages/specialist/CreateContractPage.test.tsx --maxWorkers=2
```

Expected: FAIL porque o resumo ainda contém `Valor do Vendedor`, `Comissão Total`, `Valor da Plataforma` e `Valor do Escritório`, e ainda não contém `Valor da sua comissão`.

- [ ] **Step 3: Remover parcelas internas do resumo da segunda etapa**

Em `CreateContractPage.tsx`, manter apenas os valores necessários do preview:

```tsx
const { totalCommissionValue, specialistValue } = getCommissionPreview({
  saleValue: vehiclePrice,
  totalCommissionRate,
  specialistShareRate: specialistRate,
  officeShareRate: officeRate,
});
```

Preservar o cálculo e o efeito de `sellerNetPreviewValue`, pois ele alimenta `payment_seller_value`. No resumo financeiro, remover os blocos `Valor do Vendedor`, `Comissão Total`, `Valor da Plataforma` e `Valor do Escritório`. Substituir o rótulo do bloco restante por:

```tsx
<div>
  <label className="block text-sm font-medium text-ink-soft mb-1">
    Valor da sua comissão
  </label>
  <div className="w-full px-3 py-2 bg-border-soft border border-border rounded-lg text-ink-soft cursor-default text-sm min-h-[38px] font-medium">
    {formatCurrency(specialistValue, prefillData.currency)}
  </div>
</div>
```

- [ ] **Step 4: Executar testes focados, typecheck e build**

Run:

```bash
cd frontend
rtk npm test -- src/pages/specialist/ContractCommissionStep.test.tsx src/pages/specialist/CreateContractPage.test.tsx src/lib/contract-commission.test.ts --maxWorkers=2
rtk npm run build
```

Expected: 3 arquivos PASS, 0 testes falhando; `tsc -b` e `vite build` encerram com código 0.

- [ ] **Step 5: Verificar que os textos privados não permanecem nos componentes visíveis**

Run:

```bash
rtk rg -n "Distribuição da comissão|Valor líquido do vendedor|Valor do Vendedor|Comissão Total|Valor da Plataforma|Valor do Escritório|% da comissão" frontend/src/pages/specialist/ContractCommissionStep.tsx frontend/src/pages/specialist/CreateContractPage.tsx
```

Expected: nenhuma ocorrência nos blocos visíveis; ocorrências em comentários ou seções permanentemente ocultas devem ser avaliadas e removidas quando forem relativas ao split mostrado ao especialista.

- [ ] **Step 6: Commitar a segunda etapa**

```bash
rtk git add frontend/src/pages/specialist/CreateContractPage.tsx frontend/src/pages/specialist/CreateContractPage.test.tsx
rtk git commit -m "fix: restringe resumo à comissão do especialista"
```

### Task 3: Verificação final da branch

**Files:**
- Verify: `frontend/src/pages/specialist/ContractCommissionStep.tsx`
- Verify: `frontend/src/pages/specialist/CreateContractPage.tsx`
- Verify: `frontend/src/pages/specialist/ContractCommissionStep.test.tsx`
- Verify: `frontend/src/pages/specialist/CreateContractPage.test.tsx`

**Interfaces:**
- Consumes: commits das Tasks 1 e 2.
- Produces: evidência de que a branch está limpa, baseada na `develop` atual e sem regressões focadas.

- [ ] **Step 1: Reexecutar a suíte focada com limite de memória**

```bash
cd frontend
rtk npm test -- src/pages/specialist/ContractCommissionStep.test.tsx src/pages/specialist/CreateContractPage.test.tsx src/lib/contract-commission.test.ts --maxWorkers=2
```

Expected: 3 arquivos PASS e todos os testes PASS.

- [ ] **Step 2: Reexecutar o build de produção**

```bash
cd frontend
rtk npm run build
```

Expected: código 0, sem erros TypeScript ou Vite.

- [ ] **Step 3: Inspecionar o diff e a base**

```bash
rtk git diff --check origin/develop...HEAD
rtk git status --short --branch
rtk git log --oneline origin/develop..HEAD
```

Expected: nenhum erro de whitespace; working tree limpo; somente os commits de especificação e implementação desta correção acima de `origin/develop`.
