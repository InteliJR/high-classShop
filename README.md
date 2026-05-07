# 📘 High-class Shop

Plataforma web para gestão do processo comercial de produtos de alto padrão (carros, barcos e aeronaves), com fluxo completo de agendamento, negociação, documentação e fechamento.

---

## 📄 Documentação

A documentação funcional e técnica está disponível em:

**[High-class Shop Docs](https://intelijr.github.io/high-classShop/)**

> A documentação é mantida com Docusaurus. Veja o guia em `docs/README.md`.

Documentos técnicos versionados no repositório:

- `architecture.md` (arquitetura completa do backend, módulos, endpoints, payloads/respostas e integrações)
- `frontend-integration-guide.md` (integração frontend ↔ backend, endpoints consumidos e fluxo de autenticação)

**Contexto para IA e devs:** [`ai/contexts/`](ai/contexts/) — stack, endpoints, schema, integrações, variáveis de ambiente e bugs conhecidos.

**Planos de implementação:** [`ai/plan/`](ai/plan/) — planos detalhados por sprint/data.

---

## 🚀 Tecnologias Utilizadas

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** NestJS, TypeScript, Prisma ORM
- **Banco de Dados:** PostgreSQL
- **Infra local:** Docker Compose
- **Integrações:** Calendly (OAuth/Webhook), AWS (S3/SES), Google APIs (opcional)

---

## 🛠️ Como Rodar o Projeto

### Pré-requisitos

- [Git](https://git-scm.com/downloads)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js 20+](https://nodejs.org/en)

### Opção A — via Docker Compose (recomendada)

```bash
# 1) Clone o repositório
git clone https://github.com/InteliJR/high-classShop.git
cd high-classShop

# 2) Suba os serviços
docker compose up --build -d
```

### Opção B — desenvolvimento local (backend/frontend separados)

```bash
# 1) Banco via Docker
docker compose up -d db

# 2) Backend
cd backend
npm install
cp .env.example .env
# Ajuste DATABASE_URL e FRONTEND_URL conforme seu ambiente
npx prisma migrate dev
npm run start:dev

# 3) Frontend (novo terminal)
cd ../frontend
npm install
npm run dev
```

### Endpoints locais

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000/api`
- Prisma Studio (opcional): `cd backend && npx prisma studio`

### Variáveis críticas do backend

Além do `DATABASE_URL`, o projeto depende de variáveis importantes para integrações e segurança. Consulte `backend/.env.example` e ajuste especialmente:

- `FRONTEND_URL`, `BACKEND_URL`
- `JWT_SECRET_ACCESS`, `JWT_SECRET_REFRESH`, `JWT_SECRET_REFERRAL`
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET_NAME`, `EMAIL_FROM`
- `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_PRIVATE_KEY`, `DOCUSIGN_ENV`, `DOCUSIGN_WEBHOOK_SECRET`
- `GOOGLE_DRIVE_API_KEY`
- `MEETING_PROVIDER`, `MEETING_DEMO_FALLBACK_ENABLED`, `JITSI_BASE_URL`
- Calendly OAuth (quando habilitado): `CALENDLY_OAUTH_CLIENT_ID`, `CALENDLY_OAUTH_CLIENT_SECRET`, `CALENDLY_OAUTH_REDIRECT_URI`, `CALENDLY_TOKEN_ENCRYPTION_KEY`, `CALENDLY_WEBHOOK_CALLBACK_URL`, `CALENDLY_WEBHOOK_SIGNING_KEY`

---

## 📌 Comandos Úteis

```bash
# Subir tudo
docker compose up -d

# Derrubar tudo
docker compose down

# Logs do backend
docker compose logs -f backend

# Logs do frontend
docker compose logs -f frontend
```

---

## 🗂️ Estrutura de Diretórios

```bash
.
├── .github/           # Templates e automações
├── backend/           # API NestJS + Prisma
├── frontend/          # App React + Vite
├── docs/              # Documentação Docusaurus
├── ai/                # Contexto para IA/devs + planos de implementação
└── docker-compose.yml # Orquestração local
```

---

## 👥 Time do Projeto

Contribuidores principais no histórico do repositório:

- [Messias-Olivindo](https://github.com/Messias-Olivindo)
- [anacajp](https://github.com/anacajp)
- Davi Duarte
- Tainá Cortez
- Isabelly Maia

> Para lista completa de contribuidores: `git shortlog -sn --all`.
