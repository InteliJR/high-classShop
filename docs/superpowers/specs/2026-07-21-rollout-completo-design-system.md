# Rollout completo do Design System — Especificação

Spec de handoff: cobre o que falta pra aplicar o design system (`DESIGN.md`) em **toda a plataforma**, depois que a fundação + o piloto (Consultor → Meus Clientes) já foram implementados, revisados e verificados com screenshot real. Escrita pra outra sessão/agente conseguir pegar e virar plano de implementação por fatia, sem precisar reconstruir o contexto da auditoria original.

## O que já existe (não refazer)

- **`DESIGN.md`** (raiz do repo) — tokens, componentes (`components/ui/`: button/input/card/alert/dialog; `components/patterns/`: StatusBadge/EmptyState/BackButton/PageHeader), convenção de ícone, layout, navegação. Implementado e commitado na branch `design-system-foundation-pilot`.
- **`PRODUCT.md`** (raiz) — contexto de marca: discreta, monocromática, sem dourado/grafite, sem cor de destaque separada da ação.
- **Piloto**: `frontend/src/pages/consultant/ConsultantClientsPage.tsx` reescrito, `BatchInviteClients.tsx` e `ContractPreviewCallback.tsx` corrigidos (becos sem saída), `Sidebar.tsx` com `/advisor/dashboard` linkado. Todos os 8 componentes têm pelo menos 1 consumidor real. Validado com screenshots reais (Playwright + mock de API — **nunca rodar o backend local nesta máquina**, ver seção de lições abaixo).
- **`Tabs` e `Dropdown menu`** (citados no `DESIGN.md`) — deliberadamente **não construídos ainda**, sem consumidor real. Construir só quando uma fatia abaixo precisar de fato.

## Lições do piloto (aplicar em toda fatia nova)

1. **Título duplicado ao envolver um form existente em `DialogContent`**: se o componente já renderiza seu próprio `<h2>`, usar `hideTitle` no `DialogContent` (já suportado). Achado real no piloto (3 de 4 modais), só pego com screenshot real, não com revisão de código.
2. **Largura duplicada ao aninhar**: um componente que já tinha seu próprio wrapper `w-[...]` (de quando era usado como modal standalone) vira `w-full` ao ser aninhado dentro de `DialogContent` (que já controla a largura) — senão o conteúdo estoura a caixa. Achado real no `BatchInviteClients.tsx`.
3. **`.map()` com múltiplos elementos-irmãos** precisa de `<Fragment key={...}>` explícito — o shorthand `<>` não aceita `key`.
4. **Ambiente de dev nesta máquina**: `nest start --watch` (backend) **crashou a máquina duas vezes**. Nunca rodar o backend local aqui. QA visual = só `npm run dev` do frontend (leve, seguro) + Playwright com `page.route('**/api/**', ...)` mockando toda resposta necessária. Ver memória `feedback_backend_dev_server_crashed_machine`.
5. **Sem test runner no frontend** (nem Jest nem Vitest) — verificação de cada fatia é `npx tsc -b` + `npm run build` + `npm run lint` + screenshot real via Playwright mockado. Não introduzir um test runner novo como parte do rollout.
6. **Botão compartilhado (`Button`)**: variantes antigas (`solid/light/muted/brand`) têm que continuar pixel-idênticas em qualquer arquivo ainda não migrado — nunca alterar o valor de uma variante existente "de passagem" numa fatia que mexe em outra coisa.
7. **Consultor não recebe comissão nesta plataforma** — regra de negócio confirmada, não é lacuna. Não incluir "wallet/comissão de consultor" em nenhuma fatia sem alinhar antes (ver `CLAUDE.md`).

## Ordem do rollout (decidida com o cliente)

Por área, começando pelo Consultor — cada fatia pequena o bastante pra revisar e testar sozinha, na mesma linha do piloto.

1. Consultor (fechar o que sobrou)
2. Especialista
3. Admin
4. Escritório
5. Cliente
6. Auth
7. Consolidação transversal (só depois de 1-6 completas)

---

## Fatia 1 — Consultor (a mais detalhada, pronta pra virar plano)

### 1a. `ConsultantDashboard.tsx` — redesign completo (aprovado nesta sessão)

Hoje é uma segunda "Meus Clientes" reduzida (mesma tabela, sem convite em lote, sem expandir processos) — duplicação apontada na auditoria original. Vira um dashboard de verdade:

- **Arquitetura**: busca `getClients()` + `getAllConsultantProcesses()` uma vez ao montar; todo o resto (KPIs, agrupamento por status, ordenação) é derivado client-side. **Sem endpoint novo** — `GET /consultant/processes` já retorna `updated_at` no JSON (a query Prisma não usa `select`), só o tipo `ConsultantProcess` no frontend não declara o campo; adicionar `updated_at: string` ao tipo é suficiente.
- **Widgets**:
  1. Faixa de KPIs (topo, 4 cards): Clientes totais · Processos ativos · Concluídos · Taxa de conversão.
  2. **Processos vigentes** (coluna principal): processos não-finalizados (status ≠ COMPLETED/REJECTED), ordenados por `updated_at` ascendente (mais tempo parado primeiro — sinaliza o que precisa de atenção sem precisar de dado novo). Cada linha: `StatusBadge`, cliente, especialista, "há X dias sem atualização". Link "Ver todos" → `/consultant/processes`.
  3. **Distribuição por status** (coluna lateral): gráfico com `recharts` (já instalado, mesma lib do dashboard do Especialista) — usar as mesmas 6 cores do `StatusBadge`, não uma paleta nova. **Antes de implementar este widget, ler a skill `dataviz`** (guia de forma/cor/acessibilidade pra qualquer gráfico novo).
  4. **Clientes recentes** (coluna lateral): últimos 3-5 por `created_at` desc, link "Ver todos" → `/consultant/clients`.
  5. **Atalhos rápidos**: os mesmos modais "Convidar cliente" / "Convite em lote" (reaproveitar `InviteClientForm`/`BatchInviteClients` + `Dialog` novo) direto no dashboard — sem duplicar a tabela de clientes que já vive em Meus Clientes.
- **Erros/loading**: um loading só pro fetch inicial; erro vira `Alert` (não bloqueia a página); cada widget sem dado mostra seu próprio `EmptyState` pequeno.
- **Layout**: usa o template de "página de detalhe" do `DESIGN.md` (`PageHeader` sem back — é raiz de Sidebar — + corpo em 2 colunas, empilha abaixo de 900px).

### 1b. `ConsultantProcessesPage.tsx` — aplicar o sistema

- Trocar `STATUS_LABELS`/`STATUS_COLORS` locais (duplicados do que já foi resolvido no piloto) por `StatusBadge`.
- `PageHeader` no lugar do cabeçalho manual.
- A lista de processos usa `grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr]` sem nenhuma classe responsiva — mesmo padrão de problema já corrigido em `ConsultantClientsPage`: virar tabela real dentro de `overflow-x-auto`, ou pelo menos adicionar breakpoint pra empilhar em mobile.
- Filtro de status/cliente (select + dropdown de busca) — tokenizar cores (`border-gray-300`→`border-border` etc.), considerar `Input` novo pro campo de busca do dropdown de cliente.
- Paginação e "limpar filtros" — só tokenizar cores, sem mudança de comportamento.

### 1c. `ConsultantProcessDetailPage.tsx` — aplicar o sistema + primeiro uso real do `BackButton`

- 735 linhas — é a página aninhada (chegada só a partir de Meus Clientes/Processos, não linkada na Sidebar) que finalmente justifica `PageHeader` com `showBack=true` — fecha a lacuna documentada no piloto ("branch `showBack=true` não exercida ainda").
- Mesmos `STATUS_LABELS`/`STATUS_COLORS` duplicados → `StatusBadge`.
- `ProposalStatusBadge` local (4 estados: PENDING/ACCEPTED/REJECTED/COUNTERED, JSX duplicado verbatim também em `NegotiationPage.tsx` por fora desta fatia) — criar `components/patterns/ProposalStatusBadge.tsx` seguindo o mesmo padrão do `StatusBadge` (pílula neutra + ponto de cor), consumir aqui; **não** migrar `NegotiationPage.tsx` ainda (fora do escopo desta fatia — mas o componente já fica pronto pra quando chegar a vez).
- Botões de ação (aceitar/rejeitar proposta, criar contrato) → `Button` com as variantes corretas (`danger` pra rejeitar, `solid` pra aceitar/avançar).

---

## Fatias futuras — nível macro (o que a auditoria já mapeou, sem detalhar componente-a-componente ainda)

### Fatia 2 — Especialista
- `ProcessesPage.tsx`, `ProductsPage.tsx`: mesmo padrão (StatusBadge, PageHeader, tokens, ícones só lucide — `ProductsPage` hoje tem SVG desenhado à mão pra editar/excluir).
- `CreateContractPage.tsx` — **maior arquivo da plataforma (1835 linhas)**, maior risco da fatia. Considerar dividir em componentes menores como parte da migração (não só reskin).
- `ContractPreviewCallback.tsx` já teve o beco sem saída corrigido no piloto — só falta aplicar tokens/Button de forma completa (hoje mistura `Button` novo com classes `bg-slate-700` cruas nos estados não tocados).
- Modal do Especialista (`RequireCalendlyModal`/`RequireGoogleMeetModal`) — migrar pro `Dialog` novo.

### Fatia 3 — Admin
- `DashboardPage.tsx` sem atalhos de ação rápida (Office tem `ActionCard`, Admin não) — mesma oportunidade de enriquecimento que o Consultor ganhou nesta sessão; desenhar depois, com brainstorm próprio (dados/permissões diferentes: visão cross-role, Base de Dados).
- `CompaniesPage`/`SpecialistsPage` já usam modal de confirmação estilizado; `OfficeConsultantsPage` usa `window.confirm()` nativo — padronizar todos pro `Dialog` novo.
- `DatabasePage.tsx` — bem construída isoladamente, mas sem link de nenhuma linha pro CRUD da entidade. Considerar cross-link como parte da fatia.
- Falta rota `/admin/consultants` (hoje só existe em `/office/consultants`) — decisão de produto a confirmar antes de implementar.

### Fatia 4 — Escritório
- `OfficeConsultantsPage.tsx` duplica o convite em lote do Consultor (`BatchInvite` embutido) — considerar reaproveitar o mesmo `Dialog`/fluxo do piloto em vez de manter 2 implementações.
- Mesma tokenização/ícones/responsividade das demais.

### Fatia 5 — Cliente
- `CatalogPage.tsx` — botão "Filtro" abre modal com placeholder falso, sem filtro real — decisão de produto (implementar filtro de verdade ou remover o botão) antes de só reskinar.
- `ProductPage.tsx` — sem breadcrumb (o `Breadcrumb.tsx` órfão foi removido no piloto; decidir se cria um novo ou usa `PageHeader` com contexto).
- Duas implementações divergentes de "agendar com especialista" (`ProductPage` vs `ConsultoriaPage`) — consolidar em um hook/fluxo só antes de aplicar visual, senão o bug de agendamento órfão (popup fechado sem cleanup) sobrevive escondido atrás de um verniz novo.

### Fatia 6 — Auth
- Telas de "convite expirado/inválido" sem nenhum botão em 3 de 4 páginas de registro (`RegisterConsultantPage`/`RegisterOfficePage`/`RegisterSpecialistPage` vs. `RegisterPage`, que já tem) — mesmo padrão de beco sem saída já corrigido 3x no piloto; replicar a correção nessas 3 telas é parte natural da fatia.

---

## Fatia 7 — Consolidação transversal (só depois de 1-6 completas)

- Remover `components/ui/Modal.tsx` e `components/shared/Modal.tsx` (os 2 modais antigos concorrentes) — só depois que **todo** consumidor de ambos tiver migrado pro `Dialog` novo (checar com grep antes de apagar).
- Remover todos os mapas `STATUS_LABELS`/`STATUS_COLORS` locais restantes fora dos já resolvidos acima.
- Migrar `NegotiationPage.tsx` pro `ProposalStatusBadge` criado na Fatia 1c (fecha a duplicação verbatim apontada na auditoria).
- Só neste ponto crirar `Tabs`/`Dropdown menu` caso alguma fatia acima tenha revelado um consumidor real pra eles — senão, deixar pra quando surgir.

## Fora de escopo desta spec (decisões separadas, não implementar sem alinhar antes)

- **Comissão/wallet de consultor** — não existe nesta plataforma, não é lacuna (ver `CLAUDE.md` § Known inconsistencies).
- **Dashboards enriquecidos do Admin/Especialista/Escritório** — só o do Consultor foi desenhado (Fatia 1a). Os outros têm dados/permissões diferentes (ex: Admin precisa de visão cross-role, preview de Base de Dados) e merecem seu próprio brainstorm antes de implementar — não copiar o layout do Consultor sem essa conversa.
- **Filtro real do catálogo, rota `/admin/consultants`, decisão sobre unificar `ProductPage`/`ConsultoriaPage`** — decisões de produto sinalizadas nas fatias 3/5 acima, não implementar até o cliente confirmar.
