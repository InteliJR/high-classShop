# Admin Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the admin dashboard (`frontend/src/pages/admin/DashboardPage.tsx`) — drop the meaningless "Taxa de Conversão" card, add a commission-per-process summary, add a database-record-count preview, and give both the KPI row and the quick-action links a nicer visual treatment with subtle entrance animation.

**Architecture:** The dashboard keeps its single network call (`GET /dashboard/stats`). `DashboardService.getAdminStats()` gains two new fields by calling the already-existing `CommissionsService.listSales()` and a new `AdminDatabaseService.countAll()` method — no new HTTP endpoints. On the frontend, `DashboardPage.tsx` renders two new cards from those fields and wraps every card in a `framer-motion` fade/rise entrance (the pattern already used in `components/ui/dialog.tsx`).

**Tech Stack:** NestJS + Prisma (backend), React + TypeScript + Tailwind + recharts + framer-motion (frontend, all already dependencies — nothing new to install).

Reference documents:
- Spec: `docs/superpowers/specs/2026-07-31-admin-dashboard-redesign-design.md`

## Global Constraints

- No new HTTP endpoints — `commissionSummary` and `databaseCounts` are extra fields on the existing `GET /dashboard/stats` response.
- Do not touch `SpecialistDashboard.tsx` or `DashboardService.getSpecialistStats()` — separate `conversionRate` field, out of scope.
- Do not port framer-motion patterns, the `ds/*` system, or the `modern/*` card system from `locpay_full` — inspiration was conceptual only, nothing gets copied in.
- Animation duration is `useReducedMotion() ? 0 : 0.2` seconds, fade + small `y` rise only (no scale/bounce), matching `docs/docs/design.md`'s "Animações sutis (fade/slide 150–250ms) — sem motion excessivo." No animated number counters, no per-row animation inside the recent-sales list.
- Commission split bar colors are `bg-emerald-500` (especialista) / `bg-sky-500` (escritório) / `bg-violet-500` (plataforma) — same colors `CommissionsPage.tsx` already uses. Do not use the `--color-status-*` design tokens for this (those are reserved for process-status badges elsewhere).
- Hover elevation on clickable tiles uses the existing `shadow-ds-floating` token via plain CSS (`transition-shadow hover:shadow-ds-floating`) — no framer-motion needed for hover states.
- **Machine constraint (this repo's CLAUDE.md + project memory):** never run `npm run start:dev` / `nest start --watch` (backend dev server) on this machine — it has crashed the machine before. Backend verification in this plan uses `npm test` (scoped, capped workers) and `npm run build` only, never a live dev server. Any `npm test` invocation must be scoped to a single file/pattern and capped with `--maxWorkers=2` — never run the bare full suite.
- 5 pre-existing failing tests in `resolveCommissionFromTotal` (nested-model vs flat-mock mismatch) are known, unrelated to this work — do not attempt to fix them as part of this plan, and do not treat them as a regression you introduced.

---

## Task 1: `AdminDatabaseService.countAll()`

**Files:**
- Modify: `backend/src/features/admin-database/admin-database.service.ts`
- Test: `backend/src/features/admin-database/admin-database.service.spec.ts` (create)

**Interfaces:**
- Consumes: nothing new — reuses the existing module-level `ENTITIES` whitelist already defined in this file.
- Produces: `AdminDatabaseService.countAll(): Promise<{ key: string; label: string; count: number }[]>` — one entry per whitelisted entity, in the order `Object.entries(ENTITIES)` yields (`users, companies, cars, boats, aircrafts, processes, contracts, proposals, appointments`). Task 2 consumes this.

- [ ] **Step 1: Write the failing test**

Create `backend/src/features/admin-database/admin-database.service.spec.ts`:

```ts
import { AdminDatabaseService } from './admin-database.service';

function mkPrisma() {
  return {
    user: { count: jest.fn().mockResolvedValue(3) },
    company: { count: jest.fn().mockResolvedValue(1) },
    car: { count: jest.fn().mockResolvedValue(5) },
    boat: { count: jest.fn().mockResolvedValue(2) },
    aircraft: { count: jest.fn().mockResolvedValue(0) },
    process: { count: jest.fn().mockResolvedValue(4) },
    contract: { count: jest.fn().mockResolvedValue(2) },
    negotiationProposal: { count: jest.fn().mockResolvedValue(1) },
    appointment: { count: jest.fn().mockResolvedValue(6) },
  } as any;
}

describe('AdminDatabaseService — countAll', () => {
  it('retorna uma entrada por entidade do whitelist, com key/label/count', async () => {
    const svc = new AdminDatabaseService(mkPrisma());
    const result = await svc.countAll();

    expect(result).toHaveLength(9);
    expect(result).toContainEqual({ key: 'users', label: 'Usuários', count: 3 });
    expect(result).toContainEqual({
      key: 'companies',
      label: 'Escritórios',
      count: 1,
    });
    expect(result).toContainEqual({
      key: 'contracts',
      label: 'Contratos',
      count: 2,
    });
    expect(result).toContainEqual({
      key: 'appointments',
      label: 'Agendamentos',
      count: 6,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest admin-database.service.spec.ts --maxWorkers=2`
Expected: FAIL with `svc.countAll is not a function`.

- [ ] **Step 3: Implement `countAll()`**

In `backend/src/features/admin-database/admin-database.service.ts`, add this method to the `AdminDatabaseService` class (below `listEntities()`, above `list()`):

```ts
  async countAll(): Promise<{ key: string; label: string; count: number }[]> {
    return Promise.all(
      Object.entries(ENTITIES).map(async ([key, cfg]) => ({
        key,
        label: cfg.label,
        count: await (this.prisma as any)[cfg.model].count(),
      })),
    );
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest admin-database.service.spec.ts --maxWorkers=2`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/features/admin-database/admin-database.service.ts backend/src/features/admin-database/admin-database.service.spec.ts
git commit -m "feat(admin-database): adiciona countAll() para preview de contagens no dashboard"
```

---

## Task 2: `DashboardService` — remove conversionRate, add commissionSummary + databaseCounts

**Files:**
- Modify: `backend/src/features/commissions/commissions.service.ts` (export `round2`)
- Modify: `backend/src/features/commissions/commissions.module.ts` (export `CommissionsService`)
- Modify: `backend/src/features/admin-database/admin-database.module.ts` (export `AdminDatabaseService`)
- Modify: `backend/src/features/dashboard/dashboard.module.ts` (import both modules above)
- Modify: `backend/src/features/dashboard/dashboard.service.ts`
- Test: `backend/src/features/dashboard/dashboard.service.spec.ts` (create)

**Interfaces:**
- Consumes: `AdminDatabaseService.countAll()` from Task 1; `CommissionsService.listSales(): Promise<SaleCommission[]>` (already exists, unmodified); the now-exported `round2(n: number): number` and `SaleCommission` type from `commissions.service.ts`.
- Produces: `DashboardService.getAdminStats()` returns (no more `conversionRate`):
  ```ts
  {
    activeProcesses: number;
    activeCompanies: number;
    totalClients: number;
    specialistsCount: number;
    totalProducts: number;
    productsByType: { cars: number; boats: number; aircrafts: number };
    salesByMonth: MonthData[];
    consultantsPerformance: ConsultantPerformanceData[];
    commissionSummary: {
      totalPaid: number;
      thisMonth: number;
      avgTicket: number;
      recentSales: SaleCommission[]; // top 5
    };
    databaseCounts: { key: string; label: string; count: number }[];
  }
  ```
  Task 4 (frontend) consumes this shape.

- [ ] **Step 1: Export `round2` from `commissions.service.ts`**

In `backend/src/features/commissions/commissions.service.ts`, change:

```ts
const round2 = (n: number): number => Math.round(n * 100) / 100;
```

to:

```ts
export const round2 = (n: number): number => Math.round(n * 100) / 100;
```

- [ ] **Step 2: Export the services from their modules**

In `backend/src/features/commissions/commissions.module.ts`, add `exports`:

```ts
import { Module } from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { CommissionsController } from './commissions.controller';

@Module({
  controllers: [CommissionsController],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
```

In `backend/src/features/admin-database/admin-database.module.ts`, add `exports`:

```ts
import { Module } from '@nestjs/common';
import { AdminDatabaseService } from './admin-database.service';
import { AdminDatabaseController } from './admin-database.controller';

@Module({
  controllers: [AdminDatabaseController],
  providers: [AdminDatabaseService],
  exports: [AdminDatabaseService],
})
export class AdminDatabaseModule {}
```

In `backend/src/features/dashboard/dashboard.module.ts`, import both:

```ts
import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { CommissionsModule } from '../commissions/commissions.module';
import { AdminDatabaseModule } from '../admin-database/admin-database.module';

@Module({
  imports: [CommissionsModule, AdminDatabaseModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
```

- [ ] **Step 3: Write the failing tests**

Create `backend/src/features/dashboard/dashboard.service.spec.ts`:

```ts
import { DashboardService } from './dashboard.service';

function mkPrisma() {
  return {
    company: { count: jest.fn().mockResolvedValue(0) },
    process: { count: jest.fn().mockResolvedValue(0) },
    user: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    car: { count: jest.fn().mockResolvedValue(0) },
    boat: { count: jest.fn().mockResolvedValue(0) },
    aircraft: { count: jest.fn().mockResolvedValue(0) },
  } as any;
}

function mkCommissionsService(sales: any[] = []) {
  return { listSales: jest.fn().mockResolvedValue(sales) } as any;
}

function mkAdminDatabaseService(counts: any[] = []) {
  return { countAll: jest.fn().mockResolvedValue(counts) } as any;
}

function mkSvc(sales: any[] = [], counts: any[] = []) {
  return new DashboardService(
    mkPrisma(),
    mkCommissionsService(sales),
    mkAdminDatabaseService(counts),
  );
}

describe('DashboardService — getAdminStats sem conversionRate', () => {
  it('não retorna mais o campo conversionRate', async () => {
    const result = await mkSvc().getAdminStats();
    expect(result).not.toHaveProperty('conversionRate');
  });
});

describe('DashboardService — commissionSummary', () => {
  it('soma totalPaid e calcula ticket médio corretamente', async () => {
    const sales = [
      { totalCommission: 1000, signedAt: new Date('2020-01-15') },
      { totalCommission: 2000, signedAt: new Date('2020-01-20') },
    ];
    const result = await mkSvc(sales).getAdminStats();
    expect(result.commissionSummary.totalPaid).toBe(3000);
    expect(result.commissionSummary.avgTicket).toBe(1500);
  });

  it('thisMonth soma só vendas assinadas no mês corrente', async () => {
    const now = new Date();
    const thisMonthSale = { totalCommission: 500, signedAt: now };
    const oldSale = {
      totalCommission: 9999,
      signedAt: new Date(now.getFullYear() - 1, 0, 1),
    };
    const result = await mkSvc([thisMonthSale, oldSale]).getAdminStats();
    expect(result.commissionSummary.thisMonth).toBe(500);
  });

  it('avgTicket e totalPaid são 0 quando não há vendas', async () => {
    const result = await mkSvc([]).getAdminStats();
    expect(result.commissionSummary.avgTicket).toBe(0);
    expect(result.commissionSummary.totalPaid).toBe(0);
  });

  it('recentSales limita a 5, preservando a ordem recebida', async () => {
    const sales = Array.from({ length: 8 }, (_, i) => ({
      totalCommission: i,
      signedAt: new Date(),
    }));
    const result = await mkSvc(sales).getAdminStats();
    expect(result.commissionSummary.recentSales).toHaveLength(5);
    expect(result.commissionSummary.recentSales[0].totalCommission).toBe(0);
  });
});

describe('DashboardService — databaseCounts', () => {
  it('repassa o retorno do AdminDatabaseService sem transformar', async () => {
    const counts = [{ key: 'users', label: 'Usuários', count: 42 }];
    const result = await mkSvc([], counts).getAdminStats();
    expect(result.databaseCounts).toEqual(counts);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd backend && npx jest dashboard.service.spec.ts --maxWorkers=2`
Expected: FAIL (constructor signature mismatch — `DashboardService` doesn't accept 3 args yet).

- [ ] **Step 5: Implement the changes in `dashboard.service.ts`**

In `backend/src/features/dashboard/dashboard.service.ts`:

Add imports at the top:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CommissionsService,
  SaleCommission,
  round2,
} from '../commissions/commissions.service';
import { AdminDatabaseService } from '../admin-database/admin-database.service';
```

Change the constructor:

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionsService: CommissionsService,
    private readonly adminDatabaseService: AdminDatabaseService,
  ) {}
```

Replace the whole `getAdminStats()` method with:

```ts
  async getAdminStats() {
    // Todas as consultas independentes rodam em paralelo (antes eram sequenciais).
    const [
      activeCompanies,
      activeProcesses,
      totalClients,
      specialistsCount,
      totalCars,
      totalBoats,
      totalAircrafts,
      salesByMonth,
      consultantsPerformance,
      sales,
      databaseCounts,
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.process.count({
        where: { status: { in: ['SCHEDULING', 'NEGOTIATION'] } },
      }),
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.user.count({ where: { role: 'SPECIALIST' } }),
      this.prisma.car.count(),
      this.prisma.boat.count(),
      this.prisma.aircraft.count(),
      this.buildMonthlySalesData({}),
      this.getConsultantsPerformance(),
      this.commissionsService.listSales(),
      this.adminDatabaseService.countAll(),
    ]);

    const totalProducts = totalCars + totalBoats + totalAircrafts;

    return {
      activeProcesses,
      activeCompanies,
      totalClients,
      specialistsCount,
      totalProducts,
      productsByType: {
        cars: totalCars,
        boats: totalBoats,
        aircrafts: totalAircrafts,
      },
      salesByMonth,
      consultantsPerformance,
      commissionSummary: this.buildCommissionSummary(sales),
      databaseCounts,
    };
  }

  private buildCommissionSummary(sales: SaleCommission[]) {
    const now = new Date();
    const totalPaid = round2(
      sales.reduce((sum, s) => sum + s.totalCommission, 0),
    );
    const thisMonth = round2(
      sales
        .filter(
          (s) =>
            s.signedAt &&
            s.signedAt.getFullYear() === now.getFullYear() &&
            s.signedAt.getMonth() === now.getMonth(),
        )
        .reduce((sum, s) => sum + s.totalCommission, 0),
    );
    const avgTicket = sales.length > 0 ? round2(totalPaid / sales.length) : 0;

    return {
      totalPaid,
      thisMonth,
      avgTicket,
      recentSales: sales.slice(0, 5),
    };
  }
```

Delete the old `conversionRate` calculation lines (the `totalProcesses`/`completedProcesses` queries and the `Math.round((completedProcesses / totalProcesses) * 100)` block) — they're fully replaced by the block above. Leave `getSpecialistStats()`, `translateStatus()`, `buildMonthlySalesData()` and `getConsultantsPerformance()` untouched.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && npx jest dashboard.service.spec.ts admin-database.service.spec.ts --maxWorkers=2`
Expected: PASS (all tests in both files)

- [ ] **Step 7: Commit**

```bash
git add backend/src/features/commissions/commissions.service.ts \
        backend/src/features/commissions/commissions.module.ts \
        backend/src/features/admin-database/admin-database.module.ts \
        backend/src/features/dashboard/dashboard.module.ts \
        backend/src/features/dashboard/dashboard.service.ts \
        backend/src/features/dashboard/dashboard.service.spec.ts
git commit -m "feat(dashboard): remove taxa de conversão, adiciona commissionSummary e databaseCounts ao dashboard admin"
```

---

## Task 3: `CommissionsPage.tsx` opens directly on the "Por venda" tab via `?tab=`

**Files:**
- Modify: `frontend/src/pages/admin/CommissionsPage.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (independent of Task 1/2 — can be done in parallel with them).
- Produces: `/admin/commissions?tab=sales` opens with the "Por venda" tab active. Task 4's dashboard link to this URL relies on this.

- [ ] **Step 1: Read the tab from the URL on mount**

In `frontend/src/pages/admin/CommissionsPage.tsx`, add `useSearchParams` to the react-router import at the top of the file (there currently is none from `react-router-dom` in this file — add a new import line):

```ts
import { useSearchParams } from "react-router-dom";
```

Change:

```ts
export default function CommissionsPage() {
  const [tab, setTab] = useState<Tab>("config");
```

to:

```ts
export default function CommissionsPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(
    searchParams.get("tab") === "sales" ? "sales" : "config",
  );
```

- [ ] **Step 2: Manual verification**

There is no component test suite for this page (matches the rest of `pages/admin/`). Verify manually:

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no new type errors.

Then start the frontend dev server yourself (`cd frontend && npm run dev` — do NOT start the backend dev server per the Global Constraints; point `VITE_API_BASE_URL` at whatever backend instance you already have running, or skip live verification and rely on the type-check + code review) and confirm `/admin/commissions?tab=sales` opens on "Por venda" while `/admin/commissions` (no query) still opens on "Configurar taxas".

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/admin/CommissionsPage.tsx
git commit -m "feat(commissions): abre direto na aba 'Por venda' via ?tab=sales"
```

---

## Task 4: `DashboardPage.tsx` redesign

**Files:**
- Modify: `frontend/src/services/dashboard.service.ts`
- Modify: `frontend/src/pages/admin/DashboardPage.tsx`

**Interfaces:**
- Consumes: `DashboardStats` shape produced by Task 2's `getAdminStats()`; `SaleCommission` type already exported from `frontend/src/services/commissions.service.ts`; `/admin/commissions?tab=sales` route behavior from Task 3.
- Produces: final page — nothing downstream depends on this.

- [ ] **Step 1: Update `DashboardStats` types**

In `frontend/src/services/dashboard.service.ts`, add this import at the top:

```ts
import type { SaleCommission } from "./commissions.service";
```

Replace the `DashboardStats` interface:

```ts
export interface DashboardStats {
  activeProcesses: number;
  activeCompanies: number;
  totalClients: number;
  specialistsCount: number;
  totalProducts: number;
  productsByType: { cars: number; boats: number; aircrafts: number };
  salesByMonth: MonthData[];
  consultantsPerformance: ConsultantPerformanceData[];
  commissionSummary: {
    totalPaid: number;
    thisMonth: number;
    avgTicket: number;
    recentSales: SaleCommission[];
  };
  databaseCounts: { key: string; label: string; count: number }[];
}
```

(This removes `conversionRate: number;` — leave `SpecialistDashboardStats` untouched, it keeps its own `conversionRate`.)

- [ ] **Step 2: Replace `DashboardPage.tsx`**

Replace the full contents of `frontend/src/pages/admin/DashboardPage.tsx` with:

```tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useEffect, useState, useContext, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Building2,
  UserCog,
  Users,
  Package,
  Percent,
  Database,
  Settings,
  ArrowRight,
} from "lucide-react";
import {
  getDashboardStats,
  type DashboardStats,
} from "../../services/dashboard.service";
import { AppContext } from "../../contexts/AppContext";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../../components/patterns/PageHeader";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type RecentSale = DashboardStats["commissionSummary"]["recentSales"][number];

export default function DashboardPage() {
  const { setSearchTerm } = useContext(AppContext);
  const shouldReduceMotion = useReducedMotion();
  const cardDuration = shouldReduceMotion ? 0 : 0.2;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSearchTerm("");
  }, [setSearchTerm]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await getDashboardStats();
        setStats(data);
      } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  const specialistsCount = stats?.specialistsCount ?? 0;
  const salesByMonth = stats?.salesByMonth ?? [];
  const consultantsPerformance = stats?.consultantsPerformance ?? [];
  const commissionSummary = stats?.commissionSummary ?? {
    totalPaid: 0,
    thisMonth: 0,
    avgTicket: 0,
    recentSales: [] as RecentSale[],
  };
  const databaseCounts = stats?.databaseCounts ?? [];

  // Paleta própria do gráfico (identidade visual por consultor) — não é paleta de status, fica como está
  const COLORS = ["#3B82F6", "#1E40AF", "#1E3A8A", "#0C2340", "#051E3E"];

  const kpis: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: number;
    sub: string;
  }[] = [
    {
      icon: Activity,
      label: "Processos Ativos",
      value: stats?.activeProcesses ?? 0,
      sub: "Processos em andamento",
    },
    {
      icon: Building2,
      label: "Escritórios Ativos",
      value: stats?.activeCompanies ?? 0,
      sub: "Empresas parceiras",
    },
    {
      icon: UserCog,
      label: "Especialistas Ativos",
      value: specialistsCount,
      sub: "Carros, Lanchas, Helicópteros",
    },
    {
      icon: Users,
      label: "Clientes Cadastrados",
      value: stats?.totalClients ?? 0,
      sub: "Total na plataforma",
    },
    {
      icon: Package,
      label: "Produtos Cadastrados",
      value: stats?.totalProducts ?? 0,
      sub: `${stats?.productsByType.cars ?? 0} carros · ${
        stats?.productsByType.boats ?? 0
      } embarcações · ${stats?.productsByType.aircrafts ?? 0} aeronaves`,
    },
  ];

  const quickActions: {
    to: string;
    icon: ComponentType<{ className?: string }>;
    label: string;
  }[] = [
    { to: "/admin/companies", icon: Building2, label: "Gerenciar escritórios" },
    {
      to: "/admin/specialists",
      icon: UserCog,
      label: "Gerenciar especialistas",
    },
    { to: "/admin/settings", icon: Settings, label: "Configurações" },
  ];

  return (
    <div className="w-full">
      <PageHeader title="Seja bem vindo de volta, Administrador!" />

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6 mb-8">
        {kpis.map((kpi, index) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: cardDuration, delay: index * 0.03 }}
          >
            <Card>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-border-soft flex items-center justify-center shrink-0">
                  <kpi.icon className="w-5 h-5 text-ink-soft" />
                </div>
                <div className="min-w-0">
                  <p className="text-ink-soft font-semibold mb-1">
                    {kpi.label}
                  </p>
                  {isLoading ? (
                    <p className="text-2xl font-bold text-ink">
                      Carregando...
                    </p>
                  ) : (
                    <>
                      <p className="text-4xl font-bold text-ink mb-1">
                        {kpi.value}
                      </p>
                      <p className="text-sm text-muted">{kpi.sub}</p>
                    </>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Comissão por processo + Base de dados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: cardDuration, delay: 0.15 }}
        >
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-ink-soft" />
                <h2 className="text-lg font-semibold text-ink">
                  Comissão por processo
                </h2>
              </div>
              <Link
                to="/admin/commissions?tab=sales"
                className="flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
              >
                ver todas <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted mb-1">Total pago</p>
                <p className="text-xl font-bold text-ink">
                  {brl(commissionSummary.totalPaid)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Este mês</p>
                <p className="text-xl font-bold text-ink">
                  {brl(commissionSummary.thisMonth)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Ticket médio</p>
                <p className="text-xl font-bold text-ink">
                  {brl(commissionSummary.avgTicket)}
                </p>
              </div>
            </div>

            {commissionSummary.recentSales.length === 0 ? (
              <p className="text-sm text-subtle">
                Nenhuma venda fechada ainda.
              </p>
            ) : (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                {commissionSummary.recentSales.map((sale) => (
                  <div
                    key={sale.processId}
                    className="flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">
                        {sale.productLabel} · {sale.clientName}
                      </p>
                      <CommissionSplitBar sale={sale} />
                    </div>
                    <p className="text-sm font-semibold text-ink shrink-0">
                      {brl(sale.totalCommission)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: cardDuration, delay: 0.18 }}
        >
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-ink-soft" />
                <h2 className="text-lg font-semibold text-ink">
                  Base de dados
                </h2>
              </div>
              <Link
                to="/admin/database"
                className="flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
              >
                ver tudo <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {databaseCounts.map((entity) => (
                <Link
                  key={entity.key}
                  to="/admin/database"
                  className="border border-border rounded-lg p-3 transition-shadow hover:shadow-ds-floating"
                >
                  <p className="text-sm text-muted mb-1">{entity.label}</p>
                  <p className="text-2xl font-bold text-ink">
                    {entity.count}
                  </p>
                </Link>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div
          className="md:col-span-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: cardDuration, delay: 0.21 }}
        >
          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">Vendas</h2>
            <div className="flex gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm text-muted">Não vendidos</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-muted">Vendidos</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="naoVendidos"
                  stroke="#EF4444"
                />
                <Line type="monotone" dataKey="vendidos" stroke="#22C55E" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: cardDuration, delay: 0.24 }}
        >
          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">
              Desempenho de Vendas por Consultor
            </h2>
            {consultantsPerformance.length === 0 ? (
              <p className="text-sm text-muted">
                Sem dados suficientes para exibir o desempenho por consultor.
              </p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={consultantsPerformance}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {consultantsPerformance.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                <div className="mt-4 space-y-2">
                  {consultantsPerformance.map((item, index) => (
                    <div
                      key={item.name}
                      className="flex justify-between items-center text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        ></div>
                        <span className="text-ink-soft">{item.name}</span>
                      </div>
                      <div className="flex gap-4">
                        <span className="text-ink font-semibold">
                          {item.value} vendas
                        </span>
                        <span className="text-status-ok font-semibold">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickActions.map((action, index) => (
          <motion.div
            key={action.to}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: cardDuration, delay: 0.27 + index * 0.03 }}
          >
            <ActionCard {...action} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ActionCard({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link to={to}>
      <Card className="flex items-center gap-3 transition-shadow hover:shadow-ds-floating">
        <div className="w-10 h-10 rounded-lg bg-border-soft flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-ink-soft" />
        </div>
        <span className="font-medium text-ink">{label}</span>
      </Card>
    </Link>
  );
}

function CommissionSplitBar({ sale }: { sale: RecentSale }) {
  const total = sale.totalCommission > 0 ? sale.totalCommission : 1;
  const specialistPct = (sale.specialistValue / total) * 100;
  const officePct = (sale.officeValue / total) * 100;
  const platformPct = (sale.platformValue / total) * 100;

  return (
    <div className="flex h-1.5 w-full max-w-xs rounded-full overflow-hidden bg-border-soft mt-1">
      <div className="bg-emerald-500" style={{ width: `${specialistPct}%` }} />
      <div className="bg-sky-500" style={{ width: `${officePct}%` }} />
      <div className="bg-violet-500" style={{ width: `${platformPct}%` }} />
    </div>
  );
}
```

- [ ] **Step 3: Type-check and build**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no type errors.

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual QA checklist**

Do NOT start the backend dev server on this machine (Global Constraints). If you have a backend instance already running elsewhere (Railway, or one the user starts manually), point the frontend at it and run `cd frontend && npm run dev`, then check:

- [ ] The 5 KPI cards render with icons, no "Taxa de Conversão" card anywhere.
- [ ] "Comissão por processo" shows 3 totals + up to 5 recent sales with a 3-color split bar; "ver todas →" goes to `/admin/commissions?tab=sales` and lands on the sales tab.
- [ ] "Base de dados" shows one tile per entity with a count; clicking a tile goes to `/admin/database`.
- [ ] Cards fade/rise in on load (or don't animate at all if the OS "reduce motion" setting is on — check via browser devtools' `prefers-reduced-motion: reduce` emulation).
- [ ] Hovering a database tile or a quick-action card shows a soft shadow lift, no layout shift.
- [ ] Charts (vendas por mês, desempenho por consultor) render exactly as before.

If you cannot run a live backend, skip this step's live-browser checks and rely on Step 3's type-check/build plus a careful read-through of the JSX against this plan.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/dashboard.service.ts frontend/src/pages/admin/DashboardPage.tsx
git commit -m "feat(admin-dashboard): redesenha dashboard — remove taxa de conversão, adiciona comissão por processo, preview da base de dados e animações sutis"
```

---

## Final verification (all tasks done)

- [ ] Backend: `cd backend && npx jest admin-database.service.spec.ts dashboard.service.spec.ts --maxWorkers=2` — all green.
- [ ] Backend: `cd backend && npm run lint`
- [ ] Backend: `cd backend && npm run build`
- [ ] Frontend: `cd frontend && npm run lint`
- [ ] Frontend: `cd frontend && npm run build`
- [ ] `git log --oneline -6` shows the 4 commits from this plan (Task 1 through Task 4) on top of the current branch.
- [ ] Confirm `resolveCommissionFromTotal`'s 5 pre-existing failures (if you ran the full backend suite instead of scoped files) are unchanged in count — not something this plan introduced or is expected to fix.
