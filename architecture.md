# Arquitetura do Backend — high-classShop

## 1) Visão geral

O backend é uma API NestJS com Prisma/PostgreSQL, organizada por módulos de domínio em `backend/src/features`, com autenticação JWT/cookies, autorização por roles e integrações externas para assinatura digital, agenda e comunicação.

- Runtime: Node.js + NestJS
- Persistência: Prisma Client + PostgreSQL
- Prefixo global de API: `/api`
- CORS com credenciais: habilitado
- Guardas globais: autenticação e roles
- Filtro global: tratamento de exceções Prisma

Arquivos principais:
- `backend/src/main.ts`
- `backend/src/app.module.ts`
- `backend/src/auth/auth.guard.ts`
- `backend/src/shared/guards/roles.guard.ts`
- `backend/src/shared/filters/prisma-exception.filter.ts`

---

## 2) Estrutura de pastas e responsabilidades

### `backend/src/auth`
Responsável por autenticação e sessão.
- Login, refresh, logout, registro e validação de token de convite.
- Guard JWT global e helpers para geração/validação de tokens.

### `backend/src/aws`
Serviços de infraestrutura AWS.
- `s3.service.ts`: upload e URL assinada de imagens.
- `ses.service.ts`: envio de e-mails transacionais.

### `backend/src/features`
Domínios de negócio da plataforma.
- `aircrafts`, `boats`, `cars`: CRUD de produtos, importação CSV e template.
- `appointments`: agenda, pendências e sincronização com Calendly.
- `companies`, `consultants`, `specialists`, `users`: gestão de atores.
- `consultant`: carteira do assessor e convite de clientes.
- `processes`: fluxo comercial (SCHEDULING → NEGOTIATION → ...).
- `proposals`: propostas e contrapropostas.
- `contracts`: pré-preenchimento, geração, preview e envio de contrato.
- `meetings`: sessão de reunião e transição de processo.
- `dashboard`, `settings`, `platform-company`, `drive-import`, `product-import-jobs`.

### `backend/src/providers`
Provedores externos encapsulados.
- `docusign`: client, service e webhook (com validação de assinatura).

### `backend/src/prisma`
Acesso a banco.
- `PrismaModule` + `PrismaService`.

### `backend/src/shared`
Cross-cutting concerns.
- decorators (`@Public`, `@Roles`), guards, filtros, DTOs utilitários e validadores.

### `backend/src/health`
Endpoints públicos de saúde da aplicação.

### `backend/prisma`
Schema, migrations e scripts de manutenção/seed.

---

## 3) Mapa de módulos (função de cada módulo)

- `AuthModule`: autenticação, sessão e identidade do usuário.
- `CarsModule`, `BoatsModule`, `AircraftsModule`: catálogo por categoria.
- `CompaniesModule`, `ConsultantsModule`, `SpecialistsModule`, `UsersModule`: gestão administrativa.
- `ConsultantModule`: gestão de clientes do assessor (invite/link).
- `ProcessesModule`: orquestra processo comercial e estados.
- `AppointmentsModule`: agendamentos e ciclo de sincronização com Calendly.
- `ProposalsModule`: negociação financeira.
- `ContractsModule`: pipeline de contrato com DocuSign.
- `MeetingsModule`: sala e encerramento de reunião.
- `DashboardModule`: indicadores operacionais.
- `SettingsModule`: parâmetros de negócio configuráveis.
- `PlatformCompanyModule`: dados da empresa da plataforma.
- `DriveImportModule`: ingestão de imagens do Google Drive.
- `ProductImportJobsModule`: jobs assíncronos de importação CSV.
- `DocusignModule`: integração de assinatura digital e webhook.
- `HealthModule`: healthcheck.
- `PrismaModule`: persistência.

---

## 4) Endpoints, payloads e respostas

> Prefixo global: todos os endpoints abaixo são servidos sob `/api`.

Formato usado nesta seção:

```json
payload:
{
  "id": "",
  "filters": ""
}

resposta:
{
  "id": "",
  "object": ""
}
```

## 4.1 Auth
Controller: `backend/src/auth/auth.controller.ts`

- `POST /auth/register`
  - payload:
```json
{
  "name": "",
  "surname": "",
  "email": "",
  "password": "",
  "role": "CUSTOMER"
}
```
  - resposta:
```json
{
  "success": true,
  "message": "",
  "data": {
    "user": {
      "id": "",
      "email": ""
    }
  }
}
```
- `POST /auth/validate-referral`
  - payload:
```json
{
  "token": ""
}
```
  - resposta:
```json
{
  "success": true,
  "data": {
    "inviter": {
      "id": "",
      "name": ""
    },
    "expiresAt": ""
  }
}
```
- `POST /auth/login`
  - payload:
```json
{
  "email": "",
  "password": ""
}
```
  - resposta:
```json
{
  "success": true,
  "data": {
    "access_token": "",
    "user": {
      "id": "",
      "role": ""
    }
  }
}
```
- `POST /auth/refresh`
  - payload:
```json
{}
```
  - resposta:
```json
{
  "success": true,
  "data": {
    "access_token": "",
    "user": {
      "id": ""
    }
  }
}
```
- `GET /auth/me`
  - payload:
```json
{}
```
  - resposta:
```json
{
  "id": "",
  "name": "",
  "email": "",
  "role": ""
}
```
- `POST /auth/logout`
  - payload:
```json
{}
```
  - resposta:
```json
{
  "success": true,
  "message": "Logout realizado"
}
```

## 4.2 Health
Controller: `backend/src/health/health.controller.ts`

- `GET /health`
  - payload:
```json
{}
```
  - resposta:
```json
{
  "status": "ok",
  "timestamp": "",
  "service": "highclass-backend",
  "environment": ""
}
```
- `GET /health/detailed`
  - payload:
```json
{}
```
  - resposta:
```json
{
  "status": "ok",
  "config": {
    "hasDatabase": true,
    "hasAwsConfig": true,
    "hasJwtSecrets": true,
    "hasDocuSign": true
  }
}
```

## 4.3 Products (cars, boats, aircrafts)
Controllers:
- `backend/src/features/cars/cars.controller.ts`
- `backend/src/features/boats/boats.controller.ts`
- `backend/src/features/aircrafts/aircrafts.controller.ts`

Cada domínio expõe:
- `POST /cars|boats|aircrafts`
  - payload:
```json
{
  "marca": "",
  "modelo": "",
  "valor": 0,
  "estado": "",
  "ano": 0,
  "specialist_id": "",
  "images": []
}
```
  - resposta:
```json
{
  "id": 0,
  "marca": "",
  "modelo": "",
  "images": []
}
```
- `POST /cars|boats|aircrafts/import-csv`
  - payload:
```json
{
  "file": "multipart/form-data"
}
```
  - resposta:
```json
{
  "jobId": "",
  "status": "PENDING"
}
```
- `GET /cars|boats|aircrafts/csv-template`
  - payload:
```json
{}
```
  - resposta:
```json
{
  "file": "template.csv"
}
```
- `GET /cars|boats|aircrafts`
  - payload:
```json
{
  "page": 1,
  "perPage": 20,
  "filters": {}
}
```
  - resposta:
```json
{
  "data": [],
  "meta": {
    "pagination": {},
    "filters": {}
  }
}
```
- `GET /cars|boats|aircrafts/:id`
  - payload:
```json
{
  "id": 0
}
```
  - resposta:
```json
{
  "id": 0,
  "marca": "",
  "modelo": "",
  "images": []
}
```
- `PATCH /cars|boats|aircrafts/:id`
  - payload:
```json
{
  "id": 0,
  "fields": {
    "valor": 0
  }
}
```
  - resposta:
```json
{
  "id": 0,
  "updated": true
}
```
- `DELETE /cars|boats|aircrafts/:id`
  - payload:
```json
{
  "id": 0
}
```
  - resposta:
```json
{
  "success": true,
  "message": "Removido"
}
```

## 4.4 Companies
Controller: `backend/src/features/companies/companies.controller.ts`

- `GET /companies`
  - payload:
```json
{}
```
  - resposta:
```json
[
  {
    "id": "",
    "name": "",
    "cnpj": ""
  }
]
```
- `POST /companies`
  - payload:
```json
{
  "name": "",
  "cnpj": "",
  "commission_rate": 0
}
```
  - resposta:
```json
{
  "id": "",
  "name": "",
  "cnpj": ""
}
```
- `GET /companies/:id/specialists`
  - payload:
```json
{
  "id": "",
  "page": 1,
  "perPage": 20
}
```
  - resposta:
```json
{
  "data": [],
  "pagination": {}
}
```
- `GET /companies/:id`
  - payload:
```json
{
  "id": ""
}
```
  - resposta:
```json
{
  "id": "",
  "name": "",
  "cnpj": ""
}
```
- `PUT /companies/:id`
  - payload:
```json
{
  "id": "",
  "fields": {}
}
```
  - resposta:
```json
{
  "id": "",
  "updated": true
}
```
- `DELETE /companies/:id`
  - payload:
```json
{
  "id": ""
}
```
  - resposta:
```json
{
  "success": true
}
```

## 4.5 Consultants / Consultant / Specialists / Users
Controllers:
- `backend/src/features/consultants/consultants.controller.ts`
- `backend/src/features/consultant/consultant.controller.ts`
- `backend/src/features/specialists/specialists.controller.ts`
- `backend/src/features/users/users.controller.ts`

### Consultants (cadastro)
- `GET /consultants`
```json
payload:
{}

resposta:
[
  { "id": "", "name": "", "email": "" }
]
```
- `POST /consultants` (payload create)
```json
payload:
{ "name": "", "surname": "", "email": "", "cpf": "", "rg": "" }

resposta:
{ "id": "", "name": "", "email": "" }
```
- `GET /consultants/:id`
```json
payload:
{ "id": "" }

resposta:
{ "id": "", "name": "", "email": "" }
```
- `PUT /consultants/:id` (payload update)
```json
payload:
{ "id": "", "fields": {} }

resposta:
{ "id": "", "updated": true }
```
- `DELETE /consultants/:id`
```json
payload:
{ "id": "" }

resposta:
{ "success": true }
```

### Consultant (carteira do assessor)
- `GET /consultant/clients`
- `POST /consultant/invite` (payload: `SendInvitationDto`)
- `PUT /consultant/clients/:id` (payload update de cliente)
- `DELETE /consultant/clients/:id`

```json
payload:
{ "id": "", "email": "" }

resposta:
{ "success": true, "data": {} }
```

### Specialists
- `GET /specialists`
- `GET /specialists/grouped-by-category`
- `POST /specialists`
- `GET /specialists/:id`
- `PUT /specialists/:id`
- `DELETE /specialists/:id`

```json
payload:
{ "id": "", "speciality": "CAR" }

resposta:
{ "id": "", "name": "", "speciality": "CAR" }
```

### Users
- `GET /users` (query `GetUsersDto`)
- `GET /users/:id`
- `PATCH /users/:id` (payload `UpdateUserDto`)

```json
payload:
{ "id": "", "role": "CUSTOMER", "page": 1, "perPage": 20 }

resposta:
{ "success": true, "data": [] }
```

## 4.6 Settings / Platform Company / Dashboard
Controllers:
- `backend/src/features/settings/settings.controller.ts`
- `backend/src/features/platform-company/platform-company.controller.ts`
- `backend/src/features/dashboard/dashboard.controller.ts`

### Settings
- `GET /settings`
- `GET /settings/:key`
- `PATCH /settings/:key` (payload `UpdateSettingDto`)

```json
payload:
{ "key": "minimum_proposal_enabled", "value": "true" }

resposta:
{ "success": true, "data": { "key": "", "value": "" } }
```

### Platform Company
- `GET /platform-company`
- `PUT /platform-company` (payload update)

```json
payload:
{ "name": "", "cnpj": "", "bank": "" }

resposta:
{ "id": "", "name": "", "cnpj": "" }
```

### Dashboard
- `GET /dashboard/stats`
- `GET /dashboard/specialist-stats/:specialistId`

```json
payload:
{ "specialistId": "" }

resposta:
{ "activeProcesses": 0, "conversionRate": 0 }
```

## 4.7 Processes
Controller: `backend/src/features/processes/processes.controller.ts`

- `POST /processes`
  - payload:
```json
{
  "client_id": "",
  "specialist_id": "",
  "product_type": "CAR",
  "product_id": 0
}
```
  - resposta:
```json
{
  "success": true,
  "data": {
    "id": "",
    "status": "SCHEDULING"
  }
}
```
- `GET /processes`
  - payload:
```json
{
  "page": 1,
  "perPage": 20,
  "filters": {}
}
```
  - resposta:
```json
{
  "success": true,
  "data": []
}
```
- `GET /processes/:id`
  - Resposta: processo detalhado
- `GET /processes/specialist/:specialistId`
  - Query: filtros opcionais (`status`, `search`, `sortBy`, `order`)
  - Resposta: processos do especialista
- `PATCH /processes/:id/status`
  - payload:
```json
{
  "id": "",
  "status": "NEGOTIATION",
  "notes": ""
}
```
  - resposta:
```json
{
  "success": true,
  "data": {
    "id": "",
    "status": "NEGOTIATION"
  }
}
```
- `PATCH /processes/:id/assign-product`
  - Payload: `AssignProductToProcessDto`
  - Resposta: processo com produto atribuído
- `GET /processes/:id/completion-reason`
  - Resposta: motivo de conclusão/rejeição
- `GET /processes/:id/with-contract`
  - Resposta: processo com contrato ativo/anexado
- `GET /processes/client/:clientId`
  - Query: paginação
  - Resposta: processos do cliente
- `PATCH /processes/:id/reject`
  - Payload: `RejectProcessDto`
  - Resposta: processo rejeitado
- `POST /processes/:id/confirm-appointment`
  - Payload: vazio
  - Resposta: transição de estado para negociação
- `POST /processes/:id/cancel-appointment`
  - Payload: vazio
  - Resposta: cancelamento com limpeza de vínculo de agenda/processo

## 4.8 Appointments + Calendly
Controllers:
- `backend/src/features/appointments/appointments.controller.ts`
- `backend/src/features/appointments/calendly.controller.ts`

### Appointments
- `GET /appointments/check`
  - payload:
```json
{
  "client_id": "",
  "specialist_id": "",
  "product_type": "CAR",
  "product_id": 0
}
```
  - resposta:
```json
{
  "success": true,
  "data": {
    "id": "",
    "status": "PENDING"
  }
}
```
- `GET /appointments`
  - Query: paginação
  - Resposta: lista de agendamentos do usuário
- `POST /appointments`
  - Payload: `CreateAppointmentDto`
  - Resposta: agendamento criado
- `GET /appointments/:id`
  - Resposta: detalhe do agendamento
- `PUT /appointments/:id/status`
  - Payload: `UpdateAppointmentStatusDto`
  - Resposta: status atualizado
- `POST /appointments/pending`
  - payload:
```json
{
  "client_id": "",
  "specialist_id": "",
  "product_type": "CAR",
  "product_id": 0,
  "notes": ""
}
```
  - resposta:
```json
{
  "success": true,
  "data": {
    "id": "",
    "status": "PENDING"
  }
}
```
- `GET /appointments/pending`
  - Query: paginação
  - Resposta: pendências do especialista
- `POST /appointments/pending/:id/confirm`
  - Payload: `{ appointment_datetime? }`
  - Resposta: pendência confirmada
- `POST /appointments/pending/:id/cancel`
  - Payload: vazio
  - Resposta: pendência cancelada
- `POST /appointments/pending/:id/calendly-scheduled`
  - Payload: `CalendlyScheduledDto`
  - Resposta: status de sync da agenda
- `GET /appointments/:id/calendly-sync-status`
  - Resposta: estado de sincronização com Calendly

### Calendly OAuth / Webhook
- `GET /appointments/calendly/oauth/authorize`
  - payload:
```json
{}
```
  - resposta:
```json
{
  "success": true,
  "data": {
    "authorize_url": ""
  }
}
```
- `GET /appointments/calendly/oauth/status`
  - Resposta: estado da conexão OAuth
- `POST /appointments/calendly/oauth/disconnect`
  - Resposta: confirmação de desconexão
- `GET /appointments/calendly/oauth/callback` (público)
  - Query: `code`, `state`
  - Resposta: redirecionamento para frontend com resultado
- `POST /appointments/calendly/webhook` (público)
  - payload:
```json
{
  "event": "invitee.created",
  "payload": {}
}
```
  - resposta:
```json
{
  "success": true,
  "message": "Webhook processado"
}
```

## 4.9 Proposals
Controller: `backend/src/features/proposals/proposals.controller.ts`

- `POST /proposals`
  - payload:
```json
{
  "process_id": "",
  "proposed_value": 0,
  "message": ""
}
```
  - resposta:
```json
{
  "success": true,
  "data": {
    "id": "",
    "status": "PENDING"
  }
}
```
- `GET /proposals/processes/:processId/proposals`
  - Resposta: lista de propostas + metadados de negociação
- `GET /proposals/:id`
  - Resposta: detalhe da proposta
- `PATCH /proposals/:id/accept`
  - Payload: `RespondProposalDto`
  - Resposta: proposta aceita e efeitos no processo
- `PATCH /proposals/:id/reject`
  - Payload: `RespondProposalDto`
  - Resposta: proposta rejeitada

## 4.10 Contracts + DocuSign
Controllers:
- `backend/src/features/contracts/contracts.controller.ts`
- `backend/src/providers/docusign/webhook/webhook.controller.ts`
- `backend/src/providers/docusign/docusign-test.controller.ts`

### Contracts
- `GET /contracts/prefill/:processId`
  - payload:
```json
{
  "processId": ""
}
```
  - resposta:
```json
{
  "success": true,
  "data": {
    "process_id": "",
    "buyer": {},
    "seller": {},
    "product": {}
  }
}
```
- `POST /contracts/generate`
  - payload:
```json
{
  "process_id": "",
  "buyer_name": "",
  "seller_name": "",
  "vehicle_model": ""
}
```
  - resposta:
```json
{
  "success": true,
  "data": {
    "id": "",
    "process_id": "",
    "status": "PENDING"
  }
}
```
- `POST /contracts/preview`
  - Payload: `PreviewContractDto` (inclui `return_url`)
  - Resposta: `preview_url`, `envelope_id`, `expires_at`
- `POST /contracts/send/:envelopeId`
  - Payload: `PreviewContractDto` (dados do formulário)
  - Resposta: contrato enviado/registrado
- `POST /contracts/cancel-preview/:envelopeId`
  - Payload: vazio
  - Resposta: confirmação de cancelamento

### Webhook DocuSign
- `POST /docusign/webhook` (público)
  - payload:
```json
{
  "event": "envelope-completed",
  "data": {}
}
```
  - resposta:
```json
{
  "success": true,
  "message": "Evento recebido"
}
```

### Endpoint de teste
- `POST /test/envelope`
  - payload:
```json
{
  "process_id": "",
  "email": ""
}
```
  - resposta:
```json
{
  "success": true,
  "data": {}
}
```

## 4.11 Drive Import e Product Import Jobs
Controllers:
- `backend/src/features/drive-import/drive-import.controller.ts`
- `backend/src/features/product-import-jobs/product-import-jobs.controller.ts`

- `POST /drive-import/images`
  - payload:
```json
{
  "folder_url": "",
  "product_type": "CAR"
}
```
  - resposta:
```json
{
  "success": true,
  "data": {
    "imported": 0,
    "errors": []
  }
}
```
- `GET /product-import-jobs/:jobId`
  - payload:
```json
{
  "jobId": ""
}
```
  - resposta:
```json
{
  "jobId": "",
  "status": "PROCESSING",
  "done": false,
  "result": {}
}
```

## 4.12 Meetings
Controller: `backend/src/features/meetings/meetings.controller.ts`

- `GET /meetings/process/:processId`
  - payload:
```json
{
  "processId": ""
}
```
  - resposta:
```json
{
  "success": true,
  "data": {
    "id": "",
    "meet_link": "",
    "is_active": true
  }
}
```
- `POST /meetings/process/:processId/start`
  - payload:
```json
{
  "context": ""
}
```
  - resposta:
```json
{
  "success": true,
  "data": {
    "id": "",
    "meet_link": ""
  }
}
```
- `POST /meetings/process/:processId/end`
  - Payload: opcional
  - Resposta: sessão encerrada
- `POST /meetings/process/:processId/conversation-done`
  - Payload: opcional
  - Resposta: fechamento de conversa + transição do processo

---

## 5) Integrações externas e fluxos

## 5.1 AWS S3
- Entrada: criação/edição de produtos, importação de imagens.
- Fluxo: imagem (base64/url/buffer) → upload S3 → persistência de URL em tabela de imagens.
- Serviço: `backend/src/aws/s3.service.ts`.

## 5.2 AWS SES
- Entrada: convite de clientes e notificações transacionais.
- Fluxo: evento de domínio (ex.: invitation, proposal update) → template de e-mail → envio SES.
- Serviços: `backend/src/aws/ses.service.ts`, `backend/src/features/notifications/notification.service.ts`.

## 5.3 Calendly (OAuth + webhook)
- OAuth: especialista conecta conta via authorize/callback; tokens ficam associados e protegidos.
- Webhook: eventos de agendamento/cancelamento atualizam `appointments`.
- Serviços: `calendly-integration.service.ts`, `calendly.controller.ts`.

## 5.4 Google Meet/Calendar (+ fallback)
- Em `meetings/start`, o sistema tenta criar evento com link de videoconferência.
- Pode usar fallback por configuração (`Jitsi`/demo) quando necessário.
- Serviço: `backend/src/features/meetings/meetings.service.ts`.

## 5.5 DocuSign
- Contrato é gerado e preparado para sender view (`preview`).
- Envio final dispara ciclo de assinatura.
- Webhook DocuSign sincroniza status de envelope para contrato/processo local.
- Serviços: `providers/docusign/*`.

## 5.6 Google Drive Import
- Lista e baixa arquivos de pasta pública, faz upload para S3 e vincula ao produto correspondente.
- Serviço: `backend/src/features/drive-import/drive-import.service.ts`.

---

## 6) Observações técnicas relevantes (auditoria)

1. O frontend atualmente possui chamadas para endpoints que não existem no `ContractsController` (`GET /contracts`, `GET /contracts/:id`).
2. Há inconsistência de rota de aeronaves no frontend em alguns pontos (`/aircraft` vs `/aircrafts`).
3. O backend usa respostas com formatos diferentes em alguns módulos (`success` e `sucess`), o que exige normalização.
4. Existe acoplamento operacional forte em variáveis de ambiente para integrações (JWT, AWS, DocuSign, Calendly, Google), devendo ser gerenciadas por ambiente.

---

## 7) Referências de código

- Composição de módulos: `backend/src/app.module.ts`
- Bootstrap e middleware globais: `backend/src/main.ts`
- Controllers de domínio: `backend/src/features/**/**.controller.ts`
- DTOs: `backend/src/features/**/dto/*` e `backend/src/auth/dto/*`
- Prisma schema: `backend/prisma/schema.prisma`
