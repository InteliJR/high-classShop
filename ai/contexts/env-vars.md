# Variáveis de Ambiente — High-Class Shop

_Última atualização: 06/05/2026_
_Referência completa: `backend/.env.example`_

## Backend (`backend/.env`)

### Servidor
```
NODE_ENV=development|production
PORT=3000
LOG_LEVEL=debug|info|warn|error
```

### Banco de Dados
```
DATABASE_URL=postgresql://user:pass@host:5432/dbname?schema=public
DIRECT_URL=postgresql://user:pass@host:5432/dbname  # sem pooler, para migrations
```

### URLs
```
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
```

### JWT
```
JWT_SECRET_ACCESS=<string-forte>
JWT_SECRET_REFRESH=<string-forte>
JWT_SECRET_REFERRAL=<string-forte>
JWT_SECRET_ADVISOR=<string-forte>   # convites de assessor, expira em 7d
JWT_SECRET_PASSWORD_RESET=<string-forte>  # recuperação de senha, expira em 15min
```

### AWS (S3 + SES)
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_BUCKET_NAME=<bucket>
AWS_ENDPOINT=<url>        # opcional — use para Cloudflare R2
EMAIL_FROM=noreply@seudominio.com
```

### DocuSign
```
DOCUSIGN_INTEGRATION_KEY=<key>
DOCUSIGN_USER_ID=<uuid>
DOCUSIGN_ACCOUNT_ID=<id>
DOCUSIGN_PRIVATE_KEY=<rsa-private-key>
DOCUSIGN_ENV=demo|production
DOCUSIGN_TEMPLATE_ID=<template-id>
DOCUSIGN_WEBHOOK_SECRET=<secret>
```

### Google Drive
```
GOOGLE_DRIVE_API_KEY=<api-key>
```

### Google Meet
```
GOOGLE_MEET_SERVICE_ACCOUNT_EMAIL=<email>
GOOGLE_MEET_SERVICE_ACCOUNT_PRIVATE_KEY=<rsa-key>
GOOGLE_MEET_CALENDAR_ID=<calendar-id>
GOOGLE_MEET_TIMEZONE=America/Sao_Paulo
```

### Reuniões
```
MEETING_PROVIDER=JITSI|GOOGLE
MEETING_DEMO_FALLBACK_ENABLED=true|false
JITSI_BASE_URL=https://meet.jit.si
```

### Calendly OAuth
```
CALENDLY_OAUTH_CLIENT_ID=<id>
CALENDLY_OAUTH_CLIENT_SECRET=<secret>
CALENDLY_OAUTH_REDIRECT_URI=<backend-url>/api/appointments/calendly/oauth/callback
CALENDLY_TOKEN_ENCRYPTION_KEY=<32-byte-hex>
CALENDLY_WEBHOOK_CALLBACK_URL=<backend-url>/api/appointments/calendly/webhook
CALENDLY_WEBHOOK_SIGNING_KEY=<signing-key>
```

### Misc
```
FORCE_CLEAR=false   # true apenas em testes — limpa dados ao iniciar
```

## Frontend (`frontend/.env`)

```
VITE_API_BASE_URL=http://localhost:3000/api
VITE_NODE_ENV=development|production
```

## Variáveis Críticas (sem estas, funcionalidade quebra)

| Variável | Impacto se ausente |
|---------|-------------------|
| DATABASE_URL | Backend não sobe |
| JWT_SECRET_ACCESS / REFRESH | Autenticação quebra |
| CALENDLY_* | OAuth + webhook do Calendly não funciona |
| AWS_* | Upload de imagens e emails falham |
| DOCUSIGN_* | Contratos não funcionam |
| GOOGLE_DRIVE_API_KEY | Importação do Drive falha |
| VITE_API_BASE_URL | Frontend não consegue chamar API |
