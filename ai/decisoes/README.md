# `ai/decisoes/` — Architecture Decision Records (ADRs)

Cada decisão arquitetural não-trivial é registrada em um arquivo `NNNN-titulo-curto.md`. Esta pasta é a memória de **por que** o projeto está do jeito que está.

## Quando escrever um ADR

Sim, escreva:
- Trocar uma biblioteca/abordagem central (autenticação, ORM, fila de jobs)
- Decisão de modelo de dados que afeta múltiplos módulos (Int → UUID, multi-tenancy)
- Escolha entre duas integrações comparáveis (Jitsi vs Daily; SES vs SendGrid)
- Resolver ambiguidade conceitual que pode confundir (consultor = assessor)
- Adiar uma mudança grande com data-alvo (refactor pós-deadline)

Não, não escreva:
- Bug fix simples (vai no commit)
- Mudança de UI sem trade-off real
- Decisão revertida em <24h (vira ruído)

## Formato

Arquivo: `NNNN-titulo-curto.md`
- `NNNN` = número sequencial 4 dígitos (`0001`, `0002`, ...)
- `titulo-curto` = 2–5 palavras em kebab-case (`consultor-igual-assessor`)

Template do corpo:

```markdown
# ADR-NNNN: Título da Decisão

**Data:** AAAA-MM-DD
**Autor:** @github-username (Nome real)
**Status:** Proposto | Aceito | Substituído por ADR-XXXX | Depreciado

## Contexto
<Por que essa decisão precisou ser tomada?>

## Alternativas avaliadas

### Opção A — <nome>
- Prós: ...
- Contras: ...

### Opção B — <nome>
- Prós: ...
- Contras: ...

## Decisão
<Qual opção foi escolhida e por quê.>

## Consequências

### Positivas
- ...

### Negativas / Riscos
- ...

### Tarefas afetadas
- TASK X.Y: ...

## Referências
- Link para feedback, PR, ADRs relacionados
```

## Status

| Status | Significado |
|--------|-------------|
| `Proposto` | Em discussão. Não decidido ainda. |
| `Aceito` | Aprovado. Implementação em curso ou concluída. |
| `Substituído por ADR-XXXX` | Revogado ou refinado. Linkar o novo. |
| `Depreciado` | Não vale mais, mantido por histórico. |

ADRs **nunca são deletados** — apenas marcados.

## Índice

| # | Título | Status | Data |
|---|--------|--------|------|
| [0001](0001-consultor-igual-assessor.md) | Consultor = Assessor (termo unificado) | Aceito | 2026-05-18 |
| [0002](0002-vinculo-cliente-consultor.md) | Vínculo cliente↔consultor: `User.consultant_id` vs `CustomerAdvisor` | Aceito | 2026-05-18 |
| [0003](0003-uuid-migration.md) | Migrar PKs `Car/Boat/Aircraft` e dependentes para UUID | Proposto | 2026-05-18 |
