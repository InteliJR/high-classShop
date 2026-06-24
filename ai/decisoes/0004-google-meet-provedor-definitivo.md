# ADR-0004: Adotar Google Meet como provedor definitivo de reuniões (retirar Jitsi)

**Data:** 2026-06-24
**Autor:** Carlos Paiva
**Status:** Aceito

## Contexto

As reuniões entre especialista e cliente são geradas pela feature `meetings`
(`backend/src/features/meetings/meetings.service.ts`). Hoje o sistema suporta
**dois provedores**, selecionados pela variável de ambiente `MEETING_PROVIDER`:

- **`GOOGLE`** (padrão no código): cria um evento no Google Calendar via service
  account e extrai o link do Google Meet (`createCalendarEventWithMeet`,
  `extractMeetLinkFromEvent`, `waitForMeetLink`).
- **`JITSI`**: monta uma URL de sala a partir de `JITSI_BASE_URL`
  (`buildDemoMeetingLink`), hoje apontando para o servidor público `meet.jit.si`.

Além disso existe um fallback de demonstração (`MEETING_DEMO_FALLBACK_ENABLED`)
que, quando o Google falha, gera um link estilo Jitsi.

A nota técnica `ai/notas-tecnicas/2026-05-jitsi-estudo.md` concluiu que o servidor
público do Jitsi **não é adequado para reuniões de negócio** com clientes de bens
de alto padrão (sem garantia de qualidade/estabilidade, risco de imagem), e que
qualquer uso sério do Jitsi exigiria custo recorrente (servidor próprio ~R$
100–400/mês ou JaaS por minuto).

A task atual ("elevar o sistema de Jitsi para Google Meet") já está, em grande
parte, refletida no código: o Google Meet é o provedor padrão e está implementado.
Falta **tornar a decisão oficial** e **retirar o Jitsi** do caminho de produção
para evitar ambiguidade e risco de cair na sala pública.

## Alternativas avaliadas

### Opção A — Manter Jitsi (servidor próprio ou JaaS)
- **Prós:** custo previsível (self-hosted), controle total dos dados, embutível em
  `<iframe>` na própria plataforma, sem limite de duração.
- **Contras:** exige infra/manutenção (self-hosted) ou custo por minuto (JaaS);
  servidor público não é confiável para clientes. Detalhado em
  `ai/notas-tecnicas/2026-05-jitsi-estudo.md`.

### Opção B — Google Meet como provedor único
- **Prós:** robusto e profissional, sem servidor para manter, integração já
  implementada (service account + Calendar API), custo zero com conta Google.
- **Contras:** não embute em `<iframe>` (abre em aba nova); exige service account
  com acesso ao Google Calendar; depende de configuração correta de credenciais.

### Opção C — Manter os dois provedores (estado atual)
- **Prós:** flexibilidade de alternar por env var; fallback de demonstração.
- **Contras:** dois caminhos de código para manter e testar; risco de produção
  rodar acidentalmente com `MEETING_PROVIDER=JITSI` apontando para a sala pública;
  ambiguidade conceitual ("qual é o provedor oficial?").

## Decisão

Adotar a **Opção B**: **Google Meet é o provedor definitivo** de reuniões. O Jitsi
e o fallback de demonstração baseado em Jitsi serão **removidos** do código de
produção. O caminho de erro existente (`ServiceUnavailableException` quando o Meet
não pode ser criado) passa a ser o comportamento único em caso de falha — sem cair
para uma sala pública.

> **Observação:** esta é a decisão de arquitetura. A implementação acontece na
> branch `feat/migracao-google-meet` e está descrita no plano abaixo. **Nenhuma
> alteração de código foi feita ainda** — este documento é apenas o plano.

## Plano de implementação

> Ordem sugerida. Cada item idealmente vira um commit pequeno (Conventional Commits).

### 1. Backend — remover o caminho Jitsi e o fallback de demo
Arquivo: `backend/src/features/meetings/meetings.service.ts`
- Remover o bloco `if (this.meetingProvider === 'JITSI') { ... }` em
  `startMeetingForProcess` (cria sala Jitsi).
- Remover os dois blocos `if (this.demoMeetingFallbackEnabled) { ... }` (no `catch`
  da criação do evento e no caso de "evento sem link").
- Remover o método `buildDemoMeetingLink` e os campos/leituras de config
  `meetingProvider`, `jitsiBaseUrl`, `demoMeetingFallbackEnabled` no construtor.
- Resultado: `startMeetingForProcess` segue apenas o fluxo Google Calendar/Meet e,
  em falha, lança `ServiceUnavailableException` (comportamento já existente).

### 2. Backend — completar a integração Google Meet (recomendado)
Arquivo: `backend/src/features/meetings/meetings.service.ts`
- Em `createCalendarEventWithMeet`, adicionar `attendees` (e-mails do cliente e do
  especialista) ao `requestBody`, para que ambos recebam o convite nativo do Google
  Calendar além do e-mail da plataforma.
- **Pré-requisito:** a service account precisa ter permissão para convidar
  participantes (conta Google Workspace com *domain-wide delegation* ou
  `sendUpdates: 'all'`). Validar antes de habilitar. Ver "Pontos de decisão".

### 3. Frontend — remover o tratamento específico de Jitsi
Arquivo: `frontend/src/pages/meetings/MeetingRoomPage.tsx`
- Remover a função `isJitsiLink` e o bloco do `<iframe>` (embed Jitsi).
- A reunião passa a ser sempre acessada pelo botão externo "Entrar na Reunião"
  (Google Meet não embute em iframe). Manter o card de link + botão de copiar.

### 4. Configuração / variáveis de ambiente
- Remover `MEETING_PROVIDER`, `JITSI_BASE_URL` e `MEETING_DEMO_FALLBACK_ENABLED` de
  `backend/.env.example`.
- Garantir que as variáveis do Google estejam documentadas como obrigatórias:
  `GOOGLE_MEET_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_MEET_SERVICE_ACCOUNT_PRIVATE_KEY`,
  `GOOGLE_MEET_CALENDAR_ID`, `GOOGLE_MEET_TIMEZONE`.

### 5. Documentação
- `ai/contexts/integrations.md`: atualizar a seção "Google Meet / Jitsi" para
  "Google Meet (Reuniões)" — provedor único; remover menções a `MEETING_PROVIDER`/Jitsi.
- `ai/contexts/env-vars.md`: remover as vars de Jitsi da seção "Reuniões"; mover
  Google Meet para "Variáveis Críticas".
- `ai/notas-tecnicas/2026-05-jitsi-estudo.md`: marcar `Status` como
  "Substituído por ADR-0004" (notas/ADRs não são deletados, apenas marcados).

### 6. Testes / validação
- Atualizar/!remover testes que dependam de `MEETING_PROVIDER=JITSI` ou do fallback.
- Validar em staging com credenciais reais: iniciar reunião → link do Meet gerado →
  cliente e especialista acessam → encerrar → "Já conversei com o cliente" avança o
  processo (`markConversationDone`).
- Testar caminho de falha: credenciais inválidas → `ServiceUnavailableException` com
  mensagem clara (sem cair em sala pública).

### 7. Critérios de aceite
- `MEETING_PROVIDER` e qualquer referência a Jitsi não existem mais no código.
- Iniciar reunião gera sempre link `meet.google.com`.
- Frontend abre a reunião em aba nova; sem iframe.
- Em falha de configuração, erro explícito (nenhum fallback público).
- Docs e `.env.example` consistentes.

## Consequências

### Positivas
- Um único provedor, profissional e estável, para reuniões com clientes.
- Menos código e configuração para manter (um caminho em vez de dois).
- Elimina o risco de produção cair na sala pública `meet.jit.si`.

### Negativas / Riscos
- **Sem fallback:** se o Google Meet falhar (credenciais/quota/config), a reunião
  não é criada. Mitigação: validar credenciais em staging; manter mensagem de erro
  clara; considerar feature flag temporária durante o rollout.
- **Dependência de service account:** exige Calendar API habilitada e, para
  `attendees`, conta Workspace com permissão de convite.
- **Eventos no calendário da plataforma:** acúmulo de eventos em
  `GOOGLE_MEET_CALENDAR_ID`; avaliar política de retenção/limpeza (fora do escopo).

### Tarefas afetadas
- Migração Jitsi → Google Meet (esta task) — branch `feat/migracao-google-meet`.
- Relaciona-se à TASK 1.12 (estudo de custos do Jitsi, agora superado).

## Pontos de decisão em aberto (confirmar antes de implementar)
1. **Remover o Jitsi por completo** ou mantê-lo desabilitado como fallback de
   emergência? (Plano assume remoção total.)
2. **Adicionar `attendees`** ao evento do Google Calendar (item 2)? Depende de a
   service account ter permissão de convite (Workspace/delegation).
3. Manter a política atual de **um evento por processo** ou criar evento com
   `start/end` baseados no `appointment_datetime` (hoje usa "agora + 1h")?

## Referências
- Código: `backend/src/features/meetings/meetings.service.ts`,
  `frontend/src/pages/meetings/MeetingRoomPage.tsx`
- Integrações: `ai/contexts/integrations.md` (seção Google Meet / Jitsi)
- Variáveis: `ai/contexts/env-vars.md` (seção Reuniões), `backend/.env.example`
- Estudo anterior: `ai/notas-tecnicas/2026-05-jitsi-estudo.md`
- Google Calendar API (conferenceData / hangoutsMeet)
