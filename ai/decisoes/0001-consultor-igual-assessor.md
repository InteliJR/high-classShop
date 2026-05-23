# ADR-0001: Consultor = Assessor (termo unificado)

**Data:** 2026-05-18
**Autor:** @Messias-Olivindo (Messias Olivindo)
**Status:** Aceito

## Contexto

No início do projeto, a equipe confundiu dois conceitos que o cliente usava de forma intercambiável: "Consultor" e "Assessor". Isso gerou rastros incoerentes no código e no schema:

- O enum `UserRole` no `backend/prisma/schema.prisma` tem `CONSULTANT` como role oficial.
- Existem **dois módulos backend** com nomes parecidos: `backend/src/features/consultants/` (admin CRUD) e `backend/src/features/consultant/` (área do próprio consultor — "advisor wallet").
- Existem **duas pastas frontend**: `frontend/src/pages/consultant/` e `frontend/src/pages/advisor/`.
- A tabela `CustomerAdvisor` no schema sugere um terceiro conceito, mas na verdade era para o mesmo papel.
- O documento de melhorias do cliente (`ai/_private/planejamento/Melhorias HighClassShop.md`) usa "assessor" o tempo todo.

Resultado: devs novos não sabem se "consultor" e "assessor" são roles distintos, dois módulos com mesma função, ou nomes diferentes da mesma coisa.

## Alternativas avaliadas

### Opção A — Manter como está, documentar a equivalência
- Prós: zero código mudado, deadline não impactado.
- Contras: dois nomes para a mesma coisa continua confundindo cliente, devs e IA. Cresce dívida técnica.

### Opção B — Renomear tudo para "Assessor" (`AdvisorRole`, `advisors/`, `pages/advisor/`)
- Prós: alinhamento com vocabulário do cliente.
- Contras: rename em cascata (schema, models, rotas, endpoints, frontend). Risco alto antes do deadline 29/05. Quebra clientes externos se existirem.

### Opção C — Adotar "Consultor" como termo oficial (technical + UI), manter ADR explicando
- Prós: já é o nome do enum/role (`CONSULTANT`). Mexer só na UI e documentação. Baixo risco.
- Contras: cliente continua falando "assessor" — devs precisam fazer tradução mental.

## Decisão

**Opção C — "Consultor" é o termo técnico oficial em todo lugar (schema, código, endpoints). "Assessor" é tratado como sinônimo apenas em conversas com o cliente.**

Concretamente:
- `UserRole.CONSULTANT` permanece.
- Módulos `consultants/` (admin) e `consultant/` (área pessoal) permanecem.
- Frontend: a pasta `pages/advisor/` será migrada/mesclada com `pages/consultant/` durante TASK 1.6 e TASK 2.8 do plano `ai/_private/plan/2026-05-18-deadline-29.md`.
- Onde aparece o texto "Assessor" para o usuário final (telas, e-mails), pode permanecer — é o vocabulário do cliente.
- A tabela `CustomerAdvisor` é considerada **legado paralelo**; a decisão sobre seu papel está no [ADR-0002](0002-vinculo-cliente-consultor.md).

## Consequências

### Positivas
- Documentação clara: dev novo lê este ADR e sabe que são sinônimos.
- Zero rename no schema/role/endpoints antes do deadline.
- IA tem âncora textual para resolver ambiguidade ("Consultor" = role; "Assessor" = label cliente).

### Negativas / Riscos
- Devs precisam fazer tradução mental em conversas com cliente.
- A pasta `pages/advisor/` ainda existe — risco de drift se ninguém merge.

### Tarefas afetadas
- TASK 1.6 (`ai/_private/plan/2026-05-18-deadline-29.md`): mapeia o que existe nos dois fluxos e propõe mesclagem.
- TASK 2.6 / 2.7 / 2.8: features novas usam `CONSULTANT` como role canônica.

## Referências
- `ai/_private/planejamento/Melhorias HighClassShop.md` — doc fonte com termo "assessor"
- `backend/prisma/schema.prisma` — `enum UserRole { CONSULTANT ... }`
- ADR relacionado: [0002](0002-vinculo-cliente-consultor.md) — sobre vínculo cliente↔consultor
