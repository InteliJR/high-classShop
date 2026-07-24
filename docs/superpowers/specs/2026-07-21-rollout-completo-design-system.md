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

## Tabela canônica de tokenização (reaproveitada por Fatias 2-6)

Achado transversal da pesquisa das Fatias 2/3: existem **2-3 vocabulários de cor "primária" concorrentes** espalhados pela plataforma (`slate-700/800/900` em `ProcessesPage`/`CreateContractPage`; `gray-800/900`/`bg-black` em `ProductsPage`/`SpecialistDashboard`/`CompaniesPage`/`OfficeDashboardPage`'s `ActionCard`; `blue-600` nos modais de conexão). Regra única pra todas as fatias a partir daqui: **qualquer botão de ação vira o `Button` compartilhado** (não importa se hoje é `slate` ou `gray` ou `black`) — a pergunta нunca é "slate ou gray?", é "isso é uma ação primária, secundária ou destrutiva?".

| Padrão bruto encontrado | Vira |
|---|---|
| Botão de ação primária: `bg-slate-700/800/900`, `bg-gray-800/900`, `bg-black` (+ hovers) | `<Button>` (variante `solid`, padrão) |
| Botão secundário: `border-gray-300` + fundo branco/claro | `<Button variant="light">` |
| Botão destrutivo: `bg-red-600`/`bg-red-500` num botão de ação (não ícone de linha) | `<Button variant="danger">` |
| Ícone de linha (editar) | `hover:bg-border-soft text-ink-soft` + ícone lucide (`Pencil`) — nunca SVG à mão ou `<img>` |
| Ícone de linha (excluir) | `hover:bg-status-bad-wash text-status-bad` + ícone lucide (`Trash2`) |
| Aba/tab ativa vs inativa (ex: `border-slate-700 text-slate-800` vs `border-transparent text-gray-500`) | `border-ink text-ink` (ativa) vs `border-transparent text-muted hover:text-ink-soft` (inativa) — **não** é `Button` nem o `Tabs` ainda-não-construído, continua um botão simples tokenizado até um consumidor justificar o componente compartilhado |
| `text-gray-400`, `text-slate-400` | `text-subtle` |
| `text-gray-500`/`600`, `text-slate-500`/`600` | `text-muted` |
| `text-gray-700`, `text-slate-700`/`800` | `text-ink-soft` |
| `text-gray-900`, `text-slate-900` | `text-ink` |
| `border-gray-100`, `border-slate-100` | `border-border-soft` |
| `border-gray-200`/`300`, `border-slate-200`/`700` (quando não for aba ativa) | `border-border` |
| `bg-gray-50`/`100`, `bg-slate-50`/`100` | `bg-border-soft` |
| `bg-white` | `bg-surface` |
| `focus:ring-slate-500`, `ring-slate-500` | `focus:ring-focus-ring` |
| Banner de página inteira (erro/sucesso, `bg-red-50 border-red-200 text-red-700` / `bg-green-50 ...`) | `<Alert variant="danger">` / `<Alert variant="success">` |
| Badge/pílula de status inline menor (não banner) — ex: `bg-blue-100 text-blue-800` pra especialidade, `bg-emerald-50 text-emerald-700` pra taxa | **não forçar pro `StatusBadge`** (que é só pra status de PROCESSO) — tokenizar cor só se for genuinamente um dos 6 status; caso contrário manter como pílula neutra (`bg-border-soft text-ink-soft`) ou, se for uma métrica positiva (taxa/percentual), `bg-status-ok-wash text-status-ok` |

Exceção documentada: cor usada como **destaque não-semântico** (ex: laranja em "valor mínimo" na Fatia 1) fica como está — nem toda cor crua é um status a mapear.

## Fatia 2 — Especialista (detalhada, pronta pra virar plano)

Pesquisa de código confirmou: nenhum arquivo desta fatia usa `Button` ou `Dialog`/`Modal` novos ainda (`ProcessesPage`/`ProductsPage`/`CreateContractPage` são 100% raw); os 2 modais de conexão (Calendly/Google Meet) são overlays construídos à mão, não usam nenhum dos 2 `Modal` antigos.

### 2a. `ProcessesPage.tsx` (548 linhas)
- Cabeçalho manual → `PageHeader`.
- 10 `<button>` crus (toggle de filtro, criar processo, limpar busca/filtros, paginação, chips de filtro) → tabela canônica acima (a maioria vira `Button variant="light"` ou `solid`; os "X" de remover chip/busca ficam ícone-only tokenizado, sem virar `Button`).
- Sem mapa de cor de status (usa só `STATUS_OPTIONS` de rótulo pro filtro) — nada a trocar por `StatusBadge` aqui além de garantir que `ProcessCard` (componente separado, fora desta fatia — só consumido, não redefinido) já renderiza status corretamente; **não tocar em `ProcessCard.tsx`** nesta fatia (é um componente grande e compartilhado, considerar fatia própria depois se a auditoria apontar necessidade).

### 2b. `ProductsPage.tsx` (285 linhas)
- Ícones de editar/excluir são SVG desenhado à mão (não lucide) → `Pencil`/`Trash2`.
- 6 botões crus → tabela canônica.
- Já usa `text-text-primary` (token semântico) misturado com cinza cru no mesmo arquivo — inconsistência a resolver: tudo vira os tokens novos, não o `text-text-primary` antigo nem cinza cru.

### 2c. `CreateContractPage.tsx` (1835 linhas — maior arquivo da plataforma)
- **Não dividir em componentes menores nesta fatia** — decisão revista: dividir arquivo é uma refatoração estrutural maior que o objetivo desta fatia (aplicar design system); vira candidato de uma limpeza técnica separada, não bloqueia o rollout visual. Aplicar só tokenização + `Button` nos 4 botões crus (CTA de erro/reload, submit, cancelar) e no cabeçalho (ícone `FileText` + título).
- O padrão de campo de formulário repetido ~35+ vezes (`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white`) é o ganho mais mecânico: uma substituição de string só, repetida em todo o arquivo (não precisa virar o componente `Input` novo — os campos aqui são controlados por `react-hook-form`/`Controller`, trocar pra `Input` exigiria adaptar a integração; escopo desta fatia é só tokenizar a classe crua, deixar a migração pro componente `Input` pra quando `CreateContractPage` for tocada de novo por outro motivo).

### 2d. `ContractPreviewCallback.tsx` — finalizar tokenização
- Já usa `Button` em 3 pontos (fundação do piloto). Restam ~11 classes `text-slate-400/500/600/800`/`bg-slate-50` na página em volta (título, corpo, fundo) — tokenizar (`text-ink`/`text-muted`/`bg-bg`), sem mexer na lógica ou nos 3 usos de `Button` já corretos.

### 2e. `RequireCalendlyModal.tsx` / `RequireGoogleMeetModal.tsx` — migrar pro `Dialog`
- Hoje são overlays 100% construídos à mão (backdrop + painel próprios), cada um com um cabeçalho em gradiente (`from-blue-600 to-indigo-600` / `from-emerald-600 to-teal-600`).
- **Decisão de design (aplicando o princípio de `PRODUCT.md` — discreto, sem "exibição"): o gradiente sai.** Vira `Dialog`/`DialogContent` padrão (título normal, sem `hideTitle` — não há form duplicando título aqui), ícone (`Calendar`/`Video`) ao lado do título em vez de banner colorido. Os 3 botões (dispensar-X, "Conectar agora", "Lembrar mais tarde") viram `Button` (`solid` / `light`) + o X de fechar do próprio `Dialog`.
- **Comportamento não muda nesta fatia** — "Lembrar mais tarde" continua suprimindo pelo resto da sessão (o bug em si, se for pra corrigir, é uma mudança de comportamento fora do escopo de "aplicar design system").

## Fatia 3 — Admin (detalhada, pronta pra virar plano)

Reskin simples confirmado com o cliente — **sem** widgets ricos/cross-role nesta fatia (isso vira uma conversa própria depois, como a do Consultor). Pesquisa confirmou: `CompaniesPage`/`SpecialistsPage`/`MyCompanyPage` já usam `Button` parcialmente e o `Modal` antigo (`ui/Modal.tsx`); `DashboardPage`/`CommissionsPage`/`DatabasePage`/`SettingsPage` são 100% raw (zero `Button`, zero modal).

### 3a. `DashboardPage.tsx` — reskin + atalhos rápidos (sem redesenhar os widgets)
- Cabeçalho manual → `PageHeader`.
- 6 stat cards (`bg-gray-300`) → `Card` com os mesmos números/labels, só tokenizado.
- Gráficos (`recharts`, já existentes: `LineChart` de vendas + `PieChart` de processos por consultor) — **mantidos como estão nesta fatia**, só tokenizar a moldura (`Card` em vez de `bg-white rounded-lg p-6 shadow-sm border border-gray-200`); as cores hardcoded do próprio gráfico (`COLORS` array de hex) ficam — não é a mesma paleta de status de processo, é uma paleta de identidade por consultor, fora do escopo desta fatia.
- **Adicionar atalhos rápidos** (novo, mas pequeno — reaproveita o padrão `ActionCard` que `OfficeDashboardPage.tsx` já usa, só tokenizado): "Gerenciar escritórios" → `/admin/companies`, "Gerenciar especialistas" → `/admin/specialists`, "Configurações" → `/admin/settings`.

### 3b. `CompaniesPage.tsx` (758 linhas) e `SpecialistsPage.tsx` (229 linhas) — finalizar migração
- Já usam `Button` (parcial) e `Modal` (`ui/Modal.tsx`, `{isOpen, onClose, children}`) — migrar as 3 (`CompaniesPage`) / 2 (`SpecialistsPage`) instâncias de `Modal` pro `Dialog`/`DialogContent` novo (mesmo padrão do piloto — checar se o form interno já tem `<h2>` próprio pra decidir `hideTitle`).
- `EditIcon`/`TrashIcon` (imagens SVG estáticas) → `Pencil`/`Trash2` lucide.
- `alert(errorMessage)` nativo no fluxo de erro de exclusão — **manter como está** (não é modal, é fora do escopo de "unificar modal"; troca de `alert()` por um padrão de notificação é uma mudança de UX maior, não desta fatia).
- Resto: tabela canônica de tokenização.

### 3c. `CommissionsPage.tsx` (537 linhas) — 100% raw, maior risco desta fatia depois do Dashboard
- `TabButton` local (ativo/inativo) → tokenizar conforme a tabela canônica (não widget novo).
- `SplitBar({color: "bg-emerald-500"|"bg-sky-500"|"bg-violet-500"})` — recebe cor crua via prop. **Não é status de processo** (é a identidade visual fixa de Especialista/Escritório/Plataforma na barra de divisão de comissão) — manter os 3 tons como estão (são uma paleta categórica própria, de 3 categorias fixas, não 6 status), só confirmar que continuam com bom contraste; não tokenizar como se fossem os tokens de status.
- `RateRow` (estado local idle/saved/error) → usar `text-status-ok`/`text-status-bad` nos estados salvo/erro.
- Exportar CSV/PDF (`exportSalesCsv`/`exportSalesPdf`) — lógica intocada, só os botões viram `Button variant="light"` com ícone (`Download`/`FileText`).

### 3d. `DatabasePage.tsx` (207 linhas) — reskin, sem cross-link nesta fatia
- **Cross-link de cada linha pro CRUD da entidade — fica fora desta fatia** (decisão: é uma mudança de navegação/produto, não só visual; considerar como parte de uma fatia de "consolidação de navegação Admin" futura, não bloquear o reskin nesta).
- Tab de entidade (mesmo padrão `border-slate-700 text-slate-800` vs cinza) → tokenizar igual `CommissionsPage`.
- Botões CSV/PDF/paginação → `Button variant="light"`.

### 3e. `SettingsPage.tsx` (414 linhas) e `MyCompanyPage.tsx` (292 linhas)
- `SettingsPage` tem seu próprio shell de página (`min-h-screen bg-gray-50` + header sticky próprio) diferente do padrão das outras páginas Admin (que renderizam direto no slot do layout) — **normalizar pro mesmo padrão das demais** (sem shell próprio, `PageHeader` como as outras).
- Toggle switch construído à mão (não existe `Switch` compartilhado, e só tem 1 consumidor) — **não criar componente novo agora** (mesma regra do `Tabs`/`Dropdown`: só com 2º consumidor real). Só tokenizar as cores do toggle em si.
- Banners de erro/sucesso locais (duplicados entre os 2 arquivos, mesma receita) → `Alert`.
- `MyCompanyPage` já usa `Button` (só no submit) — manter, só tokenizar o resto do formulário.

### 3f. `Sidebar.tsx` — link "Consultores" pro Admin
- Adicionar ao `case "ADMIN":` um item `{ to: "/office/consultants", label: "Consultores", icon: <Users size={20} /> }` (rota já permite `ADMIN` no guard, `Users` já importado no arquivo) — **sem rota nova**, decisão confirmada com o cliente.

## Fatias futuras — nível macro (o que a auditoria já mapeou, sem detalhar componente-a-componente ainda)

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
