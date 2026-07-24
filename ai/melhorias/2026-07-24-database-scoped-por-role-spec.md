# Spec — Base de Dados (admin-database) filtrada por papel

- **Origem:** conversa 2026-07-24; complementa o item 5 de
  [`2026-07-20-comissoes-aninhadas-spec.md`](./2026-07-20-comissoes-aninhadas-spec.md)
  ("Base analítica... filtrada por papel"), que hoje só menciona
  especialista/escritório/ADMIN e só o recorte de `processes`. Este spec
  estende pro CONSULTOR e pra todo o browser genérico da Base de Dados
  (`admin-database`), não só `processes`.
- **Validado em:** 2026-07-24 (brainstorming ponto a ponto).
- **Status:** requisitos fechados; decisões de implementação marcadas pra fase de plano.

## 1. Contexto e objetivo

Hoje a tela "Base de Dados" (`/admin/database`, feature `admin-database` no
backend) é um browser genérico e paginado sobre 9 entidades (`users`,
`companies`, `cars`, `boats`, `aircrafts`, `processes`, `contracts`,
`proposals`, `appointments`), mas é **ADMIN-only** e faz `findMany` sem
nenhum filtro de linha (`admin-database.service.ts` — `where` nunca é
passado). Este spec define como abrir essa tela pra `OFFICE`, `CONSULTANT` e
`SPECIALIST`, mostrando pra cada um só o que é seu.

Não é arquitetura nova: o projeto já tem esse padrão de scoping por dono em
outros lugares —
`consultant.service.ts` filtra clientes por `consultant_id`;
`OfficeScopeGuard` + `office.service.ts` já fazem filtro aninhado via relação
Prisma (ex.: `where: { consultant: { company_id } } }`,
`where: { client: { consultant: { company_id } } } }`). Este trabalho é
reaproveitar esse padrão dentro do `admin-database`.

## 2. Matriz entidade × papel

| Entidade | OFFICE | CONSULTANT | SPECIALIST |
|---|---|---|---|
| users | `company_id = minha empresa` | `consultant_id = eu` (só meus clientes) | oculta |
| companies | só a própria empresa | oculta | oculta |
| cars / boats / aircrafts | `specialist.company_id = minha empresa` | oculta (não são donos de produto) | `specialist_id = eu` |
| processes | via processo ↔ empresa (ver §4) | `client.consultant_id = eu` | `specialist_id = eu` |
| contracts / proposals | via `process → ...` (mesma lógica de processes) | idem | idem |
| appointments | via processo ↔ empresa (ver §4) | `client.consultant_id = eu` | `specialist_id = eu` |

Regras derivadas:

- **ADMIN**: sem filtro — comportamento atual, intocado.
- **OFFICE**: usa `officeScope.companyId` (guard já existente).
- **CONSULTANT**: `consultant_id = self` direto em `users`; via relação
  `client.consultant_id = self` em tudo que pendura de `Process`.
- **SPECIALIST**: `specialist_id = self` direto em produtos e em
  `processes`; via relação `process.specialist_id = self` em
  contracts/proposals/appointments.
- Entidade sem filtro válido pro papel fica **oculta** da lista de tabs (não
  aparece em `listEntities()`) — não aparece vazia/bloqueada.

## 3. Telas e permissões

- Rota `/admin/database` deixa de ser ADMIN-only; sidebar ganha o item pra
  OFFICE/CONSULTANT/SPECIALIST.
- UI é a mesma tabela genérica pra todos os papéis — só muda quais tabs
  aparecem. Nenhuma tela sob medida por papel.
- Export CSV/PDF (já implementado em `012fa67`) continua igual — exporta só
  as linhas que o `where` já filtrou.
- **Headers de coluna traduzidos e amigáveis.** Hoje `DatabasePage.tsx` usa
  `Object.keys(rows[0])` direto como header (`company_id`, `consultant_id`,
  `created_at`...) — nomes de campo do Prisma, sem tradução. Isso muda pra
  **todos os papéis**, inclusive ADMIN (não vale manter dois modos de
  header), e vale também nos headers do export CSV/PDF (hoje usam a mesma
  lista crua de `columns`).

## 4. Impacto técnico / decisões pra fase de plano

- `admin-database.service.ts`: cada `EntityConfig` ganha uma função de escopo
  `(role, user, officeScope) => Prisma.WhereInput | null` (`null` = sem
  filtro, só ADMIN). Controller passa a aceitar
  `@Roles(ADMIN, OFFICE, CONSULTANT, SPECIALIST)` e o service recebe
  `req.user` + `officeScope`.
- **A decidir:** pra `processes`/`contracts`/`proposals`/`appointments` sob
  o papel OFFICE, o filtro é via `specialist.company_id` (o especialista é
  da empresa) ou via `client.consultant.company_id` (o cliente veio de um
  consultor da empresa)? As duas podem divergir — um processo pode ter
  especialista de uma empresa e cliente vindo de consultor de outra. Afeta
  as 4 entidades ligadas a `Process`.
- `listEntities()` passa a receber role/user pra montar a lista de tabs
  visíveis dinamicamente (hoje é uma lista estática).
- Reaproveitar o padrão de `where` aninhado já usado em `office.service.ts`
  — não inventar filtro novo.
- **Labels de coluna:** `EntityConfig` ganha um dicionário
  `columnLabels: Record<string, string>` (campo Prisma → rótulo em
  português). Campos repetidos entre entidades (`id`, `created_at`,
  `updated_at`, `company_id`, `consultant_id`, `specialist_id`, `status`...)
  usam um dicionário base compartilhado; campos específicos de cada entidade
  entram como override. `DatabasePage.tsx` usa o label na render do `<th>` e
  no header passado pro `downloadCsv`/export PDF, com fallback pro nome cru
  se o campo não estiver mapeado (evita quebrar se a whitelist ganhar campo
  novo sem o label ser atualizado junto). Lista exata campo→label é detalhe
  de implementação, fica pra fase de plano.

## 5. Relação com o spec de comissões (2026-07-20)

Esse trabalho substitui/detalha o item 5 daquele spec na parte "base
analítica filtrada por papel": aqui o escopo é o `admin-database` inteiro (9
entidades), não só `processes`, e inclui `CONSULTANT` (que o spec de 07-20
não cobria). Ao implementar, marcar o item 5 daquele spec apontando pra este
arquivo.

## 6. Fora de escopo / a decidir depois

- Regra exata de OFFICE em Process/Contract/Proposal/Appointment (via
  specialist ou via client→consultant) — ver §4.
- Auditoria/log de quem acessou o quê via essa tela (não pedido).
- Paginação/performance em tabelas grandes com filtro por relação aninhada
  (mesmo padrão de hoje, não é regressão introduzida por este spec).
