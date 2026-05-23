# API Endpoints — High-Class Shop

_Prefix: `/api`_
_Última atualização: 09/05/2026_

## Autenticação

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | /auth/register | público | Cadastro de usuário |
| POST | /auth/login | público | Login (rate limit: 5/15min) |
| POST | /auth/validate-referral | público | Valida token de convite de consultor |
| GET | /auth/refresh | público | Renova access token via cookie |
| GET | /auth/me | JWT | Perfil do usuário logado |
| PATCH | /auth/change-password | JWT | Alterar senha |
| POST | /auth/logout | JWT | Logout |
| POST | /auth/accept-advisor-invite | JWT | Aceitar convite de assessor (token no body) |

## Produtos (Cars / Boats / Aircrafts)

Mesmo padrão para as 3 rotas: `/cars`, `/boats`, `/aircrafts`

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | /{tipo} | SPECIALIST/ADMIN | Criar produto |
| GET | /{tipo} | JWT | Listar com filtros + paginação |
| GET | /{tipo}/:id | JWT | Detalhe do produto |
| PATCH | /{tipo}/:id | SPECIALIST/ADMIN | Atualizar produto |
| DELETE | /{tipo}/:id | SPECIALIST/ADMIN | Remover produto |
| POST | /{tipo}/import-csv | SPECIALIST/ADMIN | Importar em lote (async) |
| GET | /{tipo}/csv-template | JWT | Baixar template CSV |

## Agendamentos

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | /appointments | JWT | Criar agendamento |
| GET | /appointments | JWT | Listar |
| GET | /appointments/:id | JWT | Detalhe |
| PUT | /appointments/:id/status | JWT | Atualizar status |
| GET | /appointments/check | JWT | Verificar existente |
| POST | /appointments/pending | JWT | Criar pendente |
| GET | /appointments/pending | JWT | Listar pendentes |
| POST | /appointments/pending/:id/confirm | JWT | Confirmar |
| POST | /appointments/pending/:id/cancel | JWT | Cancelar |
| POST | /appointments/pending/:id/calendly-scheduled | JWT | Marcar synced |
| GET | /appointments/:id/calendly-sync-status | JWT | Status sync |
| GET | /appointments/calendly/oauth/authorize | JWT | Iniciar OAuth |
| GET | /appointments/calendly/oauth/status | JWT | Status da conexão |
| POST | /appointments/calendly/oauth/disconnect | JWT | Revogar OAuth |
| GET | /appointments/calendly/oauth/callback | público | Callback OAuth |
| POST | /appointments/calendly/webhook | público | Webhook Calendly |

## Processos

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | /processes | JWT | Criar processo |
| GET | /processes | JWT | Listar |
| GET | /processes/:id | JWT | Detalhe |
| GET | /processes/specialist/:specialistId | JWT | Processos do especialista |
| GET | /processes/client/:clientId | JWT | Processos do cliente |
| PATCH | /processes/:id/status | JWT | Mudar status |
| PATCH | /processes/:id/assign-product | JWT | Vincular produto |
| PATCH | /processes/:id/reject | JWT | Rejeitar com motivo |
| POST | /processes/:id/confirm-appointment | JWT | Avançar de SCHEDULING |
| POST | /processes/:id/cancel-appointment | JWT | Cancelar agendamento |
| GET | /processes/:id/completion-reason | JWT | Motivo de conclusão |

## Propostas

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | /proposals | JWT | Criar proposta |
| GET | /proposals/processes/:processId/proposals | JWT | Propostas do processo |
| GET | /proposals/:id | JWT | Detalhe |
| PATCH | /proposals/:id/accept | JWT | Aceitar (avança para PROCESSING_CONTRACT) |
| PATCH | /proposals/:id/reject | JWT | Rejeitar |

## Contratos

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | /contracts/prefill/:processId | JWT | Pré-preencher dados |
| POST | /contracts/generate | JWT | Criar envelope DocuSign |
| POST | /contracts/preview | JWT | Preview com sender view |
| POST | /contracts/send/:envelopeId | JWT | Finalizar envio |
| POST | /contracts/cancel-preview/:envelopeId | JWT | Cancelar preview |
| POST | /docusign/webhook | público | Webhook DocuSign |

## Reuniões

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | /meetings/process/:processId | JWT | Sessão de reunião |
| POST | /meetings/process/:processId/start | JWT | Iniciar sala |
| POST | /meetings/process/:processId/end | JWT | Encerrar sessão |
| POST | /meetings/process/:processId/conversation-done | JWT | Avançar processo |

## Admin / Usuários

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | /users | ADMIN | Listar usuários |
| GET | /users/:id | JWT | Perfil do usuário |
| PATCH | /users/:id | JWT | Atualizar perfil |
| GET | /consultants | JWT | Listar consultores |
| GET | /specialists | JWT | Listar especialistas |
| GET | /companies | JWT | Listar empresas |
| GET | /dashboard/stats | ADMIN | Métricas gerais |
| GET | /settings | ADMIN | Configurações |
| PATCH | /settings/:key | ADMIN | Atualizar config |

## Assessores (CustomerAdvisor)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | /customers/me/invite-advisor | CUSTOMER | Convidar assessor por e-mail |
| GET | /customers/me/advisor | CUSTOMER | Ver assessor atual (aceito ou pendente) |
| DELETE | /customers/me/advisor | CUSTOMER | Remover assessor / cancelar convite |
| GET | /advisors/me/clients | JWT | Listar clientes que o usuário assessora |

## Outros

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | /health | público | Health check |
| POST | /drive-import/images | SPECIALIST/ADMIN | Importar do Google Drive |
| GET | /product-import-jobs/:jobId | JWT | Status do job de importação |
| GET | /platform-company | JWT | Dados da empresa |
| PUT | /platform-company | ADMIN | Atualizar dados |

## Observações

- Resposta de erro usa chave `"sucess"` (typo no código — não corrigir sem migração de clientes)
- Rotas de contrato `GET /contracts` e `GET /contracts/:id` existem no frontend mas NÃO no backend (bug documentado)
- Nomenclatura `/aircraft` vs `/aircrafts` inconsistente em partes do código
