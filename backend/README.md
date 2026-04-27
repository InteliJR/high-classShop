# 🧠 Backend — High-class Shop

API principal da plataforma, construída com NestJS + Prisma, responsável por autenticação, processos, agendamentos, integração com Calendly, reuniões e contratos.

---

## 🚀 Stack

- Node.js 20+
- NestJS 11
- Prisma ORM
- PostgreSQL
- Axios, class-validator, class-transformer

---

## ⚙️ Configuração

```bash
cd backend
npm install
cp .env.example .env
```

### Variáveis importantes

- `DATABASE_URL`
- `DIRECT_URL` (necessária para operações de migration/Prisma em alguns ambientes)
- `FRONTEND_URL`
- `JWT_SECRET_ACCESS`, `JWT_SECRET_REFRESH`, `JWT_SECRET_REFERRAL`

### Documentação técnica detalhada

- Arquitetura do backend (módulos, responsabilidades, integrações, endpoints, payloads e respostas):
  - `../architecture.md`
- Mapa de integração do frontend com a API:
  - `../frontend-integration-guide.md`

### Variáveis de infraestrutura e integrações

- AWS/S3/SES:
  - `AWS_REGION`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_BUCKET_NAME`
  - `EMAIL_FROM`

- DocuSign:
  - `DOCUSIGN_INTEGRATION_KEY`
  - `DOCUSIGN_USER_ID`
  - `DOCUSIGN_ACCOUNT_ID`
  - `DOCUSIGN_PRIVATE_KEY`
  - `DOCUSIGN_ENV`
  - `DOCUSIGN_TEMPLATE_ID`
  - `DOCUSIGN_WEBHOOK_SECRET`

- Backend URL para callbacks:
  - `BACKEND_URL`

- Importação de imagens (Google Drive):
  - `GOOGLE_DRIVE_API_KEY`

- Reuniões:
  - `MEETING_PROVIDER`
  - `MEETING_DEMO_FALLBACK_ENABLED`
  - `JITSI_BASE_URL`
  - `GOOGLE_MEET_SERVICE_ACCOUNT_EMAIL`
  - `GOOGLE_MEET_SERVICE_ACCOUNT_PRIVATE_KEY`
  - `GOOGLE_MEET_CALENDAR_ID`
  - `GOOGLE_MEET_TIMEZONE`

### Variáveis de integração Calendly

- `CALENDLY_OAUTH_CLIENT_ID`
- `CALENDLY_OAUTH_CLIENT_SECRET`
- `CALENDLY_OAUTH_REDIRECT_URI`
- `CALENDLY_TOKEN_ENCRYPTION_KEY`
- `CALENDLY_WEBHOOK_CALLBACK_URL` (recomendado)
- `CALENDLY_WEBHOOK_SIGNING_KEY` (recomendado)

> Observação: `CALENDLY_ACCESS_TOKEN` pode existir como fallback simples, mas o fluxo recomendado no projeto atual é OAuth por especialista.

---

## 🛠️ Execução

```bash
# Desenvolvimento
npm run start:dev

# Build
npm run build

# Produção (após build)
npm run start:prod
```

API local: `http://localhost:3000/api`

---

## 🗃️ Banco de Dados

```bash
# Aplicar migrations
npx prisma migrate dev

# Abrir Prisma Studio
npx prisma studio

# Seed
npm run seed
```

---

## ✅ Testes e qualidade

```bash
# Testes unitários
npm run test

# Testes e2e
npm run test:e2e

# Cobertura
npm run test:cov

# Lint
npm run lint
```

---

## 📁 Estrutura resumida

```bash
backend/
├── prisma/              # Schema, migrations e scripts
├── src/
│   ├── auth/            # Autenticação/autorização
│   ├── features/        # Módulos de domínio
│   ├── prisma/          # Serviço Prisma
│   └── main.ts          # Bootstrap da aplicação
└── test/                # Testes e2e
```
