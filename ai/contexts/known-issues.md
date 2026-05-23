# Problemas Conhecidos — High-Class Shop

_Última atualização: 10/05/2026_

## Melhorias Aplicadas (10/05/2026 — Correções e Reorganização)

| Item | Resolução |
|------|-----------|
| F1 — Settings 404 no admin | `SettingsService.update()` trocado de `update+NotFoundException` para `upsert` — cria chave se não existir |
| F2 — Erros HTTP não amigáveis | `api.ts`: corrigida extração de `serverMessage` (objeto nested `error.message`); 404 usa serverMessage quando disponível; `SettingsPage` usa `err.friendlyMessage` |
| F3 — SearchProvider dead code | `SearchContext.tsx` deletado; `SearchProvider` removido de `MainLayout.tsx` |
| F4 — Arquivos órfãos | `components/Sidebar.tsx`, `pages/HomePage.tsx`, `pages/SchedulerPage.tsx` deletados |
| F5 — Componentes desorganizados | 16 componentes movidos para subpastas: `processes/`, `appointments/`, `contracts/`, `product/`, `shared/`, `ui/`, `calendly/` |
| F6 — Páginas desorganizadas | `Catalog`, `ProductPage`, `LandingPage`, `ProfilePage` movidos para subpastas de rota; form sub-components de `pages/specialist/` → `components/specialist/` |

---

## Melhorias Aplicadas (09/05/2026 — C2 Feature Assessor)

| Item | Resolução |
|------|-----------|
| C2 — Cliente sem assessor pessoal | `CustomerAdvisor` model no Prisma; módulo `customer-advisors`; aba "Meu Assessor" no ProfilePage; `AdvisorAcceptPage` + `AdvisorDashboardPage`; e-mail de convite via `sendAdvisorInviteEmail` |

**Fluxo (09/05/2026):** Cliente convida e-mail → assessor recebe link → acessa `/advisor/accept?token=xxx` → frontend chama `POST /auth/accept-advisor-invite` com JWT logado → backend verifica e-mail do token = e-mail do usuário → `accepted_at` setado. Assessor acessa `/advisor/dashboard` para ver clientes e processos.

**Nova env var:** `JWT_SECRET_ADVISOR` (obrigatória para convites de assessor, 7d expiry).

---

## Melhorias Aplicadas (08/05/2026 — sprint)

| Item | Resolução |
|------|-----------|
| A1 — Barra de pesquisa em `/admin/settings` e `/admin/my-company` | `showSearch` em `Header.tsx` excluí essas rotas |
| A2 — Emojis na UI | Substituídos por ícones Lucide ou removidos em `HomePage`, `ProductPage`, `NegotiationPage`, `ImageUploader` |
| A3 — Segundo processo sem aviso | `ProductPage.tsx` busca processos ativos antes de criar novo; exibe `window.confirm()` |
| A4 — DocuSign email conflict — erro genérico | `CreateContractPage.tsx` detecta conflito de e-mail e exibe mensagem clara |
| B1 — Calendly fecha sem agendar avança appointment | `schedulingActuallyConfirmed` ref em `ConsultoriaPage.tsx`; só `true` após sync bem-sucedido |
| B2 — Drive import usava match por marca_modelo | Removido matching; usa somente `folder_url` da linha. Reimport apaga imagens anteriores (DB + S3) antes de inserir novas |
| B3 — Lembrete só em 9-11 min | Dois intervalos: `_15min` (13-17 min antes) e `_now` (-2 a +2 min) com cache keys compostas |
| B4 — E-mails com emojis e subjects informais | Todos os subjects/HTML limpos; formato "Ação — contexto \| High-Class Shop" |
| B5 — Contrato: campos read-only aparecem como inputs | Campos derivados exibidos como divs cinzas; seções com headings; botão submit melhorado |
| B6 — Botões errados em ProcessCard | `canEnterMeetingWindow` (gate 30min) removido; `canStartOrJoinMeeting` simplificado |
| B7 — Erros HTTP sem mensagem amigável | Interceptor em `api.ts` adiciona `err.friendlyMessage` para 400/401/403/404/409/5xx |
| C1 — Especialista não podia antecipar reunião | Botão "Antecipar Reunião" em `MeetingRoomPage.tsx`; backend envia `sendMeetingAdvancedEmail` ao cliente |

**Drive import — detalhe (08/05/2026):** `deleteAllProductImages()` chama `deleteObjects()` no S3 (batch delete) e `deleteMany` no Prisma antes de cada importação, garantindo substituição total em reimports.

**Meeting reminders — detalhe (08/05/2026):** `MeetingReminderEmailDto` tem `isStartingNow?: boolean`; `sendMeetingReminderEmail` diferencia subject/body entre "em 15 minutos" e "começando agora".

---

## Melhorias Aplicadas (07/05/2026 — sessão 2)

| Item | Resolução |
|------|-----------|
| Reunião sem horário confirmado bloqueava início | Guards de appointment removidos do backend; especialista pode iniciar a qualquer momento; cliente recebe e-mail com link |
| MeetingRoomPage — sem banner quando não há horário | Banner âmbar adicionado para ambos os papéis quando `!hasValidScheduledDate` |

**Detalhe (`meetings.service.ts`):** removidos 4 guards em `startMeetingForProcess()` — agora só bloqueia se: não é especialista, status do processo inválido, ou já existe `meeting_session`. E-mail ao cliente via `sendMeetingStartedEmail` já estava conectado.

---

## Melhorias Aplicadas (07/05/2026)

| Item | Resolução |
|------|-----------|
| Modais — fechar ao clicar no backdrop | `onClick` adicionado em todos os backdrops; inner div tem `stopPropagation` |
| Sidebar mobile — sem overlay | Overlay `z-40 bg-black/50` adicionado em `layouts/Sidebar.tsx`; links fecham sidebar |
| Plataforma não-responsiva | Grids fixos corrigidos (`grid-cols-4` → `grid-cols-2 md:grid-cols-4`); tabelas com `overflow-x-auto`; headers com `flex-wrap` |

**Modais com backdrop-close (07/05/2026):**
- `CreateProcessModal` — guarda `isSubmitting`
- `UpdateProcessStatusModal` — guarda `isSubmitting`; modal aninhado de rejeição também fecha
- `ConfirmAppointmentModal` — guarda `loading`
- `ProductTypePreferenceModal`
- `DocuSignPreviewModal` — guarda `isLoading`
- `ContractPreviewModal` — guarda `isLoading`
- `ProductSelectorModal`
- `ImageUploader` crop modal

**Páginas responsivas ajustadas (07/05/2026):**
- `SpecialistDashboard` + `admin/DashboardPage` — stats/charts grids responsivos
- `admin/SpecialistsPage` + `admin/CompaniesPage` — tabelas grid com `overflow-x-auto` + `min-w`
- `specialist/ProductsPage`, `ConsultantDashboard`, `SpecialistsPage`, `CompaniesPage` — headers com `flex-wrap gap-3`

## Bugs Resolvidos (06/05/2026)

| Bug | Resolução |
|-----|-----------|
| RG — só aceitava 10 dígitos | Backend DTO + frontend: agora aceita 7-10 dígitos |
| Calendly popup fecha sem agendar | `handleCalendlyModalClose` cancela appointment PENDING no backend |
| Emails de confirmação/cancelamento ausentes | `sendAppointmentConfirmedEmail` + `sendAppointmentCancelledEmail` conectados |
| Alterar senha inexistente | `PATCH /auth/change-password` criado + UI no ProfilePage |
| CSV com caracteres estranhos | `parseCsv` usa UTF-8 → windows-1252 fallback; templates têm BOM UTF-8 |
| Drive 400 a partir do 2º produto | Download via URL pública (`uc?export=download`) sem quota; retry backoff; sleep 250ms entre downloads |

## Bugs Ativos (Prioritários)

### ~~1. RG — Validação rejeita 7-9 dígitos~~ ✅ Resolvido em 06/05/2026

**Fix aplicado:** DTO backend + frontend mudados para 7-10 dígitos.

---

### ~~2. Calendly — Popup fechado sem agendar cria appointment órfão~~ ✅ Resolvido em 06/05/2026 + B1 (08/05/2026)

**Fix aplicado:** `handleCalendlyModalClose` cancela appointment PENDING se `!schedulingActuallyConfirmed.current`. Ref só setada `true` após sync bem-sucedido com o backend.

---

### ~~3. Email de confirmação de agendamento — Conexão incompleta~~ ✅ Resolvido em 06/05/2026

**Fix aplicado:** `sendAppointmentConfirmedEmail` e `sendAppointmentCancelledEmail` conectados em `appointments.service.ts`.

---

### ~~4. Alterar senha — Funcionalidade inexistente~~ ✅ Resolvido em 06/05/2026

**Fix aplicado:** `PATCH /auth/change-password` criado no backend + UI no ProfilePage.

---

### ~~5. Upload de imagem via Drive — Acumulação em reimport~~ ✅ Resolvido em B2 (08/05/2026)

**Fix aplicado:** `deleteAllProductImages()` limpa DB + S3 (batch delete) antes de cada importação. `folder_url` da linha CSV é o único critério — matching por `marca_modelo` removido.

---

### ~~6. Importação CSV/XLSX — Caracteres estranhos nos dados salvos~~ ✅ Resolvido em 06/05/2026

**Fix aplicado:** `parseCsv` usa UTF-8 com fallback para windows-1252. Templates com BOM UTF-8.

---

## Inconsistências Conhecidas (Não Críticas)

- Resposta de erro usa `"sucess"` (typo) — não corrigir sem atualizar clientes
- Frontend chama `GET /contracts` e `GET /contracts/:id` que não existem no backend
- Nomenclatura `/aircraft` vs `/aircrafts` inconsistente em partes do código
- `README.md` raiz tem placeholders desatualizados
