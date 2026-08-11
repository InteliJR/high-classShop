# Design System — BMF Lux Brokerage

Este documento é a especificação visual da plataforma: tokens, componentes, navegação, ícones e layout. Companheiro de `PRODUCT.md` (o *porquê* da marca) e de `CLAUDE.md` (arquitetura de código). Resultado de uma auditoria completa da plataforma (bugs de fluxo, navegação, consistência visual e jornadas por papel) seguida de um brainstorm de design — decisões abaixo já foram validadas, não são propostas em aberto.

## Decisões já fechadas

- Paleta atual mantida (branco suave, preto, cinza) — organizada em tokens semânticos, não substituída por identidade nova.
- Ação monocromática — sem cor de destaque separada para botão primário/links/foco.
- Status usa indicador discreto (pílula neutra + ponto de cor), não pílula saturada — ver [Status](#status).
- Base de componentes: shadcn/ui sobre Radix + CVA + tailwind-merge (mesma base da locpay_full).
- Só modo claro nesta fase — tokens organizados para permitir dark mode depois, sem implementá-lo agora.
- Whitelabel por escritório continua intacto para telas do cliente final; Admin/Specialist continuam neutros.
- Execução: fundação completa + piloto real (fluxo do Consultor + 3 becos sem saída críticos) nesta primeira leva; resto da migração vira plano de rollout separado, fatiado por área.

## Paleta

### Neutros

| Token | Hex | Uso |
|---|---|---|
| `--ink` | `#1C1C1C` | título, texto principal, botão primário (hover) |
| `--ink-soft` | `#3C3C3C` | cabeçalho da página, superfícies escuras |
| `--action` | `#2C2C2C` | fundo do botão primário |
| `--muted` | `#6B6B6B` | texto secundário — valor único, substitui a mistura de `gray-500/600/700` |
| `--subtle` | `#9A9A9A` | placeholder, texto desabilitado |
| `--border` | `#D9D9D9` | borda de input/card — valor único |
| `--border-soft` | `#E9E9E9` | divisor sutil |
| `--bg` | `#F5F5F5` | fundo de página |
| `--surface` | `#FFFFFF` | card, modal, input |
| `--focus-ring` | `#1C1C1C` | anel de foco — valor único, substitui preto/azul/slate misturados |

### Status

Mesmas 6 cores que a plataforma já associa a cada etapa do processo — hoje espalhadas em 4 mapas diferentes com tons inconsistentes (700 vs 800, com ou sem borda). Aqui, uma receita única por cor, usada só como **ponto de indicador discreto** (ver [StatusBadge](#componentes)), nunca como pílula saturada de fundo cheio.

| Status | Cor do ponto | Significado |
|---|---|---|
| Agendamento (`SCHEDULING`) | `#1D4ED8` (azul) | aguardando reunião |
| Negociação (`NEGOTIATION`) | `#B45309` (âmbar) | proposta em andamento |
| Contrato (`PROCESSING_CONTRACT`) | `#C2410C` (laranja) | contrato em preparo/assinatura |
| Documentação (`DOCUMENTATION`) | `#7E22CE` (roxo) | documentação final |
| Concluído (`COMPLETED`) / sucesso | `#15803D` (verde) | processo finalizado |
| Rejeitado (`REJECTED`) / erro | `#B91C1C` (vermelho) | processo encerrado sem sucesso |

Banners/Alert de página (que precisam de mais peso visual que um badge de tabela) usam a mesma cor em fundo claro (`bg-{cor}-50`) + texto forte (`text-{cor}-700`) + borda (`border-{cor}-200`) — a única exceção onde a cor aparece "cheia", porque ali ela é a mensagem principal da tela, não um rótulo de linha de tabela.

### Whitelabel

Sem mudança: telas do `CUSTOMER` continuam lendo `--brand-primary` / `--brand-secondary` / `--brand-primary-fg` / `--brand-secondary-fg`, setados em runtime pelo `ThemeProvider` a partir da cor da concessionária/escritório. `ADMIN` e `SPECIALIST` continuam neutros, usando só os tokens acima.

## Tipografia

Fonte mantida: **Inter** (já é a fonte da plataforma). Regra: nunca mais de 3 pesos por tela (400/600/700).

| Papel | Tamanho | Peso | Entrelinha | Uso |
|---|---|---|---|---|
| `display` | 32px | 700 | 1.2 | título de destaque (landing, tela vazia grande) — raro |
| `h1` | 26px | 700 | 1.25 | título de página (PageHeader) |
| `h2` | 20px | 600 | 1.3 | título de seção dentro da página |
| `h3` | 16px | 600 | 1.4 | título de card/subseção |
| `body` | 15px | 400 | 1.55 | texto padrão de UI, parágrafo, célula de tabela |
| `body-strong` | 15px | 600 | 1.55 | ênfase inline (ex: nome do cliente numa linha) |
| `small` | 13px | 400 | 1.5 | texto auxiliar, dica de campo, metadado |
| `label`/`caption` | 12px | 600 | 1.3 | rótulo de campo, cabeçalho de tabela, eyebrow — sempre uppercase + `letter-spacing: .04em` |

Só `h1`/`display` usam `text-wrap: balance`. Texto de corpo tem largura máxima de ~65 caracteres antes de quebrar em card/coluna.

## Espaço, forma e elevação

**Espaçamento** — grade de 4px, só estes 8 valores (hoje há `p-2`, `p-2.5`, `p-3`, `p-4`, `p-6`, `p-8` todos representando "espaçamento de card" em arquivos diferentes):

`4` micro · `8` inline · `12` campo · `16` padrão · `24` card · `32` seção · `48` bloco · `64` página

**Arredondamento** — 4 valores, cada um com papel fixo (hoje há 5 valores diferentes só pra botão):

| Token | Valor | Uso |
|---|---|---|
| `sm` | 6px | input, badge |
| `md` | 8px | botão, item de lista |
| `lg` | 12px | card, modal |
| `full` | 999px | pill, avatar |

**Elevação** — 3 níveis ligados a camada de interface, não a gosto pessoal (hoje o overlay de modal varia de 40% a 85% de opacidade sem critério):

| Nível | Sombra | Uso |
|---|---|---|
| 0 · plano | nenhuma (só borda) | linha de tabela, input |
| 1 · repouso | `0 1px 2px rgba(28,28,28,.06), 0 1px 3px rgba(28,28,28,.08)` | card |
| 2 · flutuante | `0 4px 12px rgba(28,28,28,.12)` | dropdown, tooltip |
| 3 · modal | `0 10px 30px rgba(0,0,0,.25)` + overlay fixo em 45% preto | modal/dialog |

## Ícones

Convenção única: **lucide-react** (já é maioria — 43 arquivos). Elimina as outras 3 fontes que convivem hoje: SVG estático em `<img>`, SVG desenhado à mão, emoji/unicode cru (`✕`, `✓`, `✗`, `🔍`).

Regras fixas:
- `stroke-width` sempre `1.8` (hoje varia 1.5/2/2.5 dependendo do arquivo).
- Cor sempre `currentColor` (herda do texto), exceto quando o próprio ícone comunica status (check verde, alerta âmbar).
- Tamanho por contexto, não "o que couber":

| Contexto | Tamanho |
|---|---|
| Inline com texto pequeno (badge, link auxiliar) | 14px |
| Padrão — dentro de botão/rótulo | 16px |
| Ação de linha de tabela | 18–20px |
| Nível de página (empty state, cabeçalho de seção) | 24–32px |

Mapa de conceito → ícone (lucide): Voltar `ArrowLeft` · Avançar `ArrowRight` · Editar `Pencil` · Excluir `Trash2` · Adicionar `Plus` · Fechar `X` · Buscar `Search` · Filtrar `Filter` · Exportar `Download` · Importar `Upload` · Calendário `Calendar` · Usuário `User` · Notificação `Bell` · Mais opções `MoreVertical` · Ordenar `ArrowUpDown` · Sucesso `CheckCircle2` · Alerta `AlertTriangle` · Informação `Info`.

## Componentes

Inventário completo do `components/ui/` (gerado via shadcn sobre Radix):

| Componente | Situação hoje | Ação |
|---|---|---|
| `Button` | existe (`button.tsx`), hardcoda cores fora do token | reescrever com CVA, variantes: solid/light/muted/brand/ghost/danger |
| `StatusBadge` | não existe — 4 mapas de cor duplicados ad hoc | criar: pílula neutra + ponto de cor (ver [Status](#status)), prop única `status` |
| `Input`/`Select` | reimplementado por página | criar, anel de foco único |
| `Modal`/`Dialog` | **dois** componentes concorrentes (`ui/Modal.tsx`, `shared/Modal.tsx`) + ~10 modais hand-rolled | consolidar num só, sobre `Dialog` do Radix (título, X, ESC, clique-fora, Cancelar sempre visíveis) |
| `BackButton` | não existe — 4 padrões diferentes em ~15 lugares | criar componente único, ver [Navegação](#navegação) |
| `Card` | ad hoc, 5 combinações de padding/raio/sombra diferentes | criar, usa tokens de espaço/raio/elevação |
| `Alert`/banner de página | não existe — cada tela improvisa (`bg-red-50 border-red-200 text-red-700` copiado à mão em vários arquivos) | criar, variantes: success/warning/danger/info |
| `Tabs` | não existe | criar sobre Radix Tabs |
| `Dropdown menu` | só o `UserDropdown` ad hoc | criar sobre Radix DropdownMenu, reutilizar em menus de linha de tabela |
| `EmptyState` | texto solto por página | criar: ícone + frase + ação |
| Tabela responsiva | 5 de 7 usos já envolvem em `overflow-x-auto`; 2 não (`XlsxImporter.tsx`, `BatchInviteClients.tsx`) | padronizar: toda tabela envolvida em contêiner com rolagem horizontal própria |

## Layout

**Container**: largura máxima de conteúdo 1200px, padding lateral 24px desktop / 16px mobile. Formulários com múltiplos campos usam grid de 2 colunas (nunca 3–4, que é o que quebra sem responsivo hoje), colapsando para 1 coluna abaixo de 768px. Espaço entre seções da página: 32px. Padding interno de card: 24px desktop / 16px mobile.

**Template — página de lista** (ex: Meus Clientes, Processos, Base de dados):
1. Cabeçalho — `BackButton` (só se aninhada) · Título H1 · ação primária à direita.
2. Barra de ferramentas — filtros e ações secundárias à esquerda, busca à direita.
3. Conteúdo — tabela (rolagem horizontal própria) ou grid de cards, paginação ao final.

**Template — página de detalhe** (ex: detalhe de processo, detalhe de produto):
1. Cabeçalho — `BackButton` · Título H1 + `StatusBadge` · ações no canto.
2. Corpo em duas colunas (conteúdo principal + painel lateral de resumo/contexto), empilhando em 1 coluna abaixo de 900px.

**Template — formulário**:
1. Cabeçalho — `BackButton` · Título H1.
2. Campos agrupados por seção (H2), grid de 2 colunas ≥768px.
3. Rodapé de ação — Cancelar (light) + Salvar (solid), fixo no rodapé em mobile.

## Navegação

Único componente `BackButton` substitui os 4 padrões hoje espalhados em ~15 lugares (`navigate(-1)` + seta · `navigate(rota fixa)` + seta · `<Link>` em texto puro · botão estilizado pro `/login`) — uma página (`MeetingRoomPage`) hoje usa dois padrões ao mesmo tempo.

Regra: toda tela alcançada por um fluxo (submissão de formulário, visualização de detalhe, modal de página inteira, estado de erro/vazio, wizard de múltiplos passos) precisa de uma saída explícita — nunca só o botão de voltar do navegador. Modais sempre têm Cancelar visível (não só clique-fora).

O piloto desta fundação resolve os 3 becos sem saída críticos mapeados na auditoria:
1. Callback de sucesso do DocuSign sem nenhum botão (`ContractPreviewCallback.tsx`).
2. Modal de convite em lote sem nenhum botão durante o processamento (`BatchInviteClients.tsx`).
3. `/advisor/dashboard` sem entrada em nenhuma navegação persistente.

## Estrutura no código

| Pasta | Conteúdo |
|---|---|
| `frontend/src/index.css` | tokens (`@theme`) — paleta, raio, sombra viram variáveis CSS/Tailwind |
| `frontend/src/components/ui/` | primitivos gerados via shadcn (button, dialog, badge, input, dropdown-menu, tabs, alert) — substitui os 6 arquivos que já existem aqui hoje |
| `frontend/src/components/patterns/` | composições próprias da plataforma: `BackButton`, `PageHeader`, `EmptyState`, `StatusBadge` — pasta nova |
| `frontend/src/lib/utils.ts` | `cn()` (clsx + tailwind-merge) — convenção padrão do shadcn, arquivo novo |

As pastas de página (`pages/admin`, `pages/consultant` etc.) não mudam de lugar — só passam a montar as telas com os blocos acima em vez de reimplementar botão/badge/modal à mão.

## Rollout

1. **Fundação** (este ciclo): tokens, `components/ui/` completo, `components/patterns/` completo, convenção de ícone aplicada nos componentes novos.
2. **Piloto** (este ciclo): fluxo "Meus Clientes" do Consultor (hoje sem nenhuma classe responsiva) + os 3 becos sem saída críticos listados em [Navegação](#navegação), reconstruídos com os componentes novos.
3. **Rollout do restante** (plano separado, fatiado por área): Admin, Specialist, Customer, Auth — cada fatia pequena o bastante pra revisar e testar sozinha.

Fora de escopo desta spec (viram backlog à parte, não uma spec de design): os bugs de fluxo de negócio (máquina de estados, DocuSign, Calendly, notificações) e as inconsistências pontuais de jornada (ex: consultor sem tela de comissão) mapeados na mesma auditoria.
