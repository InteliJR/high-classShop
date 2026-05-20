# Glossário — High-Class Shop

Termos do domínio em ordem alfabética. Use este arquivo como referência rápida quando encontrar um termo desconhecido no código, nos documentos do cliente ou em conversas com a equipe.

---

### Admin
Usuário com `UserRole.ADMIN`. Gerencia escritórios, especialistas, consultores, configurações globais (`Settings`) e identidade visual. Não participa do fluxo de venda diretamente. Rota base: `/admin/dashboard`.

### Agendamento (Appointment)
Reunião marcada entre cliente e especialista para discutir um produto ou consultoria genérica. Pode vir de um link Calendly. Status: `PENDING` (cliente clicou, falta confirmação) → `SCHEDULED` → `COMPLETED` ou `CANCELLED`. Schema: model `Appointment`.

### Anúncio
Sinônimo informal usado pelo cliente para se referir a um produto cadastrado (`Car`, `Boat` ou `Aircraft`). A TASK 2.5 (`ai/_private/plan/2026-05-18-deadline-29.md`) introduz um **identificador único humano-legível por anúncio** (ex.: `CAR-00042-2026`).

### Assessor
**Sinônimo de Consultor** em conversas com o cliente. Vocabulário do cliente para o role `CONSULTANT`. Tecnicamente, no código, sempre use "consultor". Ver [ADR-0001](../decisoes/0001-consultor-igual-assessor.md).

### Beta Gate
Conjunto de critérios literais que definem "pronto para entrega". Cada critério é amarrado a uma TASK específica. Usado como Definition of Done macro de uma sprint/entrega. Ver seção "Beta Gate" em `ai/_private/plan/2026-05-18-deadline-29.md`.

### Calendly
Integração externa para agendamento. Cliente acessa link do Calendly do especialista, marca horário; webhook do Calendly notifica a plataforma; cria `Appointment`. Tokens armazenados criptografados em `CalendlyConnection`. Env vars: `CALENDLY_*`.

### Catálogo
Páginas públicas (após login) que listam Car/Boat/Aircraft. Rota: `/catalog/cars`, `/catalog/boats`, `/catalog/aircrafts`. Cliente entra por aqui após login.

### Cliente
Usuário com `UserRole.CUSTOMER`. Comprador final. Vê catálogo, agenda reuniões, faz propostas, assina contratos. Pode estar vinculado a um Consultor (via `User.consultant_id`). Rota base: `/catalog/cars`.

### Comissão
Percentual aplicado sobre `vehicle_price` no contrato, dividido entre Plataforma, Escritório e Especialista. Configurado em `Settings`, `Company.commission_rate`, `PlatformCompany.default_commission_rate` ou `User.commission_rate`.

### Consultor
Usuário com `UserRole.CONSULTANT`. Pertence a um Escritório (`Company`). Recebe convite do admin para se cadastrar. Pode convidar clientes (vínculo via `User.consultant_id`), criar/gerir processos em nome de cliente, acompanhar processos do cliente. Rota base: `/consultant/dashboard`. **Sinônimo: Assessor.**

### Contrato
Documento gerado a partir do template Docusign quando uma proposta é aceita. Pode ter dados pré-preenchidos via formulário (form-based) ou ser upload de PDF. Status: `PENDING` → `SIGNED` ou `REJECTED`. Schema: model `Contract`.

### CustomerAdvisor
Tabela separada que rastreia **convites de cliente para consultor** em trânsito. **NÃO é a fonte de verdade do vínculo** — apenas guarda o token JWT e `accepted_at`. Ao aceitar, o vínculo final fica em `User.consultant_id`. Ver [ADR-0002](../decisoes/0002-vinculo-cliente-consultor.md).

### Docusign
Integração externa para assinatura digital. Fluxo: cria envelope a partir de template → recebe webhook de status. Setup local exige JWT + chaves; Messias é a referência. Schema: `Contract.provider_*`. Env vars: `DOCUSIGN_*`.

### Escritório
Sinônimo informal de **Empresa parceira** (`Company`) onde o consultor trabalha. Tem CNPJ, comissão, e em breve logo + cores (TASK 2.1 / 2.2 do plano deadline). Especialista **não** pertence a escritório (ver TASK 2.10 e [ADR futuro] caso seja criado).

### Especialista
Usuário com `UserRole.SPECIALIST`. Cadastra e gerencia produtos da sua especialidade (`User.speciality: CAR | BOAT | AIRCRAFT`). Conduz reuniões com clientes (`Appointment.specialist_id`). Recebe comissão por venda. **Não pertence a escritório** (decisão do cliente). Rota base: `/specialist/dashboard`.

### Identidade Visual / White-label
Funcionalidade em desenvolvimento (TASK 2.1 + 2.2): cada `Company` define logo + cor primária + cor secundária. Quando consultor ou cliente da empresa Y loga, header e sidebar usam o branding da Y.

### Jitsi
Provedor de reunião sendo avaliado para substituir/complementar Google Meet. SPIKE TASK 1.12 do plano deadline produz documento com custos e impacto na arquitetura.

### Meeting / MeetingSession
Sessão de videoconferência criada na plataforma para um processo. Hoje usa Google Meet via conta única da plataforma. Tabela `MeetingSession` guarda `calendar_event_id` + `meet_link`.

### Negociação
Fase do processo (`ProcessStatus.NEGOTIATION`) onde cliente e especialista alternam propostas de valor. Mínimo: 80% do `Car/Boat/Aircraft.valor` (configurável via `Settings.minimum_proposal_percentage`). Schema: model `NegotiationProposal`.

### Plataforma (PlatformCompany)
Singleton que representa a empresa dona da plataforma. Usada para popular a seção "Dados da Plataforma" nos contratos. Recebe split 1 da comissão.

### Processo
Container do ciclo de venda. Liga cliente, especialista e produto. Estados: `SCHEDULING → NEGOTIATION → PROCESSING_CONTRACT → DOCUMENTATION → COMPLETED | REJECTED`. Schema: model `Process`.

### Proposta (NegotiationProposal)
Valor proposto durante fase de Negociação. Pode ser `PENDING`, `ACCEPTED`, `REJECTED`, `COUNTERED`. Quando aceita, processa avança para `PROCESSING_CONTRACT`.

### SES (AWS SES)
Provedor de e-mail. Todos os e-mails são fire-and-forget (`setImmediate`). Circuit breaker: 5 falhas em 60s desativa por 60s. Templates em `notification.service.ts`.

### Settings
Tabela key-value para configuração global da plataforma. Chaves importantes: `minimum_proposal_enabled`, `minimum_proposal_percentage`. Endpoint admin: `/api/settings`.

### Sprint
Bloco de tempo curto com escopo definido. No projeto atual (deadline 29/05): Sprint A (18–22/05, testes + bugfix), Sprint B (25–27/05, features), Pente fino (28–29/05).

### SPIKE
Task de investigação/pesquisa com entregável tipicamente um documento, não código. Ex.: TASK 1.12 — SPIKE Jitsi.

### Supabase
Provedor de Postgres usado em produção. CLAUDE.md alerta que o schema em prod tem drift vs migrations — usar `prisma db push` para mudanças aditivas, **nunca** `migrate deploy` sem verificação.
