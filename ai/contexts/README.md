# Contexto para IA/Devs — High-Class Shop

_Última atualização: 09/05/2026_

Diretório de contexto consolidado. Atualizar sempre que houver mudança estrutural no projeto.

## Índice

| Arquivo | Conteúdo |
|---------|---------|
| [overview.md](overview.md) | Stack, estrutura do monorepo, roles, fluxo principal, setup |
| [api-endpoints.md](api-endpoints.md) | Todos os endpoints REST com método, rota, auth e descrição |
| [database.md](database.md) | Modelos Prisma, enumerações, comandos, regras de integridade |
| [integrations.md](integrations.md) | Calendly, DocuSign, AWS S3/SES, Google Drive, Meet/Jitsi |
| [env-vars.md](env-vars.md) | Todas as variáveis de ambiente com descrição e impacto |
| [known-issues.md](known-issues.md) | Bugs ativos e inconsistências documentadas |

## Quando atualizar

- **overview.md / api-endpoints.md:** Quando adicionar/remover rotas ou mudar stack
- **database.md:** Sempre que criar migrations
- **integrations.md:** Quando mudar fluxo de integração externa
- **env-vars.md:** Quando adicionar/remover variáveis de ambiente
- **known-issues.md:** Quando identificar ou resolver bugs

## Contexto legado

O diretório `ai/.context/` contém contexto histórico (pré-06/05/2026). Manter como referência, mas não atualizar mais.
