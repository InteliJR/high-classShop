# Rollout do Design System — Fatia 1 (Consultor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a área do Consultor no rollout do design system: redesenhar `ConsultantDashboard.tsx` como um dashboard de verdade (KPIs, processos vigentes, distribuição por status, clientes recentes, atalhos rápidos) e aplicar os componentes/tokens já existentes em `ConsultantProcessesPage.tsx` e `ConsultantProcessDetailPage.tsx`.

**Architecture:** Reaproveita 100% dos componentes já construídos no piloto (`Button`, `Card`, `Alert`, `Dialog`/`DialogContent`, `PageHeader`, `StatusBadge`, `EmptyState`) — nenhum componente novo de `components/ui/`. Cria só 1 componente novo (`ProposalStatusBadge`, seguindo o mesmo padrão de `StatusBadge`) e centraliza a config de status (label + cor) num único export reaproveitado pelas 3 telas + o gráfico do dashboard, em vez de duplicar o mapa `STATUS_LABELS`/`STATUS_COLORS` uma 4ª vez. **Sem endpoint novo** — `GET /consultant/processes` já retorna `updated_at`, só falta declarar no tipo do frontend.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v4 + `recharts` (já instalado, mesma lib do dashboard do Especialista) para o gráfico de distribuição por status.

## Global Constraints

- Nenhum token existente em `frontend/src/index.css` é tocado — só reaproveitados.
- Import relativo, sem alias `@/`.
- Frontend sem test runner — verificação é `npx tsc -b` + `npm run build` + `npm run lint`, e QA visual via Playwright mockando `**/api/**` (o backend local **nunca deve ser iniciado nesta máquina** — já crashou 2x; ver memória `feedback_backend_dev_server_crashed_machine`).
- `Button` mantém as 6 variantes já existentes (`solid/light/muted/brand/ghost/danger`) — nenhuma tarefa aqui deve alterar `components/ui/button.tsx`.
- Paleta de status (6 cores) já validada com o script de acessibilidade do skill `dataviz` — `#c2410c` (Contrato) e `#b45309` (Negociação) ficam abaixo do piso de separação CVD ideal isoladamente; isso é aceitável **somente** porque todo uso delas nesta plataforma já vem com rótulo de texto direto (nunca só a cor) — nenhuma tarefa deve remover o rótulo textual ao lado de uma cor de status.
- Consultor não recebe comissão nesta plataforma (ver `CLAUDE.md`) — nenhum widget de comissão/wallet entra nesta fatia.

---

### Task 1: Tipo `updated_at` + centralizar config de status

**Files:**
- Modify: `frontend/src/services/consultant.service.ts:159-167`
- Modify: `frontend/src/components/patterns/StatusBadge.tsx`

**Interfaces:**
- Produces: `ConsultantProcess.updated_at: string`; `export const PROCESS_STATUS_META: ReadonlyArray<{ value: string; label: string; dot: string; hex: string }>` — usado pelas Tasks 3, 4 e 5.

- [ ] **Step 1: Adicionar `updated_at` ao tipo `ConsultantProcess`**

Substituir em `frontend/src/services/consultant.service.ts`:

```ts
export type ConsultantProcess = {
  id: string;
  status: string;
  product_type: string | null;
  created_at: string;
  client_id: string;
  client: { id: string; name: string; surname: string } | null;
  specialist: { id: string; name: string; surname: string; speciality: string } | null;
};
```

por:

```ts
export type ConsultantProcess = {
  id: string;
  status: string;
  product_type: string | null;
  created_at: string;
  updated_at: string;
  client_id: string;
  client: { id: string; name: string; surname: string } | null;
  specialist: { id: string; name: string; surname: string; speciality: string } | null;
};
```

(O backend já retorna esse campo — `GET /api/consultant/processes` não usa `select` no Prisma, então `updated_at` já vem no JSON hoje, só não estava declarado no tipo do frontend.)

- [ ] **Step 2: Ler o `StatusBadge.tsx` atual e substituir pelo conteúdo com a config exportada**

Ler `frontend/src/components/patterns/StatusBadge.tsx` primeiro pra confirmar que o conteúdo abaixo bate com o "antes" (foi criado na fundação do piloto, não deveria ter mudado desde então):

```tsx
import { cn } from "../../lib/utils";

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  SCHEDULING: { label: "Agendamento", dot: "bg-status-sched" },
  NEGOTIATION: { label: "Negociação", dot: "bg-status-neg" },
  PROCESSING_CONTRACT: { label: "Contrato", dot: "bg-status-proc" },
  DOCUMENTATION: { label: "Documentação", dot: "bg-status-doc" },
  COMPLETED: { label: "Concluído", dot: "bg-status-ok" },
  REJECTED: { label: "Rejeitado", dot: "bg-status-bad" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-border-soft px-2.5 py-1 text-xs font-semibold text-ink-soft",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config?.dot ?? "bg-subtle")} />
      {config?.label ?? status}
    </span>
  );
}
```

Substituir por (mesmo comportamento externo, `STATUS_CONFIG` agora é derivado de um array exportado — `hex` é usado só pelo gráfico do dashboard, que não pode consumir classes Tailwind diretamente):

```tsx
import { cn } from "../../lib/utils";

// Um único lugar pra label + cor de cada status de processo — StatusBadge,
// o gráfico do dashboard (Task 3) e os filtros de ConsultantProcessesPage/
// ConsultantProcessDetailPage (Tasks 4/5) consomem isto em vez de duplicar
// o mapa. `hex` deve ficar em sincronia com os tokens --color-status-* em
// frontend/src/index.css — existe só porque bibliotecas de gráfico (SVG)
// não conseguem ler classes Tailwind, precisam do valor de cor literal.
export const PROCESS_STATUS_META = [
  { value: "SCHEDULING", label: "Agendamento", dot: "bg-status-sched", hex: "#1d4ed8" },
  { value: "NEGOTIATION", label: "Negociação", dot: "bg-status-neg", hex: "#b45309" },
  { value: "PROCESSING_CONTRACT", label: "Contrato", dot: "bg-status-proc", hex: "#c2410c" },
  { value: "DOCUMENTATION", label: "Documentação", dot: "bg-status-doc", hex: "#7e22ce" },
  { value: "COMPLETED", label: "Concluído", dot: "bg-status-ok", hex: "#15803d" },
  { value: "REJECTED", label: "Rejeitado", dot: "bg-status-bad", hex: "#b91c1c" },
] as const;

const STATUS_CONFIG: Record<string, (typeof PROCESS_STATUS_META)[number]> =
  Object.fromEntries(PROCESS_STATUS_META.map((meta) => [meta.value, meta]));

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-border-soft px-2.5 py-1 text-xs font-semibold text-ink-soft",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config?.dot ?? "bg-subtle")} />
      {config?.label ?? status}
    </span>
  );
}
```

- [ ] **Step 3: Verificar**

```bash
cd frontend && npx tsc -b
```

Expected: sem erro (o único consumidor existente de `StatusBadge`, `ConsultantClientsPage.tsx`, continua passando só `status`/`className` — a mudança é aditiva).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/consultant.service.ts frontend/src/components/patterns/StatusBadge.tsx
git commit -m "feat(design-system): expor PROCESS_STATUS_META e declarar updated_at em ConsultantProcess"
```

---

### Task 2: Criar `ProposalStatusBadge`

**Files:**
- Create: `frontend/src/components/patterns/ProposalStatusBadge.tsx`

**Interfaces:**
- Consumes: `cn` de `../../lib/utils`.
- Produces: `export function ProposalStatusBadge({ status, className }: { status: string; className?: string })` — retorna `null` se o status não for um dos 4 reconhecidos (mesmo comportamento do componente local que está sendo substituído em `ConsultantProcessDetailPage.tsx`).

- [ ] **Step 1: Criar o arquivo**

```tsx
import { cn } from "../../lib/utils";

// Status de PROPOSTA (não confundir com status de PROCESSO — StatusBadge).
// Mesma receita visual (pílula neutra + ponto de cor) por consistência,
// reaproveitando os mesmos tokens de status já usados no processo:
// PENDING → âmbar (aguardando, como NEGOTIATION), ACCEPTED → verde (como
// COMPLETED), REJECTED → vermelho (como REJECTED), COUNTERED → azul (como
// SCHEDULING) — sem inventar cor nova pra um conceito adjacente.
const PROPOSAL_STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  PENDING: { label: "Aguardando resposta", dot: "bg-status-neg" },
  ACCEPTED: { label: "Aceita", dot: "bg-status-ok" },
  REJECTED: { label: "Rejeitada", dot: "bg-status-bad" },
  COUNTERED: { label: "Contraproposta enviada", dot: "bg-status-sched" },
};

export function ProposalStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const config = PROPOSAL_STATUS_CONFIG[status];
  if (!config) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-border-soft px-2.5 py-1 text-xs font-semibold text-ink-soft",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}
```

- [ ] **Step 2: Verificar**

```bash
cd frontend && npx tsc -b
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/patterns/ProposalStatusBadge.tsx
git commit -m "feat(design-system): criar ProposalStatusBadge (mesma receita do StatusBadge, dominio de proposta)"
```

---

### Task 3: Redesenhar `ConsultantDashboard.tsx`

**Files:**
- Modify: `frontend/src/pages/consultant/ConsultantDashboard.tsx` (reescrita completa)

**Interfaces:**
- Consumes: `Button`, `Card`, `Alert`, `Dialog`/`DialogContent`, `PageHeader`, `StatusBadge`, `PROCESS_STATUS_META`, `EmptyState` (Task 1/2 + fundação do piloto); `getClients`/`getAllConsultantProcesses`/`Client`/`ConsultantProcess` de `consultant.service.ts`; `InviteClientForm`/`BatchInviteClients` (componentes já existentes, não tocados).

- [ ] **Step 1: Ler o arquivo atual** (`frontend/src/pages/consultant/ConsultantDashboard.tsx`) pra confirmar que bate com a versão descrita na spec (tabela de clientes reduzida, 3 modais) antes de substituir — se divergir, parar e reportar.

- [ ] **Step 2: Substituir todo o conteúdo do arquivo**

```tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, FilePen, Plus, TrendingUp, Users } from "lucide-react";
import {
  getAllConsultantProcesses,
  getClients,
  type Client,
  type ConsultantProcess,
} from "../../services/consultant.service";
import Button from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Alert } from "../../components/ui/alert";
import { Dialog, DialogContent } from "../../components/ui/dialog";
import { PageHeader } from "../../components/patterns/PageHeader";
import { StatusBadge, PROCESS_STATUS_META } from "../../components/patterns/StatusBadge";
import { EmptyState } from "../../components/patterns/EmptyState";
import InviteClientForm from "./InviteClientForm";
import BatchInviteClients from "./BatchInviteClients";

const TERMINAL_STATUSES = ["COMPLETED", "REJECTED"];

function daysSince(dateString: string): number {
  const diffMs = Date.now() - new Date(dateString).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export default function ConsultantDashboard() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [processes, setProcesses] = useState<ConsultantProcess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [clientsData, processesData] = await Promise.all([
        getClients(),
        getAllConsultantProcesses(),
      ]);
      setClients(clientsData);
      setProcesses(processesData);
      setError(null);
    } catch {
      setError("Não foi possível carregar os dados do dashboard.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeProcesses = useMemo(
    () => processes.filter((p) => !TERMINAL_STATUSES.includes(p.status)),
    [processes],
  );
  const completedCount = useMemo(
    () => processes.filter((p) => p.status === "COMPLETED").length,
    [processes],
  );
  const rejectedCount = useMemo(
    () => processes.filter((p) => p.status === "REJECTED").length,
    [processes],
  );
  const conversionRate = useMemo(() => {
    const finalized = completedCount + rejectedCount;
    return finalized > 0 ? Math.round((completedCount / finalized) * 100) : 0;
  }, [completedCount, rejectedCount]);

  const pendingProcesses = useMemo(
    () =>
      [...activeProcesses]
        .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
        .slice(0, 5),
    [activeProcesses],
  );

  const statusDistribution = useMemo(
    () =>
      PROCESS_STATUS_META.map((meta) => ({
        ...meta,
        count: processes.filter((p) => p.status === meta.value).length,
      })),
    [processes],
  );

  const recentClients = useMemo(
    () =>
      [...clients]
        .sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
        )
        .slice(0, 5),
    [clients],
  );

  const handleQuickActionSuccess = () => {
    setIsInviteModalOpen(false);
    fetchData();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-border-soft border-t-primary rounded-full animate-spin" />
          <p className="text-muted">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-text-main w-full">
      <PageHeader
        title="Dashboard"
        actions={
          <>
            <Button type="button" variant="light" onClick={() => setIsBatchModalOpen(true)}>
              Convite em lote
            </Button>
            <Button type="button" onClick={() => setIsInviteModalOpen(true)}>
              <Plus size={16} />
              Convidar cliente
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            <Users size={14} />
            Clientes
          </div>
          <p className="text-2xl font-bold text-ink">{clients.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            <FilePen size={14} />
            Processos ativos
          </div>
          <p className="text-2xl font-bold text-ink">{activeProcesses.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            <CheckCircle2 size={14} />
            Concluídos
          </div>
          <p className="text-2xl font-bold text-ink">{completedCount}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            <TrendingUp size={14} />
            Taxa de conversão
          </div>
          <p className="text-2xl font-bold text-ink">{conversionRate}%</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-h2 font-semibold text-ink">Processos vigentes</h2>
            <button
              type="button"
              onClick={() => navigate("/consultant/processes")}
              className="text-sm font-semibold text-ink-soft hover:text-ink"
            >
              Ver todos
            </button>
          </div>
          {pendingProcesses.length === 0 ? (
            <EmptyState
              icon={FilePen}
              title="Nenhum processo em andamento"
              description="Processos ativos dos seus clientes aparecem aqui."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {pendingProcesses.map((proc) => (
                <div
                  key={proc.id}
                  onClick={() => navigate(`/consultant/processes/${proc.id}`)}
                  className="flex items-center justify-between gap-3 bg-surface rounded-lg px-4 py-3 border border-border-soft hover:border-border cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusBadge status={proc.status} />
                    <span className="text-sm text-muted truncate">
                      {proc.client ? `${proc.client.name} ${proc.client.surname}` : "—"}
                      {proc.specialist
                        ? ` • ${proc.specialist.name} ${proc.specialist.surname}`
                        : ""}
                    </span>
                  </div>
                  <span className="text-xs text-subtle whitespace-nowrap">
                    {daysSince(proc.updated_at)}d sem atualização
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="text-h2 font-semibold text-ink mb-4">Distribuição por status</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusDistribution} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={100}
                  tick={{ fontSize: 12, fill: "#6b6b6b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip cursor={{ fill: "#e9e9e9" }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                  {statusDistribution.map((entry) => (
                    <Cell key={entry.value} fill={entry.hex} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-h2 font-semibold text-ink">Clientes recentes</h2>
              <button
                type="button"
                onClick={() => navigate("/consultant/clients")}
                className="text-sm font-semibold text-ink-soft hover:text-ink"
              >
                Ver todos
              </button>
            </div>
            {recentClients.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum cliente ainda"
                description='Clique em "Convidar cliente" para começar.'
              />
            ) : (
              <div className="flex flex-col gap-2">
                {recentClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between gap-3 px-1 py-2 border-b border-border-soft last:border-b-0"
                  >
                    <span className="text-sm font-medium text-ink truncate">
                      {client.name} {client.surname}
                    </span>
                    <span className="text-xs text-subtle whitespace-nowrap">
                      {client.created_at
                        ? new Date(client.created_at).toLocaleDateString("pt-BR")
                        : "-"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent open={isInviteModalOpen} title="Convidar cliente" hideTitle>
          <InviteClientForm onSuccess={handleQuickActionSuccess} />
        </DialogContent>
      </Dialog>

      <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
        <DialogContent open={isBatchModalOpen} title="Convite de clientes em lote" hideTitle>
          <BatchInviteClients onClose={() => setIsBatchModalOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos**

```bash
cd frontend && npx tsc -b
```

Expected: sem erro. Se `recharts` reclamar de tipo em `data={statusDistribution}` (array de objetos com `value/label/dot/hex/count`), confirmar que `dataKey` usados (`"label"`, `"count"`) existem nesses objetos — não ajustar o formato de `PROCESS_STATUS_META` sem checar a Task 1 primeiro.

- [ ] **Step 4: Verificar visualmente**

Sem rodar o backend local (ver Global Constraints) — usar o mesmo padrão de QA do piloto: `npm run dev` (só frontend) + um script Playwright mockando `**/api/**` com `auth/me` (role CONSULTANT), `consultant/clients` e `consultant/processes` retornando alguns registros com `status` variados e `updated_at` diferentes. Confirmar: 4 KPIs corretos, lista de "Processos vigentes" ordenada do mais parado pro mais recente, gráfico de barras renderiza com as 6 cores certas (comparar com os pontos do `StatusBadge` na mesma tela), "Clientes recentes" lista os últimos por data, os 2 modais abrem/fecham corretamente (mesmo `hideTitle` do piloto). Parar o dev server ao final.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/consultant/ConsultantDashboard.tsx
git commit -m "feat(consultor): redesenhar dashboard com KPIs, processos vigentes, grafico de status e atalhos"
```

---

### Task 4: Aplicar o sistema em `ConsultantProcessesPage.tsx`

**Files:**
- Modify: `frontend/src/pages/consultant/ConsultantProcessesPage.tsx` (reescrita completa)

**Interfaces:**
- Consumes: `PageHeader`, `StatusBadge`, `PROCESS_STATUS_META`, `Card` (Task 1 + fundação).

- [ ] **Step 1: Ler o arquivo atual** pra confirmar que bate com a versão já lida nesta sessão (301 linhas, filtro de status/cliente, grid `1.5fr_1.5fr_1fr_1fr_1fr` sem responsividade, paginação) — se divergir, parar e reportar.

- [ ] **Step 2: Substituir todo o conteúdo do arquivo**

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllConsultantProcesses, getClients, type ConsultantProcess, type Client } from "../../services/consultant.service";
import { Loader2, Search, X, ChevronDown } from "lucide-react";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../../components/patterns/PageHeader";
import { StatusBadge, PROCESS_STATUS_META } from "../../components/patterns/StatusBadge";
import { EmptyState } from "../../components/patterns/EmptyState";

const PRODUCT_LABELS: Record<string, string> = {
  CAR: "Carro",
  BOAT: "Embarcação",
  AIRCRAFT: "Aeronave",
};

const PAGE_SIZE = 15;

export default function ConsultantProcessesPage() {
  const navigate = useNavigate();
  const [processes, setProcesses] = useState<ConsultantProcess[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [page, setPage] = useState(1);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getClients().then(setClients).catch(() => setClients([]));
  }, []);

  const fetchProcesses = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getAllConsultantProcesses({
        status: statusFilter || undefined,
        clientId: selectedClient?.id,
      });
      setProcesses(data);
      setPage(1);
      setError(null);
    } catch {
      setError("Não foi possível carregar os processos.");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, selectedClient]);

  useEffect(() => { fetchProcesses(); }, [fetchProcesses]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.name} ${c.surname} ${c.email ?? ""}`.toLowerCase().includes(q),
    );
  }, [clientSearch, clients]);

  const totalPages = Math.max(1, Math.ceil(processes.length / PAGE_SIZE));
  const pageProcesses = processes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const clearFilters = () => {
    setStatusFilter("");
    setSelectedClient(null);
    setClientSearch("");
  };

  const hasFilters = statusFilter !== "" || selectedClient !== null;

  return (
    <div className="text-text-main w-full">
      <PageHeader title="Processos dos Clientes" />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted uppercase tracking-wider">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm px-3 py-2 border border-border rounded-md bg-surface min-w-[180px]"
          >
            <option value="">Todos</option>
            {PROCESS_STATUS_META.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 relative" ref={dropdownRef}>
          <label className="text-xs font-medium text-muted uppercase tracking-wider">Cliente</label>
          <button
            type="button"
            onClick={() => setIsClientDropdownOpen((v) => !v)}
            className="flex items-center justify-between gap-2 text-sm px-3 py-2 border border-border rounded-md bg-surface min-w-[240px] hover:border-ink-soft"
          >
            <span className={selectedClient ? "text-ink" : "text-subtle"}>
              {selectedClient
                ? `${selectedClient.name} ${selectedClient.surname}`
                : "Todos os clientes"}
            </span>
            <ChevronDown className="w-4 h-4 text-muted" />
          </button>

          {isClientDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-md shadow-ds-floating z-20 max-h-72 overflow-hidden flex flex-col">
              <div className="p-2 border-b border-border-soft">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Buscar cliente..."
                    className="w-full text-sm pl-8 pr-2 py-1.5 border border-border-soft rounded"
                    autoFocus
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClient(null);
                    setIsClientDropdownOpen(false);
                    setClientSearch("");
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-border-soft text-subtle border-b border-border-soft"
                >
                  Todos os clientes
                </button>
                {filteredClients.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-subtle">Nenhum cliente.</p>
                ) : (
                  filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedClient(c);
                        setIsClientDropdownOpen(false);
                        setClientSearch("");
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-border-soft"
                    >
                      <div className="font-medium text-ink">{c.name} {c.surname}</div>
                      <div className="text-xs text-subtle">{c.email}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink px-3 py-2 self-end"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-h2 font-semibold text-ink">Processos</h2>
            <p className="text-sm text-muted mt-1">
              Clique em um processo para ver os detalhes.
            </p>
          </div>
          <span className="text-sm text-muted">
            {processes.length} {processes.length === 1 ? "processo" : "processos"}
          </span>
        </div>

        {error ? (
          <p className="text-status-bad">{error}</p>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-subtle" />
              <p className="text-sm text-muted">Carregando processos...</p>
            </div>
          </div>
        ) : processes.length === 0 ? (
          <EmptyState
            icon={Search}
            title={hasFilters ? "Nenhum processo com esses filtros" : "Nenhum processo ainda"}
            description={hasFilters ? undefined : "Crie processos na página de Clientes."}
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs uppercase tracking-wide text-muted font-semibold px-4 py-3">Cliente</th>
                    <th className="text-left text-xs uppercase tracking-wide text-muted font-semibold px-4 py-3">Especialista</th>
                    <th className="text-left text-xs uppercase tracking-wide text-muted font-semibold px-4 py-3">Produto</th>
                    <th className="text-left text-xs uppercase tracking-wide text-muted font-semibold px-4 py-3">Status</th>
                    <th className="text-left text-xs uppercase tracking-wide text-muted font-semibold px-4 py-3">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {pageProcesses.map((proc) => (
                    <tr
                      key={proc.id}
                      onClick={() => navigate(`/consultant/processes/${proc.id}`)}
                      className="border-b border-border-soft hover:bg-border-soft/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-ink">
                        {proc.client ? `${proc.client.name} ${proc.client.surname}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {proc.specialist ? `${proc.specialist.name} ${proc.specialist.surname}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {PRODUCT_LABELS[proc.product_type ?? ""] ?? proc.product_type ?? "Consultoria"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={proc.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-subtle">
                        {new Date(proc.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <span className="text-xs text-muted">
                  Página {page} de {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm rounded border border-border hover:bg-border-soft disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm rounded border border-border hover:bg-border-soft disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
```

Nota: o `EmptyState` do estado "sem filtro nenhum" antes dizia "Nenhum processo ainda. Crie processos na página de Clientes." — o componente `EmptyState` já separa `title`/`description`, então isso virou `title="Nenhum processo ainda"` + `description="Crie processos na página de Clientes."`; o estado "com filtro" (`hasFilters`) não tinha uma segunda frase antes, então `description={undefined}` mantém só o título, sem inventar texto novo.

- [ ] **Step 3: Verificar**

```bash
cd frontend && npx tsc -b
```

- [ ] **Step 4: Verificar visualmente**

Mesmo padrão de QA da Task 3 (frontend só + Playwright mockando `consultant/processes` e `consultant/clients` com múltiplos registros, incluindo mais de 15 pra ver a paginação). Confirmar: filtro de status usa os mesmos rótulos do `StatusBadge`, tabela rola horizontal em viewport estreita (390px), badges de status com ponto colorido.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/consultant/ConsultantProcessesPage.tsx
git commit -m "feat(consultor): aplicar StatusBadge/PageHeader/tabela responsiva em ConsultantProcessesPage"
```

---

### Task 5: Aplicar o sistema em `ConsultantProcessDetailPage.tsx`

**Files:**
- Modify: `frontend/src/pages/consultant/ConsultantProcessDetailPage.tsx`

**Interfaces:**
- Consumes: `PageHeader` (com `showBack`/`backTo` — primeiro consumidor real dessa branch, ver `DESIGN.md`), `StatusBadge`, `ProposalStatusBadge` (Task 2), `Card`, `Button`.

- [ ] **Step 1: Ler o arquivo atual** (735 linhas) e confirmar que bate com o que foi lido nesta sessão antes de editar.

- [ ] **Step 2: Trocar os imports**

Substituir:

```tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  DollarSign,
  Loader2,
  MessageSquare,
  Package,
  RefreshCw,
  Send,
  User,
  UserCog,
  Video,
  X,
} from "lucide-react";
import {
  acceptProposal,
  createProposal,
  getProcessProposals,
  rejectProposal,
  type NegotiationMeta,
  type NegotiationProcessInfo,
  type NegotiationProposal,
} from "../../services/proposals.service";
import {
  getMeetingByProcess,
  getProcessById,
  type MeetingSession,
  type Process,
} from "../../services/processes.service";
import { useAuth } from "../../store/authStateManager";

const STATUS_LABELS: Record<string, string> = {
  SCHEDULING: "Agendamento",
  NEGOTIATION: "Negociação",
  PROCESSING_CONTRACT: "Contrato",
  DOCUMENTATION: "Documentação",
  COMPLETED: "Concluído",
  REJECTED: "Rejeitado",
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULING: "bg-blue-100 text-blue-700",
  NEGOTIATION: "bg-yellow-100 text-yellow-700",
  PROCESSING_CONTRACT: "bg-orange-100 text-orange-700",
  DOCUMENTATION: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

const PRODUCT_LABELS: Record<string, string> = {
  CAR: "Carro",
  BOAT: "Embarcação",
  AIRCRAFT: "Aeronave",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ProposalStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "PENDING":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
          <Loader2 size={12} className="animate-spin" />
          Aguardando resposta
        </span>
      );
    case "ACCEPTED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
          <Check size={12} />
          Aceita
        </span>
      );
    case "REJECTED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
          <X size={12} />
          Rejeitada
        </span>
      );
    case "COUNTERED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
          <RefreshCw size={12} />
          Contraproposta enviada
        </span>
      );
    default:
      return null;
  }
}
```

por (remove os 2 mapas locais e a função `ProposalStatusBadge` local — agora vêm de `StatusBadge`/`ProposalStatusBadge` importados; **`ArrowLeft` continua na lista** — o `PageHeader` desenha a seta de voltar do cabeçalho principal, mas o estado de erro/"processo não encontrado" mais abaixo no arquivo tem seu próprio botão "Voltar para processos" com esse mesmo ícone, tratado no Step 3a):

```tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  DollarSign,
  Loader2,
  MessageSquare,
  Package,
  RefreshCw,
  Send,
  User,
  UserCog,
  Video,
  X,
} from "lucide-react";
import {
  acceptProposal,
  createProposal,
  getProcessProposals,
  rejectProposal,
  type NegotiationMeta,
  type NegotiationProcessInfo,
  type NegotiationProposal,
} from "../../services/proposals.service";
import {
  getMeetingByProcess,
  getProcessById,
  type MeetingSession,
  type Process,
} from "../../services/processes.service";
import { useAuth } from "../../store/authStateManager";
import { Card } from "../../components/ui/card";
import Button from "../../components/ui/button";
import { PageHeader } from "../../components/patterns/PageHeader";
import { StatusBadge } from "../../components/patterns/StatusBadge";
import { ProposalStatusBadge } from "../../components/patterns/ProposalStatusBadge";

const PRODUCT_LABELS: Record<string, string> = {
  CAR: "Carro",
  BOAT: "Embarcação",
  AIRCRAFT: "Aeronave",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

- [ ] **Step 3a: Tokenizar o botão do estado de erro ("processo não encontrado")**

Substituir:

```tsx
  if (error || !process) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="text-red-500 mb-3" size={40} />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Não foi possível carregar o processo
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          {error ?? "Processo não encontrado."}
        </p>
        <button
          onClick={() => navigate("/consultant/processes")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={18} />
          Voltar para processos
        </button>
      </div>
    );
  }
```

por:

```tsx
  if (error || !process) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="text-status-bad mb-3" size={40} />
        <h2 className="text-lg font-semibold text-ink mb-1">
          Não foi possível carregar o processo
        </h2>
        <p className="text-sm text-muted mb-4">
          {error ?? "Processo não encontrado."}
        </p>
        <Button type="button" onClick={() => navigate("/consultant/processes")}>
          <ArrowLeft size={18} />
          Voltar para processos
        </Button>
      </div>
    );
  }
```

- [ ] **Step 3: Trocar o cabeçalho da página — primeiro uso real de `PageHeader` com `showBack`**

Substituir:

```tsx
  const productLabel = process.product_type
    ? PRODUCT_LABELS[process.product_type] ?? process.product_type
    : "Consultoria";
  const statusLabel = STATUS_LABELS[process.status] ?? process.status;
  const statusColor =
    STATUS_COLORS[process.status] ?? "bg-gray-100 text-gray-600";

  const acceptedProposal = proposals.find((p) => p.status === "ACCEPTED");
  const isAwaitingProduct = !process.product_type || !process.product_id;
  const showCreateForm = canCreateProposal();
  const isScheduling = process.status === "SCHEDULING";
  const isAppointmentConfirmed =
    process.appointment_status === "SCHEDULED" ||
    process.appointment_status === "COMPLETED";

  return (
    <div className="text-text-main w-full">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/consultant/processes")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="h1-style">Detalhes do processo</h1>
            <p className="text-sm text-gray-500 mt-1">
              Acompanhe e atue na negociação em nome do cliente.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg shadow bg-white">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            <User size={14} />
            Cliente
          </div>
          <p className="text-sm font-medium text-gray-900">
            {process.client?.name ?? "—"}
          </p>
          {process.client?.email && (
            <p className="text-xs text-gray-500 mt-1">{process.client.email}</p>
          )}
        </div>

        <div className="p-4 rounded-lg shadow bg-white">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            <UserCog size={14} />
            Especialista
          </div>
          <p className="text-sm font-medium text-gray-900">
            {process.specialist?.name ?? "—"}
          </p>
          {process.specialist?.especialidade && (
            <p className="text-xs text-gray-500 mt-1">
              {process.specialist.especialidade}
            </p>
          )}
        </div>

        <div className="p-4 rounded-lg shadow bg-white">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            <Package size={14} />
            Produto
          </div>
          <p className="text-sm font-medium text-gray-900">{productLabel}</p>
          {process.product && (
            <p className="text-xs text-gray-500 mt-1 truncate">
              {[process.product.marca, process.product.modelo]
                .filter(Boolean)
                .join(" ")}
              {process.product.ano ? ` • ${process.product.ano}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="p-4 rounded-lg shadow bg-white mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Status
          </span>
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar size={14} className="text-gray-400" />
          Criado em {formatDate(process.created_at)}
        </div>
        {process.appointment_datetime && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar size={14} className="text-gray-400" />
            Reunião: {formatDate(process.appointment_datetime)}
          </div>
        )}
        {process.rejection_reason && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle size={14} />
            Motivo da rejeição: {process.rejection_reason}
          </div>
        )}
      </div>

      {!isScheduling && processInfo && (
        <div className="p-4 rounded-lg shadow bg-white mb-6 flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-green-600" />
            <span className="text-gray-500">Valor do produto:</span>
            <span className="font-semibold text-gray-900">
              {formatCurrency(processInfo.product_value)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-orange-500" />
            <span className="text-gray-500">Valor mínimo:</span>
            <span className="font-semibold text-orange-600">
              {formatCurrency(processInfo.minimum_value)}
            </span>
          </div>
          {acceptedProposal && (
            <div className="flex items-center gap-2">
              <Check size={16} className="text-green-600" />
              <span className="text-gray-500">Valor aceito:</span>
              <span className="font-semibold text-green-700">
                {formatCurrency(acceptedProposal.proposed_value)}
              </span>
            </div>
          )}
          {meta && (
            <div className="ml-auto text-xs text-gray-400">
              {meta.total} {meta.total === 1 ? "proposta" : "propostas"}
            </div>
          )}
        </div>
      )}
```

por (troca `STATUS_LABELS`/`STATUS_COLORS` por `StatusBadge`; cabeçalho manual por `PageHeader` com `showBack` + `backTo` — esta é a primeira tela da plataforma a exercitar esse branch; os 3 cards viram `Card`; cores tokenizadas; "valor mínimo" em laranja **fica como está de propósito** — não é um dos 6 status de processo, é só um destaque visual de "atenção ao valor", não tokenizar como status):

```tsx
  const productLabel = process.product_type
    ? PRODUCT_LABELS[process.product_type] ?? process.product_type
    : "Consultoria";

  const acceptedProposal = proposals.find((p) => p.status === "ACCEPTED");
  const isAwaitingProduct = !process.product_type || !process.product_id;
  const showCreateForm = canCreateProposal();
  const isScheduling = process.status === "SCHEDULING";
  const isAppointmentConfirmed =
    process.appointment_status === "SCHEDULED" ||
    process.appointment_status === "COMPLETED";

  return (
    <div className="text-text-main w-full">
      <PageHeader
        title="Detalhes do processo"
        showBack
        backTo="/consultant/processes"
        actions={
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-border-soft"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        }
      />
      <p className="text-sm text-muted -mt-4 mb-6">
        Acompanhe e atue na negociação em nome do cliente.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            <User size={14} />
            Cliente
          </div>
          <p className="text-sm font-medium text-ink">
            {process.client?.name ?? "—"}
          </p>
          {process.client?.email && (
            <p className="text-xs text-muted mt-1">{process.client.email}</p>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            <UserCog size={14} />
            Especialista
          </div>
          <p className="text-sm font-medium text-ink">
            {process.specialist?.name ?? "—"}
          </p>
          {process.specialist?.especialidade && (
            <p className="text-xs text-muted mt-1">
              {process.specialist.especialidade}
            </p>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            <Package size={14} />
            Produto
          </div>
          <p className="text-sm font-medium text-ink">{productLabel}</p>
          {process.product && (
            <p className="text-xs text-muted mt-1 truncate">
              {[process.product.marca, process.product.modelo]
                .filter(Boolean)
                .join(" ")}
              {process.product.ano ? ` • ${process.product.ano}` : ""}
            </p>
          )}
        </Card>
      </div>

      <Card className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">
            Status
          </span>
          <StatusBadge status={process.status} />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <Calendar size={14} className="text-subtle" />
          Criado em {formatDate(process.created_at)}
        </div>
        {process.appointment_datetime && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Calendar size={14} className="text-subtle" />
            Reunião: {formatDate(process.appointment_datetime)}
          </div>
        )}
        {process.rejection_reason && (
          <div className="flex items-center gap-2 text-sm text-status-bad">
            <AlertCircle size={14} />
            Motivo da rejeição: {process.rejection_reason}
          </div>
        )}
      </Card>

      {!isScheduling && processInfo && (
        <Card className="mb-6 flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-status-ok" />
            <span className="text-muted">Valor do produto:</span>
            <span className="font-semibold text-ink">
              {formatCurrency(processInfo.product_value)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* laranja mantido de propósito — destaque de atenção ao valor, não é um dos 6 status de processo */}
            <AlertCircle size={16} className="text-orange-500" />
            <span className="text-muted">Valor mínimo:</span>
            <span className="font-semibold text-orange-600">
              {formatCurrency(processInfo.minimum_value)}
            </span>
          </div>
          {acceptedProposal && (
            <div className="flex items-center gap-2">
              <Check size={16} className="text-status-ok" />
              <span className="text-muted">Valor aceito:</span>
              <span className="font-semibold text-status-ok">
                {formatCurrency(acceptedProposal.proposed_value)}
              </span>
            </div>
          )}
          {meta && (
            <div className="ml-auto text-xs text-subtle">
              {meta.total} {meta.total === 1 ? "proposta" : "propostas"}
            </div>
          )}
        </Card>
      )}
```

- [ ] **Step 4: Tokenizar o restante do arquivo (agendamento, histórico de propostas, formulário)**

Aplicar exatamente estas trocas de classe (mesmo texto/estrutura, só cor) nos 2 blocos restantes do `return` (agendamento — linhas originais ~501-577; histórico de propostas — linhas originais ~579-731):

| Onde | Classe antiga | Classe nova |
|---|---|---|
| Wrapper `<div className="p-6 rounded-lg shadow bg-white">` (2 ocorrências: agendamento e histórico) | — | Trocar a tag por `<Card>` (sem `p-6`, o `Card` já aplica padding) |
| `<h2 className="h2-style">` (2 ocorrências) | `h2-style` | `text-h2 font-semibold text-ink` |
| `text-sm text-gray-700` / `text-sm text-gray-600` (reunião marcada, mensagens de estado) | `text-gray-700` / `text-gray-600` | `text-ink-soft` / `text-muted` |
| `text-sm text-gray-500` (datas não definidas, textos auxiliares) | `text-gray-500` | `text-muted` |
| `bg-slate-50 border border-slate-200` (caixa da reunião confirmada) | `bg-slate-50 border-slate-200` | `bg-border-soft border-border` |
| `text-slate-800` / `text-slate-700` (textos dentro da caixa da reunião) | `text-slate-800` / `text-slate-700` | `text-ink-soft` |
| `bg-cyan-700 ... hover:bg-cyan-800` (botão "Entrar na reunião") | — | Trocar `<button>` por `<Button type="button">` com `<Video size={16} />` + texto (variante padrão `solid`) |
| `bg-gray-50 border border-gray-200` (caixa "aguardando confirmação") | `bg-gray-50 border-gray-200` | `bg-border-soft border-border` |
| `text-gray-300` (ícone de "nenhuma proposta") | `text-gray-300` | `text-subtle` |
| `border border-gray-200` (card de cada proposta na timeline) | `border-gray-200` | `border-border` |
| `text-xs font-medium text-gray-500` / `text-gray-400` (remetente/data da proposta) | `text-gray-500` / `text-gray-400` | `text-muted` / `text-subtle` |
| `text-gray-600` (mensagem da proposta) | `text-gray-600` | `text-muted` |
| `bg-green-600 hover:bg-green-700` (botão Aceitar) | — | Trocar `<button>` por `<Button type="button" variant="solid">` |
| `bg-red-600 hover:bg-red-700` (botão Rejeitar) | — | Trocar `<button>` por `<Button type="button" variant="danger">` |
| `border-t border-gray-100` (separador antes dos botões de ação) | `border-gray-100` | `border-border-soft` |
| `border-t border-gray-200` (separador antes do form de nova proposta) | `border-gray-200` | `border-border` |
| `bg-red-50 border border-red-200 ... text-red-700` (erro do formulário) | — | Trocar a `<div>` por `<Alert variant="danger">` (import já adicionado no Step 2 se ainda não estiver) |
| `border border-gray-300 focus:ring-2 focus:ring-slate-500 focus:border-slate-500` (2 inputs do formulário) | `border-gray-300` / `focus:ring-slate-500 focus:border-slate-500` | `border-border` / `focus:ring-2 focus:ring-focus-ring` |
| `bg-slate-700 hover:bg-slate-800` (botão "Enviar proposta") | — | Trocar `<button type="submit">` por `<Button type="submit">` |
| `text-gray-500` (valor mínimo aceito, rodapé do form) | `text-gray-500` | `text-muted` |
| `bg-gray-50 border border-gray-200 text-gray-600` (aguardando resposta do especialista) | — | `bg-border-soft border-border text-muted` |

Ao trocar `<button>` por `<Button>`, manter exatamente o mesmo `onClick`/`disabled`/conteúdo (ícone + texto) — só a tag e as classes de cor mudam; o `Button` já aplica `inline-flex items-center justify-center gap-2` e o padding, então remover o `className` de padding/flex manual que o botão antigo tinha, mantendo só classes de layout que não sejam cor/padding (ex: `flex-1` nos botões Aceitar/Rejeitar, que devem continuar).

Import `Alert` no topo do arquivo (junto aos outros imports de componentes do Step 2):

```tsx
import { Alert } from "../../components/ui/alert";
```

- [ ] **Step 5: Verificar tipos**

```bash
cd frontend && npx tsc -b
```

- [ ] **Step 6: Verificar visualmente**

Mesmo padrão de QA (frontend + Playwright mockando `getProcessById`, `getProcessProposals`, e opcionalmente `getMeetingByProcess`). Confirmar especificamente: **o botão de voltar do `PageHeader` aparece e funciona** (primeiro uso real de `showBack`), `StatusBadge`/`ProposalStatusBadge` renderizam com ponto de cor, os 3 cards de Cliente/Especialista/Produto usam a mesma sombra/borda das outras telas já migradas, botões Aceitar/Rejeitar/Enviar proposta usam as variantes certas (`solid`/`danger`).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/consultant/ConsultantProcessDetailPage.tsx
git commit -m "feat(consultor): aplicar PageHeader/BackButton/StatusBadge/ProposalStatusBadge em ConsultantProcessDetailPage"
```

---

### Task 6: Verificação final

**Files:** nenhum (só verificação)

- [ ] **Step 1: Build completo**

```bash
cd frontend && npm run build
```

Expected: `tsc -b` e `vite build` sem erro.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: sem erro novo introduzido pelas Tasks 1-5 (avisos pré-existentes em outros arquivos continuam, fora de escopo).

- [ ] **Step 3: Checklist manual (frontend + Playwright mockado, backend local NUNCA)**

- [ ] Dashboard: 4 KPIs corretos, "Processos vigentes" ordenado por tempo parado, gráfico de status com as 6 cores certas, "Clientes recentes" correto, os 2 atalhos abrem modal sem título duplicado.
- [ ] `ConsultantProcessesPage`: filtro de status usa os mesmos rótulos do restante do sistema, tabela responsiva (rola de lado em 390px), paginação funciona.
- [ ] `ConsultantProcessDetailPage`: botão de voltar do `PageHeader` funciona, `StatusBadge`/`ProposalStatusBadge` corretos, ações (aceitar/rejeitar/enviar proposta) com as variantes certas de `Button`.
- [ ] Nenhuma tela fora desta fatia mudou (Admin, Especialista, Cliente, Auth, Escritório continuam como estavam).

- [ ] **Step 4: Commit final (se sobrar ajuste do checklist)**

```bash
git add -A
git commit -m "chore(consultor): ajustes finais da verificacao manual da fatia 1"
```

(pular se nada precisou ajustar.)
