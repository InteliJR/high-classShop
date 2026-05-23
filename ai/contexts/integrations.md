# Integrações Externas — High-Class Shop

_Última atualização: 09/05/2026_

## Calendly (Agendamento)

**Fluxo OAuth por Especialista:**
1. Especialista vai ao perfil → conecta Calendly via OAuth
2. Backend salva `CalendlyConnection` com tokens criptografados (AES-256-GCM)
3. Cliente acessa `/consultoria` → escolhe especialista → click "Solicitar Reunião"
4. Backend cria `Appointment` com status `PENDING`
5. Frontend abre `PopupModal` do Calendly com a URL do especialista
6. Após agendamento, `useCalendlyEventListener.onEventScheduled` captura `event_uri` e `invitee_uri`
7. Frontend chama `registerCalendlyScheduledEvent` → backend atualiza appointment
8. Webhook `invitee.created` reforça sync server-to-server

**Bug resolvido (08/05/2026 — B1):** `handleCalendlyModalClose` agora usa `schedulingActuallyConfirmed` ref. Cancela appointment PENDING se o ref for `false` quando modal fecha.

**Arquivos:**
- `backend/src/features/appointments/calendly-integration.service.ts`
- `backend/src/features/appointments/appointments.controller.ts`
- `frontend/src/pages/customer/ConsultoriaPage.tsx`
- `frontend/src/components/CalendlyEmbed.tsx`

**Env vars:**
```
CALENDLY_OAUTH_CLIENT_ID
CALENDLY_OAUTH_CLIENT_SECRET
CALENDLY_OAUTH_REDIRECT_URI
CALENDLY_TOKEN_ENCRYPTION_KEY
CALENDLY_WEBHOOK_CALLBACK_URL
CALENDLY_WEBHOOK_SIGNING_KEY
```

---

## AWS SES (Email)

**NotificationService** (`backend/src/features/notifications/notification.service.ts`) — todos fire-and-forget, nunca bloqueiam transações.

**Templates ativos:**
- `sendAppointmentCreatedEmail` — especialista sobre novo agendamento
- `sendAppointmentConfirmedEmail` — cliente sobre confirmação
- `sendAppointmentCancelledEmail` — cancelamento (ambas as partes)
- `sendMeetingStartedEmail` — cliente recebe link ao especialista iniciar reunião
- `sendMeetingAdvancedEmail` — cliente recebe link ao especialista antecipar reunião _(08/05/2026)_
- `sendMeetingReminderEmail` — lembrete 15 min antes e no horário exato (`isStartingNow`) _(08/05/2026)_
- `sendProposalReceivedEmail`, `sendProposalAcceptedEmail`, `sendProposalRejectedEmail`
- `sendProcessStatusChangedEmail`
- `sendContractGeneratedEmail`, `sendContractSentEmail`, `sendContractSignedEmail`, `sendContractStatusChangedEmail`
- `sendAdvisorInviteEmail` — convite de assessor pessoal com link JWT _(09/05/2026)_

**Estilo (08/05/2026):** sem emojis, header `#1e293b`, subjects no formato "Ação — contexto | High-Class Shop", footer "High-Class Shop — Marketplace de Bens de Luxo".

**Circuit Breaker:** 5 falhas → corta por 60s. 3 retries com backoff exponencial (1s/2s/4s). Timeout 5s por e-mail.

**Env vars:**
```
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
EMAIL_FROM
```

---

## AWS S3 / Cloudflare R2 (Upload de Imagens)

**Compatível com R2** (se `AWS_ENDPOINT` estiver definido, usa `forcePathStyle: true`).

**Fluxo:** Imagem → base64 ou multipart → `S3Service.uploadBase64Image()` → retorna `key` → salva na tabela `*_image`

**Deleção (08/05/2026):** `S3Service.deleteObject(key)` (single, best-effort) e `S3Service.deleteObjects(keys[])` (batch, chunks de 1000 via `DeleteObjectsCommand`). Usados em reimport de imagens via Drive.

**URL de acesso:** Gerada via `getSignedUrl()` (presigned, temporária).

**Env vars:**
```
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_BUCKET_NAME
AWS_ENDPOINT          # opcional, para R2
```

---

## Google Drive (Importação de Imagens)

**Uso:** Especialista fornece URL de pasta pública do Drive com fotos do produto. Backend lista arquivos via API e faz upload para S3.

**Arquivo:** `backend/src/features/drive-import/drive-import.service.ts`

**Env var:**
```
GOOGLE_DRIVE_API_KEY
```

---

## DocuSign (Assinatura Digital)

**Fluxo:**
1. `GET /contracts/prefill/:processId` — pré-preenche dados do processo
2. `POST /contracts/preview` — cria envelope draft + retorna sender view URL
3. Especialista visualiza/edita no DocuSign
4. `POST /contracts/send/:envelopeId` — envia para assinatura
5. Webhook `DocuSign → POST /docusign/webhook` — atualiza status ao completar

**Env vars:**
```
DOCUSIGN_INTEGRATION_KEY
DOCUSIGN_USER_ID
DOCUSIGN_ACCOUNT_ID
DOCUSIGN_PRIVATE_KEY
DOCUSIGN_ENV          # demo | production
DOCUSIGN_TEMPLATE_ID
DOCUSIGN_WEBHOOK_SECRET
```

---

## Google Meet / Jitsi (Reuniões)

**Provedor configurado via** `MEETING_PROVIDER` (JITSI ou GOOGLE).

- **Jitsi:** Zero configuração extra, recomendado para dev/demo
- **Google Meet:** Requer service account com acesso ao Calendar

**Env vars:**
```
MEETING_PROVIDER                         # JITSI | GOOGLE
JITSI_BASE_URL
MEETING_DEMO_FALLBACK_ENABLED           # true para fallback automático
GOOGLE_MEET_SERVICE_ACCOUNT_EMAIL
GOOGLE_MEET_SERVICE_ACCOUNT_PRIVATE_KEY
GOOGLE_MEET_CALENDAR_ID
GOOGLE_MEET_TIMEZONE
```
