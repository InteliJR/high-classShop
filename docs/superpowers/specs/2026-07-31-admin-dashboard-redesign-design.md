# Admin Dashboard Redesign — Design

Data: 2026-07-31

## Contexto

O dashboard do admin (`frontend/src/pages/admin/DashboardPage.tsx`) hoje mostra 6 cards
genéricos de estatística (incluindo "Taxa de Conversão", que não é um número acionável
para o admin), um gráfico de vendas por mês e um gráfico de desempenho por consultor. Ele
não dá nenhuma visão de como está a comissão por processo/venda, nem um panorama rápido
da base de dados da plataforma — mesmo essas duas informações já existindo em telas
dedicadas (`/admin/commissions` e `/admin/database`) que hoje só são alcançáveis pela
navegação lateral, não pelo dashboard.

Inspiração visual pedida pelo usuário: `locpay_full/app/frontend` (LocPay, branch
`origin/main`). Pesquisa feita nos arquivos `app/dashboard/operator/page.tsx`,
`components/ds/HeroStat.tsx`, `components/ds/Delta.tsx`, `components/dashboard/
CommissionByEntityTable.tsx` e no sistema `components/dashboard/modern/*`. Padrões
relevantes: hierarquia nos KPIs (não cards flat idênticos), badges de tendência,
tabela de comissão com tiles agregados + linhas por entidade, cards de atalho com ícone
em vez de botões lisos. A stack da LocPay é Next.js + framer-motion + um design system
próprio (`ds/*` e `modern/*`) que não existe neste projeto — a inspiração é conceitual
(composição, hierarquia, tom sério/financeiro), não porte de componente.

## Não-objetivos

- Não portar framer-motion, o sistema `ds/*` ou `modern/*` da LocPay.
- Não duplicar as telas `/admin/commissions` e `/admin/database` inteiras no dashboard —
  o dashboard mostra um resumo com link "ver tudo/ver todas".
- Não mexer no dashboard do especialista (`SpecialistDashboard.tsx`) — ele tem seu
  próprio `conversionRate`, calculado por um endpoint separado (`getSpecialistStats`),
  e não foi pedido.
- Não criar novos endpoints HTTP — os dois cards novos entram como campos extras na
  resposta que o dashboard já busca.

## Arquitetura

Uma única chamada de rede continua alimentando o dashboard do admin
(`GET /dashboard/admin` → `getDashboardStats()` no frontend). `DashboardService.
getAdminStats()` passa a injetar `CommissionsService` e `AdminDatabaseService` (ambos já
existem; só precisam exportar o provider) e agrega os dados deles na mesma resposta.
Nada de fetch adicional no componente React — os dois cards novos só leem campos novos
do mesmo `stats` que os cards existentes já usam.

```
DashboardModule
 ├── imports: CommissionsModule (export CommissionsService)
 ├── imports: AdminDatabaseModule (export AdminDatabaseService)
 └── DashboardService.getAdminStats()
      ├── ...contagens existentes (sem conversionRate)
      ├── commissionSummary  ← CommissionsService.listSales()
      └── databaseCounts     ← AdminDatabaseService (novo método de contagem)
```

## Backend

### Remover taxa de conversão

Em `DashboardService.getAdminStats()`: remover as queries `totalProcesses` e
`completedProcesses` (só existiam para calcular `conversionRate`) e o campo
`conversionRate` do retorno. (`getSpecialistStats()` não é tocado — cálculo
independente, usado pelo dashboard do especialista.)

### `commissionSummary`

Reaproveita `CommissionsService.listSales()` (já busca todos os contratos assinados com
o split especialista/escritório/plataforma — nenhuma query nova). `DashboardService`
agrega em memória:

```ts
commissionSummary: {
  totalPaid: number;   // soma de totalCommission de todas as vendas
  thisMonth: number;   // soma onde signedAt cai no mês corrente
  avgTicket: number;   // totalPaid / vendas.length (0 se não houver vendas)
  recentSales: SaleCommission[]; // 5 mais recentes (listSales já ordena por signedAt desc)
}
```

Reaproveita o tipo `SaleCommission` que já existe em `commissions.service.ts` — sem tipo
novo.

### `databaseCounts`

`AdminDatabaseService` ganha um método novo que reaproveita o whitelist `ENTITIES` já
existente (o mesmo usado por `/admin/database/:entity` — garante que o dashboard nunca
expõe uma entidade que a tela de Base de Dados já não exponha):

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

## Frontend

### `services/dashboard.service.ts`

`DashboardStats`: remove `conversionRate`, adiciona:

```ts
commissionSummary: {
  totalPaid: number;
  thisMonth: number;
  avgTicket: number;
  recentSales: SaleCommission[]; // importa o tipo de commissions.service.ts
};
databaseCounts: { key: string; label: string; count: number }[];
```

### `pages/admin/DashboardPage.tsx`

Composição da página, de cima para baixo:

1. **`PageHeader`** — mantém título de boas-vindas.
2. **Linha de KPIs** — 5 cards (Processos Ativos, Escritórios Ativos, Especialistas
   Ativos, Clientes Cadastrados, Produtos Cadastrados). Cada `Card` ganha um ícone
   `lucide-react` num quadrado com fundo suave (`bg-border-soft`), à esquerda do label —
   único elemento visual novo aqui, sem libs novas. Mesma grade responsiva atual
   (`grid-cols-2 md:grid-cols-4` vira `md:grid-cols-5` pra caber os 5 sem sobra).
3. **Card "Comissão por processo"** (novo) — dentro de `Card`:
   - Cabeçalho com ícone + título + link "ver todas →" para `/admin/commissions?tab=sales`.
   - Linha de 3 números: Total pago, Este mês, Ticket médio (mesmo estilo tipográfico dos
     KPIs — valor grande, label pequeno acima).
   - Lista das 5 vendas recentes: produto + cliente à esquerda, barra empilhada de 3
     segmentos (especialista/escritório/plataforma — mesmas cores `bg-emerald-500` /
     `bg-sky-500` / `bg-violet-500` que `CommissionsPage.tsx` já usa, pra manter a
     linguagem de cor consistente entre as duas telas) + valor total à direita.
   - Estado vazio: "Nenhuma venda fechada ainda." (mesma mensagem da `CommissionsPage`).
4. **Card "Base de dados"** (novo) — dentro de `Card`:
   - Cabeçalho com ícone + título + link "ver tudo →" para `/admin/database`.
   - Grade pequena (`grid-cols-2 md:grid-cols-3`) de tiles: label da entidade + contagem
     grande abaixo, cada tile é um `Link` para `/admin/database` (a tela já seleciona a
     primeira entidade por padrão; passar a entidade via query string é um nice-to-have,
     não obrigatório pro escopo desta spec).
5. **Gráficos** — mantém os dois gráficos existentes (vendas por mês, desempenho por
   consultor) exatamente como estão hoje, só ajustando espaçamento pra ficar consistente
   com os cards novos acima.
6. **Atalhos rápidos** — os mesmos 3 links (`Gerenciar escritórios`, `Gerenciar
   especialistas`, `Configurações`), trocando o botão sólido escuro por um `Card`
   clicável com ícone + label (visual mais leve, consistente com os cards acima em vez
   de destoar como botão CTA).

### `pages/admin/CommissionsPage.tsx`

Pequeno ajuste: ler `?tab=` da URL (`useSearchParams`) para inicializar o estado `tab`,
assim o link vindo do dashboard (`?tab=sales`) abre direto na aba "Por venda" em vez da
aba de configuração de taxas.

## Animações

Levantamento: `framer-motion` já é dependência do frontend (`^12.34.2`) e já está em uso
em `components/ui/dialog.tsx` e `components/ui/alert.tsx` (fade + scale sutil, 150ms,
respeitando `useReducedMotion()`) e nas landing pages (`HeroSection.tsx`, `Product.tsx`).
`ProductCard.tsx` tem uma animação mais expressiva ("balatro-styled", commit `c7bdab3`) —
tratada como exceção pontual de uma página de catálogo/marketing, não como padrão geral.
O guia (`docs/docs/design.md`): "Animações sutis (fade/slide 150–250ms) — sem motion
excessivo." Fora de Dialog/Alert/landing/ProductCard, as telas administrativas (incluindo
o dashboard atual) não têm nenhuma animação deliberada hoje — só `transition-colors`
padrão do Tailwind em hovers de botão/link, que já existe e não muda.

Para este redesign, aplicar o mesmo padrão já estabelecido em `dialog.tsx`, em vez de
introduzir um estilo novo:

- **Entrada dos cards**: cada `Card` da página (KPIs, Comissão por processo, Base de
  dados, gráficos, atalhos) usa `motion.div` com `initial={{ opacity: 0, y: 8 }}`,
  `animate={{ opacity: 1, y: 0 }}`, `transition={{ duration, delay }}` — mesma constante
  `duration = useReducedMotion() ? 0 : 0.2` usada no Dialog. `delay` é um stagger pequeno
  por índice do card (`index * 0.03`, teto de ~6 cards visíveis por vez — sem stagger
  perceptível em listas longas tipo `recentSales`).
- **Hover em card clicável** (tiles de "Base de dados", atalhos rápidos): só CSS —
  `transition-shadow hover:shadow-ds-floating` (token que já existe, sem JS/framer-motion
  necessário pra um hover).
- **Não fazer**: sem contador numérico animado nos KPIs, sem animação nas barras de
  split de comissão, sem reprodução do estilo "balatro" do `ProductCard` — motion
  excessivo é exatamente o que o guia pede pra evitar num painel administrativo.

## Erros e estados de carregamento

Mesmo padrão que a página já usa hoje: um `isLoading` cobre a página inteira (já é assim
no código atual) — os cards novos entram nesse mesmo guard, sem loading state próprio.
Se `commissionSummary.recentSales` vier vazio, mostra o estado vazio descrito acima; se
`databaseCounts` vier vazio (não deveria, whitelist é fixo), a grade simplesmente não
renderiza tiles.

## Testes

- Backend: teste em `dashboard.service.spec.ts` (criar se não existir) cobrindo
  `commissionSummary` (soma correta, filtro do mês corrente, avgTicket com 0 vendas) e
  `databaseCounts` (uma entrada por chave do whitelist).
- Frontend: sem teste de componente novo obrigatório (não há suíte de componente para
  `DashboardPage.tsx` hoje) — verificação visual manual via `npm run dev` cobre este
  escopo, seguindo o padrão já usado nas outras páginas admin.
