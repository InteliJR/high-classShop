# Schema do Banco de Dados — High-Class Shop

_ORM: Prisma 6 | Banco: PostgreSQL 15_
_Última atualização: 09/05/2026_
_Schema completo: `backend/prisma/schema.prisma`_

## Modelos Principais

### User
Entidade central. Todos os roles usam o mesmo modelo.

Campos relevantes: `id` (UUID), `name`, `surname`, `email` (único), `cpf` (único, 11 dígitos), `rg` (único, VarChar(10)), `password_hash` (bcrypt), `role` (enum), `civil_state`, `speciality`, `bank`, `agency`, `checking_account`, `calendly_url`, `calendly_organization_uri`

Relações adicionadas (09/05/2026): `advisorRelation CustomerAdvisor? @relation("CustomerAdvisors")` e `advisorOf CustomerAdvisor[] @relation("AdvisorOf")`.

### Produto (Car, Boat, Aircraft)
Três tabelas separadas com estrutura similar.

- `Car`: marca, modelo, valor, estado, ano, cor, km, cambio, combustivel, tipo_categoria, specialist_id
- `Boat`: + tipo_embarcacao, tamanho, motor, fabricante, estilo
- `Aircraft`: + tipo_aeronave, fabricante, assentos, categoria

Cada um tem tabela de imagens separada (`Car_image`, `Boat_image`, `Aircraft_image`) com `image_url` (key S3) e `is_primary`.

### Process
Entidade central do fluxo comercial.

Campos: `id`, `status` (enum ProcessStatus), `client_id`, `specialist_id`, `product_id`, `product_type`, `completion_reason`, `rejected_at`, `completed_at`

### Appointment
Agendamento vinculado a um processo.

Campos: `id`, `process_id`, `client_id`, `specialist_id`, `status` (StatusAgendamento), `appointment_datetime`, `notes`, `calendly_event_uri`, `calendly_invitee_uri`, `calendly_sync_status`, `client_observed_at`

### CalendlyConnection
Conexão OAuth por especialista (tokens criptografados AES-256-GCM).

Campos: `id`, `user_id`, `access_token` (encrypted), `refresh_token` (encrypted), `token_expires_at`, `calendly_user_uri`, `organization_uri`, `connected_at`

### NegotiationProposal
Proposta financeira no processo.

Campos: `id`, `process_id`, `proposer_id`, `proposed_price`, `status` (ProposalStatus), `message`, `parent_proposal_id` (para contraproposta)

### Contract
Contrato DocuSign.

Campos: `id`, `process_id`, `envelope_id`, `status` (ContractStatus), `template_id`, `prefilled_data` (JSON), `sent_at`, `signed_at`

### MeetingSession
Sessão de reunião por processo.

Campos: `id`, `process_id`, `provider` (JITSI/GOOGLE), `room_url`, `started_at`, `ended_at`, `is_active`

### ProductImportJob
Job assíncrono de importação CSV.

Campos: `id`, `status` (PENDING/PROCESSING/COMPLETED/FAILED), `product_type`, `total_rows`, `processed_rows`, `errors` (JSON), `created_by_id`

### CustomerAdvisor _(adicionado 09/05/2026)_
Convite de assessor pessoal por cliente.

Campos: `id` (UUID), `customer_id` (único, FK User), `advisor_id` (FK User, null até aceitar), `email` (e-mail convidado), `token` (JWT único, 7d), `accepted_at` (null até aceite), `created_at`

Constraint: `customer_id` é `@unique` — cada cliente tem no máximo um assessor/convite ativo.

## Enumerações Principais

```
UserRole: CUSTOMER | CONSULTANT | SPECIALIST | ADMIN
ProcessStatus: SCHEDULING | NEGOTIATION | PROCESSING_CONTRACT | DOCUMENTATION | COMPLETED | REJECTED
StatusAgendamento: PENDING | SCHEDULED | COMPLETED | CANCELLED
ContractStatus: PENDING | REJECTED | SIGNED
ProposalStatus: PENDING | ACCEPTED | REJECTED | COUNTERED
CalendlySyncStatus: PENDING | SYNCED | FAILED
ProductType: CAR | BOAT | AIRCRAFT
```

## Comandos Prisma

```bash
cd backend

# Criar migration após mudar schema
npx prisma migrate dev --name nome_da_migration

# Aplicar em produção
npx prisma migrate deploy

# Resetar banco local (DESTRUTIVO)
npx prisma migrate reset

# Abrir Prisma Studio
npx prisma studio

# Regenerar client
npx prisma generate
```

## Regras de Integridade

- Toda migration deve ser aditiva quando possível (nunca DROP em produção sem plano de rollback)
- Mudanças em campos com `@unique` requerem migration cuidadosa (dados existentes)
- `rg` e `cpf` são únicos — cuidado ao relaxar validações sem verificar duplicatas no banco
- Banco está à frente do histórico de migrations (drift de colunas existentes); usar `prisma db push` para aditivos sem reset
