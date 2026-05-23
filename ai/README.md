# `ai/` — Contexto de IA e Devs

Pasta dedicada a documentação operacional, planos, decisões e contexto técnico do projeto **high-classShop**. Otimizada para uso por assistentes de IA (Claude Code, Cursor, Copilot) e por devs novos no projeto.

## Estrutura

```
ai/
├── README.md                       # este arquivo
├── .gitignore                      # ignora _private/* (exceto README)
│
├── _private/                       # IGNORADO · conteúdo sensível e áreas pessoais
│   ├── README.md                   # versionado · explica o que vai aqui
│   ├── plan/                       # ignorado · planos de sprint/entrega
│   │   ├── 2026-05-10-fix.md
│   │   ├── 2026-05-18-deadline-29.md   # sprint corrente
│   │   ├── 2026-06-pos-deadline-uuid-migration.md
│   │   └── fix.md
│   └── planejamento/               # ignorado · entradas de planejamento (input do cliente)
│       └── Melhorias HighClassShop.md
│
├── contexts/                       # versionado · contexto técnico vivo
│   ├── README.md                   # índice
│   ├── overview.md                 # stack, monorepo, roles, fluxo, setup
│   ├── api-endpoints.md            # rotas REST com método, auth, descrição
│   ├── database.md                 # modelos Prisma, enums, comandos
│   ├── integrations.md             # Calendly, DocuSign, AWS, Google
│   ├── env-vars.md                 # todas as variáveis com descrição
│   └── known-issues.md             # bugs ativos + inconsistências documentadas
│
├── instrucoes/                     # versionado · domínio
│   └── glossario.md                # termos do domínio (consultor, especialista, etc.)
│
├── decisoes/                       # versionado · ADRs (Architecture Decision Records)
│   ├── README.md                   # formato + índice
│   └── NNNN-titulo.md              # uma decisão por arquivo
│
├── notas-tecnicas/                 # versionado · deep dives opcionais
│   └── README.md                   # quando criar uma nota técnica
│
└── data/                           # versionado · CSVs e dados de referência
    ├── kanban-create-log-2026-05-18.csv
    └── template_carros (1).csv
```

## Como usar — humano

1. Leia `contexts/overview.md` para entender o projeto em 5 min.
2. Para entender domínio (assessor ≠ consultor, escritório, especialista...): `instrucoes/glossario.md`.
3. Para entender por que algo está escrito de determinado jeito: `decisoes/`.
4. Para acompanhar a sprint atual: `_private/plan/` (conteúdo não versionado — sincronizar com squad via Drive/Discord).
5. Para reportar bug conhecido: `contexts/known-issues.md`.

## Como usar — IA

A raiz do projeto tem um `CLAUDE.md` que aponta para esta pasta. Ao ser invocado, o agente deve:
1. Ler `CLAUDE.md` primeiro.
2. Consultar `ai/contexts/` para detalhes técnicos.
3. Consultar `ai/decisoes/` antes de propor mudanças arquiteturais.
4. Consultar `ai/_private/plan/<arquivo-mais-recente>` para ver tarefas em andamento (conteúdo local; baixar via Drive/Discord se ausente).

## Por que ADRs em arquivos separados

- **Zero conflito de merge:** cada decisão é um arquivo novo.
- **Histórico vivo:** dev novo lê em ordem e entende as escolhas.
- **Não esquece o porquê:** seis meses depois, ninguém precisa adivinhar.

ADRs **nunca são deletados** — apenas marcados como `Substituído` ou `Depreciado`.

## Área pessoal de cada dev

Cada dev pode criar `_private/<seu-username>/` para anotações pessoais, rascunhos e templates. Esse conteúdo é ignorado pelo Git (regra em `.gitignore`).

## Manutenção

- `contexts/` é atualizado a cada mudança estrutural relevante.
- `decisoes/` recebe ADR sempre que uma decisão não-trivial for tomada.
- `_private/plan/` arquiva planos antigos; só o mais recente é "vivo". **Não versionado** — sincronizar via Drive/Discord.
- `_private/planejamento/` recebe inputs brutos (anotações do cliente, brainstorm). **Não versionado.**

## Diretório legado

`ai/contexts/.context/` (se existir) contém contexto histórico pré-06/05/2026. Manter como referência, não atualizar.
