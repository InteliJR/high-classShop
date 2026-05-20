# High-Class Shop — Visão Geral do Projeto

_Última atualização: 09/05/2026_

## O que é

Marketplace B2B de luxo para compra/venda de carros, embarcações e aeronaves. Conecta clientes com especialistas por meio de consultoria, negociação e assinatura digital de contratos.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS 4 |
| Backend | NestJS 11 + TypeScript |
| ORM | Prisma 6 |
| Banco | PostgreSQL 15 |
| Autenticação | JWT (access + refresh em HTTP-only cookie) |
| Upload de imagens | AWS S3 / Cloudflare R2 (compatível) |
| Email | AWS SES |
| Assinatura digital | DocuSign |
| Agendamento | Calendly (OAuth por especialista + webhook) |
| Reuniões | Google Meet (primário) ou Jitsi (fallback) |
| Drive import | Google Drive API |
| Containerização | Docker + docker-compose |

## Estrutura do Monorepo

```
high-classShop/
├── backend/          # NestJS API (porta 3000, prefix /api)
├── frontend/         # React/Vite (porta 5173)
├── docs/             # Docusaurus (documentação pública)
├── ai/
│   ├── contexts/     # Contexto consolidado para IA/devs
│   └── plan/         # Planos de implementação
├── docker-compose.yml
├── architecture.md   # Spec técnica detalhada (>1000 linhas)
└── README.md
```

## Roles de Usuário

| Role | Permissões |
|------|-----------|
| CUSTOMER | Navegar catálogo, iniciar processos, negociar, assinar contrato, convidar assessor pessoal |
| CONSULTANT | Gerenciar portfólio de clientes, enviar convites |
| SPECIALIST | Gerenciar produtos, confirmar agendamentos, propor termos, antecipar reuniões |
| ADMIN | Acesso total: config, usuários, empresas |

**Assessor:** qualquer usuário autenticado pode aceitar um convite de assessoria e acessar `/advisor/dashboard` para acompanhar processos de seus clientes. Não é um role separado — é uma relação `CustomerAdvisor`.

## Fluxo Principal do Processo Comercial

```
SCHEDULING → NEGOTIATION → PROCESSING_CONTRACT → DOCUMENTATION → COMPLETED
                                                                ↘ REJECTED (qualquer etapa)
```

## Setup Local

```bash
# Instalar dependências
npm run install:all

# Subir banco
docker-compose up db -d

# Rodar backend + frontend
npm run dev

# Migrations
cd backend && npx prisma migrate dev
```

## Deploy

- Backend: Railway (Dockerfile multi-stage)
- Frontend: Vercel (Vite build estático)
- Banco: PostgreSQL gerenciado (Railway ou supabase)
