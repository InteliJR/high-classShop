# `ai/notas-tecnicas/` — Deep Dives Técnicos

Pasta para **estudos**, **comparativos** e **análises técnicas** que não cabem em um ADR e não são bem servidos por um README de contexto.

## Quando criar uma nota técnica

Sim:
- Comparativo de tecnologias antes de decidir (custo, performance, integração) — vira input para um ADR.
- Análise de impacto de uma mudança grande (ex.: "o que muda se trocarmos Provider X por Y").
- Runbook detalhado de uma operação não-trivial (ex.: passo-a-passo de migration em prod).
- Pesquisa de viabilidade pedida pelo cliente (SPIKE).

Não:
- Decisão tomada → vai para `ai/decisoes/` (ADR).
- Documentação de feature em andamento → vai para `ai/contexts/` ou no próprio PR.
- Anotação pessoal → vai para `ai/_private/<seu-username>/`.

## Formato

Arquivo: `AAAA-MM-tema.md`
- Data no início ajuda a ordenar cronologicamente.
- Tema em kebab-case.

Exemplo: `2026-05-jitsi-estudo.md`

Estrutura sugerida:

```markdown
# Tema (Estudo / Comparativo / Análise / Runbook)

**Data:** AAAA-MM-DD
**Autor:** @github-username
**Para:** ADR-NNNN | Decisão de cliente | Operação X
**Status:** Em andamento | Finalizado | Substituído por <link>

## Pergunta / Objetivo
<O que esta nota responde?>

## Resumo executivo (1 parágrafo)
<Resposta direta para quem só vai ler isso.>

## Detalhes
<Investigação, dados, tabelas, links.>

## Recomendação
<Se aplicável: o que sugerir como próximo passo.>

## Referências
- Links externos, ADRs, PRs
```

## Índice

| Arquivo | Tema | Status |
|---------|------|--------|
| _(em breve)_ `2026-05-jitsi-estudo.md` | Custos do Jitsi (self-hosted, JaaS enterprise) + impacto na plataforma (TASK 1.12) | Em andamento |
