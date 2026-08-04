# Calculadora de spread de comissões (admin) + remoção de "Meus Assessorados" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao admin uma calculadora de spread de comissões (venda → especialista/escritório/plataforma, todos os campos editáveis) com versão completa e versão reduzida no dashboard; remover o item de menu "Meus Assessorados" de todos os papéis.

**Architecture:** Frontend-only. A função pura de split já existe no backend (`backend/src/features/contracts/commission-split.ts`) — é portada (não reescrita) para `frontend/src/lib/commission-split.ts`. Todos os dados (especialistas, escritórios, produtos) vêm de serviços que já existem; nenhum endpoint novo. Um componente de resultado presentacional (`CommissionSplitResult`) é reusado pela página completa e pela versão reduzida do dashboard.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v4 (tokens custom em `src/index.css`: `ink`, `ink-soft`, `surface`, `border`, `border-soft`, `muted`, `subtle`). Vitest é adicionado como dependência de dev só para testar a função pura de split (projeto não tem test runner de frontend hoje).

## Global Constraints

- **Zero mudanças no backend.** Nenhum endpoint novo, nenhuma alteração em `commission-split.ts`/`contracts.service.ts` do backend.
- **Plataforma = resíduo.** A calculadora não expõe campo de taxa de plataforma — o valor da plataforma é sempre `restante − escritório`, fiel a `resolveCommissionFromTotal`.
- **Todos os campos numéricos são sempre editáveis** (o "modo livre"). Selecionar produto/especialista/escritório só pré-preenche; nunca trava o campo.
- **Reusar tokens Tailwind existentes** (`text-ink`, `bg-surface`, `border-border`, `bg-border-soft`, `text-muted`, `focus:ring-focus-ring`) — não introduzir cores hex novas nem HeroUI (o locpay é referência de UX, não de stack).
- **Paleta de cores das 3 fatias**, para consistência com `DashboardPage.tsx` (`CommissionSplitBar`): Especialista = `emerald-500`, Escritório = `sky-500`, Plataforma = `violet-500`.
- Verificação final obrigatória: `cd frontend && npm run lint && npm run build` (e `npm run test` para o Task 1) devem passar sem erros novos antes de considerar o plano concluído.

---

### Task 1: Portar a função pura de split + setup de teste (Vitest)

**Files:**
- Create: `frontend/src/lib/commission-split.ts`
- Create: `frontend/src/lib/commission-split.test.ts`
- Modify: `frontend/package.json` (script `test`, devDependency `vitest`)
- Modify: `frontend/vite.config.ts` (config do Vitest)

**Interfaces:**
- Produces: `computeNestedCommissionSplit(input: NestedCommissionInput): NestedCommissionSplit`, `effectiveRate(value: number, saleValue: number): number`, tipos `NestedCommissionInput` e `NestedCommissionSplit` — consumidos pelas Tasks 2, 3 e 4.

- [ ] **Step 1: Instalar o Vitest**

Run: `cd frontend && npm install -D vitest`

- [ ] **Step 2: Apontar o Vite config para o Vitest**

Editar `frontend/vite.config.ts` (arquivo atual, 21 linhas) — trocar o import de `defineConfig` e adicionar o bloco `test`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 3: Adicionar o script `test` no `package.json`**

No bloco `"scripts"` de `frontend/package.json`, adicionar `"test": "vitest run"` (mantendo `dev`, `build`, `lint`, `preview` como estão).

- [ ] **Step 4: Escrever o teste (falha esperada — módulo ainda não existe)**

Criar `frontend/src/lib/commission-split.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeNestedCommissionSplit, effectiveRate } from "./commission-split";

describe("computeNestedCommissionSplit", () => {
  it("divide bolo em especialista / escritório / plataforma (aninhado)", () => {
    const r = computeNestedCommissionSplit({
      proposalValue: 100_000,
      totalCommissionRate: 10, // bolo = 10.000
      specialistShareRate: 70, // 70% do bolo
      officeShareRate: 40, // 40% do restante
    });
    expect(r.bolo).toBe(10_000);
    expect(r.specialistValue).toBe(7_000);
    expect(r.officeValue).toBe(1_200); // 40% de 3.000
    expect(r.platformValue).toBe(1_800); // resto do restante
  });

  it("sem escritório: restante inteiro vai pra plataforma", () => {
    const r = computeNestedCommissionSplit({
      proposalValue: 100_000,
      totalCommissionRate: 10,
      specialistShareRate: 70,
      officeShareRate: 0,
    });
    expect(r.officeValue).toBe(0);
    expect(r.platformValue).toBe(3_000);
  });

  it("as três fatias somam exatamente o bolo (sem drift de centavos)", () => {
    const r = computeNestedCommissionSplit({
      proposalValue: 99_999.99,
      totalCommissionRate: 7.33,
      specialistShareRate: 63.5,
      officeShareRate: 41.7,
    });
    expect(r.specialistValue + r.officeValue + r.platformValue).toBe(r.bolo);
  });

  it("especialista com 100% do bolo zera escritório e plataforma", () => {
    const r = computeNestedCommissionSplit({
      proposalValue: 50_000,
      totalCommissionRate: 8,
      specialistShareRate: 100,
      officeShareRate: 50,
    });
    expect(r.specialistValue).toBe(r.bolo);
    expect(r.officeValue).toBe(0);
    expect(r.platformValue).toBe(0);
  });
});

describe("effectiveRate", () => {
  it("calcula a taxa efetiva sobre a venda", () => {
    expect(effectiveRate(7_000, 100_000)).toBe(7);
    expect(effectiveRate(1_200, 100_000)).toBe(1.2);
  });

  it("retorna 0 quando a venda é 0", () => {
    expect(effectiveRate(100, 0)).toBe(0);
  });
});
```

- [ ] **Step 5: Rodar o teste e confirmar que falha**

Run: `cd frontend && npx vitest run src/lib/commission-split.test.ts`
Expected: FAIL — `Cannot find module './commission-split'` (o arquivo ainda não existe).

- [ ] **Step 6: Implementar a função pura**

Criar `frontend/src/lib/commission-split.ts`:

```ts
// ponytail: cópia da lógica pura de backend/src/features/contracts/commission-split.ts
// (fonte de verdade do split real do contrato) — manter em sync manualmente se aquele
// arquivo mudar; sem endpoint novo, calculadora roda 100% no client.

export interface NestedCommissionInput {
  /** Valor de referência da venda (produto ou manual). */
  proposalValue: number;
  /** % da venda que vira o "bolo" (comissão total), 0–100. */
  totalCommissionRate: number;
  /** Fatia do especialista SOBRE O BOLO, 0–100. */
  specialistShareRate: number;
  /** Fatia do escritório SOBRE O RESTANTE, 0–100; 0 quando não há escritório. */
  officeShareRate: number;
}

export interface NestedCommissionSplit {
  bolo: number;
  specialistValue: number;
  officeValue: number;
  platformValue: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Split aninhado da comissão:
 *   bolo         = venda × total%
 *   especialista = bolo × fatiaEspecialista%
 *   restante     = bolo − especialista
 *   escritório   = restante × fatiaEscritório%
 *   plataforma   = restante − escritório   (resíduo)
 */
export function computeNestedCommissionSplit(
  input: NestedCommissionInput,
): NestedCommissionSplit {
  const bolo = round2((input.proposalValue * input.totalCommissionRate) / 100);
  const specialistValue = round2((bolo * input.specialistShareRate) / 100);
  const restante = round2(bolo - specialistValue);
  const officeValue = round2((restante * input.officeShareRate) / 100);
  const platformValue = round2(restante - officeValue);
  return { bolo, specialistValue, officeValue, platformValue };
}

/** Taxa efetiva de um valor sobre a venda, em %. */
export function effectiveRate(value: number, saleValue: number): number {
  return saleValue > 0 ? round2((value / saleValue) * 100) : 0;
}
```

- [ ] **Step 7: Rodar o teste e confirmar que passa**

Run: `cd frontend && npx vitest run src/lib/commission-split.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/src/lib/commission-split.ts frontend/src/lib/commission-split.test.ts
git commit -m "feat(admin): função pura de split de comissão + vitest"
```

---

### Task 2: Componente de resultado (`CommissionSplitResult`)

**Files:**
- Create: `frontend/src/components/commission/CommissionSplitResult.tsx`

**Interfaces:**
- Consumes: `NestedCommissionSplit`, `effectiveRate` de `frontend/src/lib/commission-split.ts` (Task 1).
- Produces: `CommissionSplitResult({ saleValue, split, compact? }: CommissionSplitResultProps)` — consumido pelas Tasks 3 e 4.

- [ ] **Step 1: Criar o componente**

Criar `frontend/src/components/commission/CommissionSplitResult.tsx`:

```tsx
import type { NestedCommissionSplit } from "../../lib/commission-split";
import { effectiveRate } from "../../lib/commission-split";

export interface CommissionSplitResultProps {
  saleValue: number;
  split: NestedCommissionSplit;
  /** Versão reduzida (card do dashboard): sem tabela, sem linha de bolo. */
  compact?: boolean;
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DOT = {
  specialist: "bg-emerald-500",
  office: "bg-sky-500",
  platform: "bg-violet-500",
} as const;

export function CommissionSplitResult({
  saleValue,
  split,
  compact = false,
}: CommissionSplitResultProps) {
  if (compact) {
    const rows = [
      { label: "Especialista", value: split.specialistValue, dot: DOT.specialist },
      { label: "Escritório", value: split.officeValue, dot: DOT.office },
      { label: "Plataforma", value: split.platformValue, dot: DOT.platform },
    ];
    return (
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1.5 text-ink-soft">
              <span className={`w-2 h-2 rounded-full shrink-0 ${row.dot}`} />
              {row.label}
            </span>
            <span className="font-semibold text-ink">{brl(row.value)}</span>
          </div>
        ))}
      </div>
    );
  }

  const bodyRows = [
    { label: "Comissão total (bolo)", value: split.bolo, dot: null as string | null },
    { label: "Especialista", value: split.specialistValue, dot: DOT.specialist },
    { label: "Escritório", value: split.officeValue, dot: DOT.office },
  ];

  return (
    <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
      <thead>
        <tr className="bg-border-soft text-ink-soft">
          <th className="text-left px-3 py-2 font-medium">Indicador</th>
          <th className="text-right px-3 py-2 font-medium">Valor</th>
          <th className="text-right px-3 py-2 font-medium">% da venda</th>
        </tr>
      </thead>
      <tbody>
        {bodyRows.map((row) => (
          <tr key={row.label} className="border-t border-border">
            <td className="px-3 py-2 text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                {row.dot && (
                  <span className={`w-2 h-2 rounded-full shrink-0 ${row.dot}`} />
                )}
                {row.label}
              </span>
            </td>
            <td className="px-3 py-2 text-right font-medium text-ink">
              {brl(row.value)}
            </td>
            <td className="px-3 py-2 text-right text-ink-soft">
              {effectiveRate(row.value, saleValue)}%
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="bg-ink text-surface font-bold">
          <td className="px-3 py-2">
            <span className="inline-flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${DOT.platform}`} />
              Plataforma
            </span>
          </td>
          <td className="px-3 py-2 text-right">{brl(split.platformValue)}</td>
          <td className="px-3 py-2 text-right">
            {effectiveRate(split.platformValue, saleValue)}%
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: sem erros novos relacionados a este arquivo.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/commission/CommissionSplitResult.tsx
git commit -m "feat(admin): componente de resultado do split de comissão"
```

---

### Task 3: Página completa da calculadora + rota + item de menu

**Files:**
- Create: `frontend/src/pages/admin/CommissionCalculatorPage.tsx`
- Modify: `frontend/src/routes/routes.tsx` (import + rota `/admin/calculator`)
- Modify: `frontend/src/layouts/Sidebar.tsx` (item "Calculadora" no bloco ADMIN)

**Interfaces:**
- Consumes: `computeNestedCommissionSplit` (Task 1), `CommissionSplitResult` (Task 2), `getSpecialists` (`Specialist` tem `id: string`, `name`, `surname`, `commission_rate?: number | null`), `getCompanies` (`Company` tem `id: string`, `name`, `commission_rate?: number | null`), `getCars`/`getBoats`/`getAircrafts(1, 100)` (retornam `{ cars/boats/aircrafts: Product[] }`, `Product` tem `id: number`, `marca`, `modelo`, `valor: number`).

- [ ] **Step 1: Criar a página**

Criar `frontend/src/pages/admin/CommissionCalculatorPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/patterns/PageHeader";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { CommissionSplitResult } from "../../components/commission/CommissionSplitResult";
import { computeNestedCommissionSplit } from "../../lib/commission-split";
import {
  getSpecialists,
  type Specialist,
} from "../../services/specialists.service";
import { getCompanies, type Company } from "../../services/companies.service";
import { getCars } from "../../services/cars.service";
import { getBoats } from "../../services/boats.service";
import { getAircrafts } from "../../services/aircrafts.service";
import type { Product } from "../../types/types";

type ProductCategory = "CAR" | "BOAT" | "AIRCRAFT";

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  CAR: "Carro",
  BOAT: "Embarcação",
  AIRCRAFT: "Aeronave",
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function fetchProductsByCategory(
  category: ProductCategory,
): Promise<Product[]> {
  if (category === "CAR") return (await getCars(1, 100)).cars;
  if (category === "BOAT") return (await getBoats(1, 100)).boats;
  return (await getAircrafts(1, 100)).aircrafts;
}

const selectClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-focus-ring";
const labelClass = "block text-sm font-medium text-ink-soft mb-1";

export default function CommissionCalculatorPage() {
  const [saleValue, setSaleValue] = useState(0);
  const [totalCommissionRate, setTotalCommissionRate] = useState(10);
  const [specialistShareRate, setSpecialistShareRate] = useState(0);
  const [officeShareRate, setOfficeShareRate] = useState(0);

  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [category, setCategory] = useState<ProductCategory | "">("");
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  useEffect(() => {
    getSpecialists().then(setSpecialists).catch(() => setSpecialists([]));
    getCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    if (!category) {
      setProducts([]);
      return;
    }
    setIsLoadingProducts(true);
    fetchProductsByCategory(category)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setIsLoadingProducts(false));
  }, [category]);

  const split = useMemo(
    () =>
      computeNestedCommissionSplit({
        proposalValue: saleValue,
        totalCommissionRate,
        specialistShareRate,
        officeShareRate,
      }),
    [saleValue, totalCommissionRate, specialistShareRate, officeShareRate],
  );

  return (
    <div className="w-full">
      <PageHeader title="Calculadora de comissões" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-ink">Venda</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Categoria do produto (opcional)</label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as ProductCategory | "")
                  }
                  className={selectClass}
                >
                  <option value="">Nenhuma — valor manual</option>
                  <option value="CAR">Carro</option>
                  <option value="BOAT">Embarcação</option>
                  <option value="AIRCRAFT">Aeronave</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Produto {category && `(${CATEGORY_LABEL[category]})`}
                </label>
                <select
                  disabled={!category || isLoadingProducts}
                  onChange={(e) => {
                    const product = products.find(
                      (p) => String(p.id) === e.target.value,
                    );
                    if (product) setSaleValue(product.valor);
                  }}
                  className={selectClass}
                >
                  <option value="">
                    {isLoadingProducts ? "Carregando..." : "Selecionar produto"}
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.marca} {p.modelo} — {brl(p.valor)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Valor de venda (R$)</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={saleValue}
                onChange={(e) => setSaleValue(Number(e.target.value) || 0)}
              />
            </div>

            <div>
              <label className={labelClass}>Comissão total da venda (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={totalCommissionRate}
                onChange={(e) =>
                  setTotalCommissionRate(Number(e.target.value) || 0)
                }
              />
            </div>
          </Card>

          <Card className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-ink">
              Especialista e escritório
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Especialista (opcional)</label>
                <select
                  onChange={(e) => {
                    const specialist = specialists.find(
                      (s) => s.id === e.target.value,
                    );
                    setSpecialistShareRate(specialist?.commission_rate ?? 0);
                  }}
                  className={selectClass}
                >
                  <option value="">Nenhum — fatia manual</option>
                  {specialists.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.surname}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Fatia do especialista sobre o bolo (%)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={specialistShareRate}
                  onChange={(e) =>
                    setSpecialistShareRate(Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Escritório (opcional)</label>
                <select
                  onChange={(e) => {
                    const company = companies.find((c) => c.id === e.target.value);
                    setOfficeShareRate(company?.commission_rate ?? 0);
                  }}
                  className={selectClass}
                >
                  <option value="">Nenhum</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Fatia do escritório sobre o restante (%)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={officeShareRate}
                  onChange={(e) =>
                    setOfficeShareRate(Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:sticky lg:top-6 h-fit">
          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">Resultado</h2>
            <CommissionSplitResult saleValue={saleValue} split={split} />
          </Card>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Registrar a rota**

Em `frontend/src/routes/routes.tsx`, adicionar o import junto aos outros de `pages/admin/` (perto da linha 21, após `import DatabasePage from "../pages/admin/DatabasePage";`):

```tsx
import CommissionCalculatorPage from "../pages/admin/CommissionCalculatorPage";
```

E adicionar a rota logo após o bloco `/admin/commissions` (linhas 257-266), seguindo exatamente o mesmo padrão:

```tsx
    {
      path: "/admin/calculator",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <CommissionCalculatorPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
```

- [ ] **Step 3: Adicionar o item de menu**

Em `frontend/src/layouts/Sidebar.tsx`, adicionar `Calculator` ao import de `lucide-react` (linha 1-17, junto com `Percent`):

```tsx
import {
  TextAlignJustifyIcon,
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  Car,
  Ship,
  Plane,
  Package,
  Home,
  FilePen,
  Settings,
  Percent,
  Database,
  UserCheck,
  Calculator,
} from "lucide-react";
```

E inserir o item logo após o bloco `/admin/commissions` no `case "ADMIN":` (linhas 148-152):

```tsx
          {
            to: "/admin/commissions",
            label: "Comissões",
            icon: <Percent size={20} />,
          },
          {
            to: "/admin/calculator",
            label: "Calculadora",
            icon: <Calculator size={20} />,
          },
```

- [ ] **Step 4: Rodar lint e build**

Run: `cd frontend && npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/CommissionCalculatorPage.tsx frontend/src/routes/routes.tsx frontend/src/layouts/Sidebar.tsx
git commit -m "feat(admin): página completa da calculadora de comissões em /admin/calculator"
```

---

### Task 4: Versão reduzida no dashboard

**Files:**
- Create: `frontend/src/components/commission/CommissionMiniCalculator.tsx`
- Modify: `frontend/src/pages/admin/DashboardPage.tsx`

**Interfaces:**
- Consumes: `computeNestedCommissionSplit` (Task 1), `CommissionSplitResult` com `compact` (Task 2), `getSpecialists` (Task 3 já validou o tipo).
- Produces: `CommissionMiniCalculator()` — sem props, self-contained; renderizado dentro de `DashboardPage`.

- [ ] **Step 1: Criar o mini componente**

Criar `frontend/src/components/commission/CommissionMiniCalculator.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calculator } from "lucide-react";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { CommissionSplitResult } from "./CommissionSplitResult";
import { computeNestedCommissionSplit } from "../../lib/commission-split";
import {
  getSpecialists,
  type Specialist,
} from "../../services/specialists.service";

export function CommissionMiniCalculator() {
  const [saleValue, setSaleValue] = useState(0);
  const [totalCommissionRate, setTotalCommissionRate] = useState(10);
  const [specialistShareRate, setSpecialistShareRate] = useState(0);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);

  useEffect(() => {
    getSpecialists().then(setSpecialists).catch(() => setSpecialists([]));
  }, []);

  const split = useMemo(
    () =>
      computeNestedCommissionSplit({
        proposalValue: saleValue,
        totalCommissionRate,
        specialistShareRate,
        officeShareRate: 0,
      }),
    [saleValue, totalCommissionRate, specialistShareRate],
  );

  return (
    <Card className="h-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-ink-soft" />
          <h2 className="text-lg font-semibold text-ink">Calculadora rápida</h2>
        </div>
        <Link
          to="/admin/calculator"
          className="flex items-center gap-1 text-sm text-ink-soft hover:text-ink shrink-0 whitespace-nowrap"
        >
          calculadora completa <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-xs text-muted mb-1">
            Valor de venda (R$)
          </label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={saleValue}
            onChange={(e) => setSaleValue(Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">
            Comissão total (%)
          </label>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={totalCommissionRate}
            onChange={(e) =>
              setTotalCommissionRate(Number(e.target.value) || 0)
            }
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Especialista</label>
          <select
            onChange={(e) => {
              const specialist = specialists.find((s) => s.id === e.target.value);
              setSpecialistShareRate(specialist?.commission_rate ?? 0);
            }}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
          >
            <option value="">Nenhum</option>
            {specialists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.surname}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <CommissionSplitResult saleValue={saleValue} split={split} compact />
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Encaixar no dashboard**

Em `frontend/src/pages/admin/DashboardPage.tsx`:

Adicionar o import (junto aos outros, perto da linha 34, após `import { PageHeader } ...`):

```tsx
import { CommissionMiniCalculator } from "../../components/commission/CommissionMiniCalculator";
```

Inserir uma nova seção full-width logo depois do grid `lg:grid-cols-2` existente (fecha na linha 338 com `</div>`) e antes do comentário `{/* Gráficos */}` (linha 340):

```tsx
      {/* Calculadora rápida de comissões */}
      <div className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: cardDuration, delay: 0.19 }}
        >
          <CommissionMiniCalculator />
        </motion.div>
      </div>

```

- [ ] **Step 3: Rodar lint e build**

Run: `cd frontend && npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/commission/CommissionMiniCalculator.tsx frontend/src/pages/admin/DashboardPage.tsx
git commit -m "feat(admin-dashboard): card de calculadora rápida de comissões"
```

---

### Task 5: Remover "Meus Assessorados" da navegação (todos os papéis)

**Files:**
- Modify: `frontend/src/layouts/Sidebar.tsx`

**Interfaces:**
- Nenhuma — remoção pura de UI. `AdvisorDashboardPage.tsx`, a rota `/advisor/dashboard`, `/advisor/accept` e `advisor.service.ts` permanecem intactos (fluxo de convite/aceite continua funcionando; só o item de menu some).

- [ ] **Step 1: Remover o bloco que injeta o item de menu**

Em `frontend/src/layouts/Sidebar.tsx`, remover o bloco (linhas 196-202, logo após o `switch`):

```tsx
    if (user.role !== "OFFICE") {
      links.push({
        to: "/advisor/dashboard",
        label: "Meus Assessorados",
        icon: <UserCheck size={20} />,
      });
    }
```

Remover também o import agora não usado `UserCheck` do bloco de `lucide-react` (linha 16) — **atenção:** confirmar antes que `UserCheck` não é usado em nenhum outro lugar do arquivo (`grep -n "UserCheck" frontend/src/layouts/Sidebar.tsx` deve retornar só a linha do import após a remoção; se sim, apagar a linha do import).

- [ ] **Step 2: Rodar lint**

Run: `cd frontend && npm run lint`
Expected: sem erros (nenhum import não usado sobrando).

- [ ] **Step 3: Verificação manual**

Rodar `cd frontend && npm run dev`, logar como cada papel (CUSTOMER, CONSULTANT, SPECIALIST, ADMIN) e confirmar que "Meus Assessorados" não aparece mais em nenhum menu. Confirmar que "Meus Clientes" (consultor, `/consultant/clients`) continua aparecendo normalmente — é uma feature diferente e não deve ser tocada.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/layouts/Sidebar.tsx
git commit -m "fix(nav): remove item 'Meus Assessorados' de todos os papéis"
```

---

## Verificação final (rodar após a Task 5)

```bash
cd frontend
npm run lint
npm run build
npm run test
```

Todos devem passar sem erros novos antes de considerar o plano concluído.
