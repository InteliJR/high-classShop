# Guia de Integração do Frontend — high-classShop

## 1) Visão geral

O frontend (React + Vite) consome a API do backend via Axios centralizado em `frontend/src/services/api.ts`, com autenticação baseada em:

- `accessToken` em memória/estado persistido
- `refreshToken` em cookie HttpOnly (`withCredentials: true`)
- interceptor de resposta para renovar sessão em `401`

Arquivos-chave:
- `frontend/src/services/api.ts`
- `frontend/src/store/authStateManager.ts`
- `frontend/src/contexts/AuthContext.tsx`

---

## 2) Configuração de URL da API

Variável principal:
- `VITE_API_BASE_URL`

Valor esperado:
- URL absoluta com protocolo e prefixo `/api`
- Exemplo local: `http://localhost:3000/api`

Comportamento atual:
- `axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/" })`

Risco conhecido:
- Se `VITE_API_BASE_URL` for informado sem protocolo (ex.: `high-classshop-production.up.railway.app/api`), o navegador interpreta como caminho relativo e concatena com domínio do frontend.

---

## 3) Fluxo de autenticação no frontend

## 3.1 Login e sessão
- `AuthContext.login` chama `POST /auth/login`.
- Salva `access_token` e `user` no store.
- Cookie refresh fica no browser (`withCredentials`).

## 3.2 Verificação de usuário
- `AuthContext.verifyToken` chama `GET /auth/me`.

## 3.3 Renovação automática
- `api` interceptor captura `401`.
- Chama `refresh()` (`POST /auth/refresh`) uma vez por ciclo.
- Reenvia request original com novo bearer token.

## 3.4 Logout
- `POST /auth/logout` e limpeza de estado local.

---

## 4) Endpoints consumidos pelo frontend

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

## 4.1 Autenticação
Arquivos:
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/store/authStateManager.ts`

Chamadas:
- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/validate-referral`
- `GET /auth/me`
- `POST /auth/refresh`
- `POST /auth/logout`

```json
payload:
{
   "email": "",
   "password": ""
}

resposta:
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

## 4.2 Produtos
Arquivos:
- `frontend/src/services/cars.service.ts`
- `frontend/src/services/boats.service.ts`
- `frontend/src/services/aircrafts.service.ts`

Cars:
- `GET /cars`
- `GET /cars/:id`
- `POST /cars`
- `PATCH /cars/:id`
- `DELETE /cars/:id`
- `GET /cars/csv-template`
- `POST /cars/import-csv`

```json
payload:
{
   "page": 1,
   "perPage": 20,
   "filters": {},
   "id": 0
}

resposta:
{
   "data": [
      {
         "id": 0,
         "marca": "",
         "modelo": "",
         "valor": 0,
         "images": []
      }
   ],
   "meta": {
      "pagination": {},
      "filters": {}
   }
}
```

Boats:
- `GET /boats`
- `GET /boats/:id`
- `POST /boats`
- `PATCH /boats/:id`
- `DELETE /boats/:id`
- `GET /boats/csv-template`
- `POST /boats/import-csv`

```json
payload:
{
   "id": 0,
   "page": 1,
   "perPage": 20,
   "filters": {}
}

resposta:
{
   "data": [
      {
         "id": 0,
         "marca": "",
         "modelo": "",
         "valor": 0
      }
   ]
}
```

Aircrafts:
- `GET /aircrafts`
- `GET /aircrafts/:id`
- `POST /aircrafts`
- `PATCH /aircrafts/:id`
- `DELETE /aircrafts/:id`
- `GET /aircrafts/csv-template`
- `POST /aircrafts/import-csv`

```json
payload:
{
   "id": 0,
   "page": 1,
   "perPage": 20,
   "filters": {}
}

resposta:
{
   "data": [
      {
         "id": 0,
         "marca": "",
         "modelo": "",
         "valor": 0,
         "tipo_aeronave": ""
      }
   ]
}
```

## 4.3 Processos e negociação
Arquivos:
- `frontend/src/services/processes.service.ts`
- `frontend/src/services/proposals.service.ts`

Processes:
- `GET /processes`
- `GET /processes/:id`
- `POST /processes`
- `GET /processes/specialist/:specialistId`
- `GET /processes/client/:clientId`
- `PATCH /processes/:id/status`
- `PATCH /processes/:id/assign-product`
- `GET /processes/:id/completion-reason`
- `GET /processes/:id/with-contract`
- `PATCH /processes/:id/reject`
- `POST /processes/:id/confirm-appointment`
- `POST /processes/:id/cancel-appointment`

```json
payload:
{
   "process_id": "",
   "client_id": "",
   "specialist_id": "",
   "status": "SCHEDULING"
}

resposta:
{
   "success": true,
   "data": {
      "id": "",
      "status": "NEGOTIATION"
   }
}
```

Proposals:
- `POST /proposals`
- `GET /proposals/processes/:processId/proposals`
- `GET /proposals/:id`
- `PATCH /proposals/:id/accept`
- `PATCH /proposals/:id/reject`

```json
payload:
{
   "process_id": "",
   "proposed_value": 0,
   "message": ""
}

resposta:
{
   "success": true,
   "data": {
      "id": "",
      "status": "PENDING"
   }
}
```

## 4.4 Agendamentos e Calendly
Arquivo:
- `frontend/src/services/appointments.service.ts`

Appointments:
- `GET /appointments/check`
- `GET /appointments`
- `POST /appointments/pending`
- `GET /appointments/pending`
- `POST /appointments/pending/:id/confirm`
- `POST /appointments/pending/:id/cancel`
- `POST /appointments/pending/:id/calendly-scheduled`
- `GET /appointments/:id/calendly-sync-status`

```json
payload:
{
   "id": "",
   "client_id": "",
   "specialist_id": "",
   "product_type": "CAR",
   "product_id": 0
}

resposta:
{
   "success": true,
   "data": {
      "id": "",
      "status": "PENDING",
      "appointment_datetime": ""
   }
}
```

Calendly OAuth:
- `GET /appointments/calendly/oauth/authorize`
- `GET /appointments/calendly/oauth/status`
- `POST /appointments/calendly/oauth/disconnect`

```json
payload:
{
   "action": "authorize"
}

resposta:
{
   "success": true,
   "data": {
      "authorize_url": "",
      "connected": true
   }
}
```

## 4.5 Contratos
Arquivo:
- `frontend/src/services/contracts.service.ts`

Consumidos:
- `GET /contracts/prefill/:processId`
- `POST /contracts/generate`
- `POST /contracts/preview`
- `POST /contracts/send/:envelopeId`
- `POST /contracts/cancel-preview/:envelopeId`

```json
payload:
{
   "process_id": "",
   "buyer_name": "",
   "seller_name": "",
   "vehicle_model": ""
}

resposta:
{
   "success": true,
   "data": {
      "id": "",
      "process_id": "",
      "preview_url": "",
      "envelope_id": ""
   }
}
```

Também declarados no frontend (mas não presentes no backend atual):
- `GET /contracts/:id`
- `GET /contracts`

## 4.6 Gestão administrativa
Arquivos:
- `companies.service.ts`, `consultants.service.ts`, `specialists.service.ts`, `users.service.ts`, `settings.service.ts`, `platform-company.service.ts`, `dashboard.service.ts`, `consultant.service.ts`

Chamadas:
- Companies: `GET|POST /companies`, `PUT|DELETE /companies/:id`, `GET /companies/:id/specialists`
- Consultants: `GET|POST /consultants`, `PUT|DELETE /consultants/:id`
- Specialists: `GET|POST /specialists`, `GET /specialists/grouped-by-category`, `PUT|DELETE /specialists/:id`
- Users: `GET /users`, `GET|PATCH /users/:id`
- Settings: `GET /settings`, `GET|PATCH /settings/:key`
- Platform company: `GET|PUT /platform-company`
- Dashboard: `GET /dashboard/stats`, `GET /dashboard/specialist-stats/:specialistId`
- Consultant carteira: `GET /consultant/clients`, `POST /consultant/invite`, `PUT|DELETE /consultant/clients/:id`

```json
payload:
{
   "id": "",
   "page": 1,
   "perPage": 20,
   "filters": {}
}

resposta:
{
   "success": true,
   "data": []
}
```

## 4.7 Jobs de importação
Arquivo:
- `product-import-jobs.service.ts`

Chamada:
- `GET /product-import-jobs/:jobId`

```json
payload:
{
   "jobId": ""
}

resposta:
{
   "jobId": "",
   "status": "PROCESSING",
   "done": false,
   "result": {}
}
```

---

## 5) Fluxos de integração principais

## 5.1 Fluxo de agendamento
1. Front verifica existência (`GET /appointments/check`).
2. Cria pendência (`POST /appointments/pending`).
3. Especialista confirma/cancela.
4. Calendly sincroniza dados de data/hora via webhook/event endpoint.

## 5.2 Fluxo de processo comercial
1. Front cria processo (`POST /processes`).
2. Avança status e associa produto quando necessário.
3. Negociação ocorre por propostas (`/proposals`).
4. Ao fechar, segue para contrato/documentação.

## 5.3 Fluxo de contrato
1. Carrega prefill (`GET /contracts/prefill/:processId`).
2. Front monta payload e chama preview (`POST /contracts/preview`).
3. Usuário valida preview; front envia (`POST /contracts/send/:envelopeId`).
4. Backend sincroniza status final por webhook DocuSign.

## 5.4 Fluxo de importação de catálogo
1. Front envia CSV para endpoint de produto.
2. Backend pode responder com processamento síncrono ou `jobId`.
3. Front faz polling em `/product-import-jobs/:jobId` até concluir.

---

## 6) Inconsistências atuais encontradas

1. `SchedulerPage` usa `/aircraft` (singular); backend expõe `/aircrafts`.
   - Arquivo: `frontend/src/pages/SchedulerPage.tsx`

2. `select-options.service` usa `/aircraft` em detalhes de produto.
   - Arquivo: `frontend/src/services/select-options.service.ts`

3. `contracts.service` declara `GET /contracts` e `GET /contracts/:id`, mas backend atual não expõe essas rotas.
   - Arquivo: `frontend/src/services/contracts.service.ts`

4. Algumas áreas do frontend assumem `response.data.data` enquanto certos endpoints retornam objeto direto.
   - Impacto: risco de erro em runtime quando contrato de resposta diverge por módulo.

---

## 7) Recomendações práticas

1. Padronizar respostas do backend em envelope único (`success`, `message`, `data`) para todos os módulos.
2. Corrigir imediatamente rotas `/aircraft` para `/aircrafts` no frontend.
3. Remover ou implementar endpoints de listagem/detalhe de contratos para alinhar front/back.
4. Validar `VITE_API_BASE_URL` na inicialização do frontend para rejeitar valores sem protocolo.
5. Manter um contrato OpenAPI/Swagger para evitar deriva entre frontend e backend.
