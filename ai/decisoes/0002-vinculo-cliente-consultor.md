# ADR-0002: Vínculo cliente↔consultor via `User.consultant_id` (não via `CustomerAdvisor`)

**Data:** 2026-05-18
**Autor:** @Messias-Olivindo (Messias Olivindo)
**Status:** Aceito

## Contexto

Existem **duas formas** no schema para vincular um cliente (`User` com role `CUSTOMER`) a um consultor (`User` com role `CONSULTANT`):

1. **`User.consultant_id`** — campo auto-referencial em `User`, com `@relation("ClientToConsultant")`. Permite N clientes → 1 consultor.
2. **`CustomerAdvisor`** — tabela separada com `customer_id` (`@unique`), `advisor_id`, `email`, `token`, `accepted_at`. Modela um fluxo de convite por e-mail com aceite.

Cada uma surgiu em momento diferente da história do projeto, sem registro do porquê. As novas features TASK 2.6 (convite admin → consultor) e TASK 2.7 (convite consultor → cliente) precisam decidir **uma**, ou vão criar fluxos duplicados e estado inconsistente.

## Alternativas avaliadas

### Opção A — Usar `CustomerAdvisor` para todo vínculo (incluindo o feliz path sem convite)
- Prós: já tem token + accepted_at = serve direto para o fluxo de convite por e-mail.
- Contras:
  - `CustomerAdvisor.customer_id` é `@unique`: cada cliente só pode ter UM advisor. OK por enquanto, mas é uma restrição forte que pode atrapalhar transferências de carteira.
  - Cliente sem convite (cadastro direto, depois vinculado pelo admin) fica com `CustomerAdvisor` sem `token` real — vira gambiarra.
  - Mais um JOIN obrigatório em toda query que lista "clientes de um consultor".

### Opção B — Usar `User.consultant_id` para o vínculo + `CustomerAdvisor` só como tabela de convites pendentes
- Prós:
  - Vínculo permanente é simples: 1 FK em `User`.
  - Queries de "clientes do consultor X" viram `User.findMany({ where: { consultant_id: X } })`.
  - `CustomerAdvisor` continua existindo só para rastrear convites: ao aceitar, popular `User.consultant_id` e marcar `accepted_at`.
- Contras:
  - Dois lugares para sincronizar (mas com fluxo claro: o convite termina ao popular `consultant_id`).

### Opção C — Remover `CustomerAdvisor`, fluxo de convite só com JWT em URL (sem persistência)
- Prós: schema mais limpo.
- Contras:
  - Não dá visibilidade ao admin/consultor sobre convites pendentes.
  - Não permite revogar convite enviado.
  - Migration de dados existentes em `CustomerAdvisor` exigida.

## Decisão

**Opção B — `User.consultant_id` é a fonte de verdade para o vínculo. `CustomerAdvisor` permanece, mas com escopo reduzido: representa apenas convites em trânsito.**

Concretamente:
- Endpoint `POST /api/consultant/invite-client` (TASK 2.7) faz:
  1. Cria registro em `CustomerAdvisor` com `accepted_at = NULL` + token JWT.
  2. Envia e-mail.
- Endpoint `POST /api/auth/signup-client?token=...`:
  1. Valida token JWT.
  2. Cria `User` com `role: CUSTOMER` + `consultant_id` populado a partir do JWT.
  3. Atualiza o `CustomerAdvisor` correspondente, setando `accepted_at = now()`.
- Listagem de clientes do consultor (`GET /api/consultant/clients`) usa **`User.consultant_id`**, não `CustomerAdvisor`.
- Listagem de convites pendentes (futura, fora do escopo da sprint 29/05) usa `CustomerAdvisor` com `accepted_at IS NULL`.

## Consequências

### Positivas
- Fluxo de convite claro: `CustomerAdvisor` é "outbox" de convites; `User.consultant_id` é o estado final.
- Queries de clientes do consultor ficam triviais.
- Não obriga `CustomerAdvisor` para vínculos criados sem convite (ex.: admin atribui cliente a consultor manualmente).

### Negativas / Riscos
- Dois lugares com info parcial sobre o mesmo vínculo. Mitigação: comentário no schema + este ADR.
- `CustomerAdvisor.customer_id` é `@unique` — em UPSERT, um segundo convite ao mesmo cliente sobrescreve o anterior. Isso é OK (reinvite), mas precisa ser intencional no código.
- Eventual refactor para remover `CustomerAdvisor` quando houver feature de "histórico de convites" — deixa porta aberta.

### Tarefas afetadas
- TASK 2.6 (`ai/_private/plan/2026-05-18-deadline-29.md`): convite admin → consultor segue padrão similar (não usa `CustomerAdvisor`; cria User direto com role).
- TASK 2.7: usa o fluxo descrito acima.
- TASK 2.8: lista de clientes do consultor via `User.consultant_id`.

## Referências
- `backend/prisma/schema.prisma` — model `CustomerAdvisor` e `User.consultant_id`
- ADR relacionado: [0001](0001-consultor-igual-assessor.md) — sobre terminologia
