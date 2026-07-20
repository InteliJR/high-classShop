# Migração para produção — integrações e infraestrutura

> Guia técnico interno. Base para o PDF objetivo enviado ao time de DevOps
> (`2026-07-20-integracoes-checklist-devops.pdf`, mesma pasta).

## Por que este documento existe

Hoje o backend aponta para um Supabase tratado pelo time como **ambiente de
demonstração** (ver decisão registrada em memória do projeto, 2026-07-20) e
várias integrações (DocuSign, Google OAuth) estão configuradas em modo
sandbox/teste. Colocar a plataforma "no ar de vdd" não é só trocar
`NODE_ENV` — cada integração externa tem um passo de promoção
sandbox → produção que precisa ser feito manualmente, fora do deploy.

## Infraestrutura de deploy (já existe, não precisa recriar)

| Camada | Onde | Config |
|---|---|---|
| Backend | **Railway** (único real — ver nota abaixo) | `backend/railway.toml`, build via `backend/Dockerfile`, Root Directory = `backend` no dashboard |
| Frontend | **Vercel** | `frontend/vercel.json` (rewrite SPA) |
| Banco | PostgreSQL (hoje Supabase, tratado como demo) | Prisma — `DATABASE_URL` / `DIRECT_URL` |

⚠️ **Vercel também mostra um deploy "backend" nos checks do PR — isso não é
real, ignorar.** Só existe deploy de backend no Railway.

⚠️ **Migrations não rodam automaticamente no deploy do Railway** (o
Dockerfile só faz `prisma generate` + build). Aplicar schema manualmente:
- Banco novo de produção → `npx prisma migrate deploy` (histórico limpo)
- Banco existente com drift (caso do Supabase atual) → `npx prisma db push`,
  nunca `migrate deploy`

## Decisão que falta antes de tudo: qual banco é o de produção?

O Supabase atual é rotulado como demo internamente. Antes de ir ao ar,
decidir explicitamente:
- Continuar nesse mesmo Supabase e "promovê-lo" a produção (risco: dados de
  demo/seed junto com dados reais), ou
- Provisionar um projeto Supabase (ou instância Postgres) novo, limpo, só
  para produção, e rodar `prisma migrate deploy` nele (evita o problema de
  drift que existe hoje).

A segunda opção é a mais segura para um go-live real.

## Integrações — o que muda de demo/dev para produção

### 1. DocuSign (assinatura de contratos)
Módulo: `backend/src/providers/docusign/`
- Vars: `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_ACCOUNT_ID`,
  `DOCUSIGN_PRIVATE_KEY`, `DOCUSIGN_ENV`, `DOCUSIGN_TEMPLATE_ID`,
  `DOCUSIGN_WEBHOOK_SECRET`, `BACKEND_URL`
- **Produção é uma conta DocuSign separada da demo/sandbox.** Não é só trocar
  `DOCUSIGN_ENV=demo` para `prod` — é preciso solicitar "Go-Live" da
  aplicação no painel DocuSign, o que gera novo Integration Key, novo par de
  chaves RSA e um novo Template ID no ambiente de produção.
- `BACKEND_URL` precisa ser o domínio público real (usado no callback do
  webhook).

### 2. AWS S3 (imagens de produto)
Módulo: `backend/src/aws/s3.service.ts`
- Vars: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
  `AWS_BUCKET_NAME`, opcional `AWS_ENDPOINT` (se usar Cloudflare R2 em vez de
  S3 — código já suporta via `forcePathStyle`)
- Produção: bucket dedicado (não o de dev/teste), usuário IAM com permissão
  mínima (put/get/delete só nesse bucket).

### 3. AWS SES (e-mails)
Módulo: `backend/src/aws/ses.service.ts`
- Vars: `EMAIL_FROM` + credenciais AWS acima
- **SES nasce em sandbox**: só envia para endereços verificados
  manualmente. Para produção é obrigatório (1) verificar o domínio do
  `EMAIL_FROM` (registros SPF/DKIM/DMARC) e (2) solicitar saída do sandbox
  no console AWS. Sem isso, e-mails de notificação simplesmente falham em
  produção para qualquer destinatário não verificado.

### 4. Calendly (agendamentos)
Módulo: `backend/src/features/appointments/`
- **`.env.example` está desatualizado** (mostra `CALENDLY_ACCESS_TOKEN`
  simples). O código real usa OAuth2 completo:
  `CALENDLY_OAUTH_CLIENT_ID`, `CALENDLY_OAUTH_CLIENT_SECRET`,
  `CALENDLY_OAUTH_REDIRECT_URI`, `CALENDLY_TOKEN_ENCRYPTION_KEY`,
  `CALENDLY_WEBHOOK_CALLBACK_URL`, `CALENDLY_WEBHOOK_SIGNING_KEY`.
- Produção: app OAuth do Calendly precisa ter o redirect URI apontando pro
  domínio real do backend; `CALENDLY_WEBHOOK_CALLBACK_URL` precisa ser HTTPS
  público; `CALENDLY_TOKEN_ENCRYPTION_KEY` deve ser gerada nova (32 bytes),
  nunca reaproveitar a de dev.

### 5. Google Meet (videoconferência)
Módulo: `backend/src/features/meetings/`
- Vars: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
  `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_MEET_TOKEN_ENCRYPTION_KEY`,
  `GOOGLE_MEET_ACCESS_TYPE` (manter `OPEN`), `MEETING_PROVIDER=GOOGLE`,
  `MEETING_DEMO_FALLBACK_ENABLED=false`, `JITSI_BASE_URL` (fallback)
- Arquitetura: **não é service account** — é uma conta Google Workspace
  conectada manualmente pelo admin no painel (`/admin/settings`), refresh
  token fica criptografado no banco. Pré-condição de negócio: a conta
  conectada **precisa ser Google Workspace** (Gmail comum não cria Meet via
  API).
- **Tela de consentimento OAuth precisa estar "Published" (não "Testing")**
  no Google Cloud Console — em modo teste o refresh token expira em 7 dias e
  quebra a integração silenciosamente.
- Após deploy: um admin precisa reconectar a conta Google pelo painel
  (fluxo OAuth aponta pro domínio de produção).

### 6. Google Drive (importação de imagens em lote)
Módulo: `backend/src/features/drive-import/`
- Var: `GOOGLE_DRIVE_API_KEY`
- Sem promoção especial; só restringir a key no Google Cloud Console por
  domínio/IP se possível.

### 7. JWT / Auth
- Vars: `JWT_SECRET_ACCESS`, `JWT_SECRET_REFRESH`, `JWT_SECRET_REFERRAL`,
  `JWT_SECRET_ADVISOR`, `JWT_SECRET_PASSWORD_RESET`
- Gerar 5 valores novos e aleatórios para produção (nunca reaproveitar os de
  dev/demo). Ex.: `openssl rand -base64 48` por secret.

### 8. CORS / URL do frontend
- Var: `FRONTEND_URL` no backend precisa ser o domínio real do Vercel de
  produção (usado em CORS e em links de e-mail).
- `VITE_API_BASE_URL` no frontend precisa apontar pro domínio real do
  Railway.

## Checklist de execução (ordem sugerida)

1. Decidir e provisionar o banco de produção (seção acima)
2. Gerar todos os secrets/keys novos (JWT, encryption keys)
3. Configurar produção em cada integração (DocuSign go-live, SES fora do
   sandbox, apps OAuth do Calendly/Google apontando pro domínio real, Google
   consent screen publicado)
4. Criar bucket S3/R2 de produção
5. Configurar todas as env vars no Railway (backend) e Vercel (frontend)
6. Rodar `prisma migrate deploy` (banco novo) ou `prisma db push` (banco
   existente) manualmente — não é automático
7. Deploy backend (Railway) e frontend (Vercel)
8. Admin reconecta a conta Google Meet pelo painel (produção)
9. Validar com `GET /api/health/detailed` (`backend/src/health/health.controller.ts`) — confirma `hasDatabase`, `hasAwsConfig`, `hasJwtSecrets`, `hasDocuSign`
10. Teste ponta a ponta: criar processo → agendar (Calendly) → reunião
    (Meet) → proposta → contrato (DocuSign) → e-mail de notificação (SES)

## Referência rápida — variáveis de ambiente

Ver `backend/.env.example` para o template completo (**exceto Calendly**,
que está desatualizado ali — usar as vars OAuth listadas acima).
