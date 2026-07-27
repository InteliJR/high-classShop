# Seleção de template de contrato + comissão zerada no DocuSign

Data: 2026-07-27
Branch: `develop`

## Contexto

Hoje o especialista gera o contrato numa página única (`CreateContractPage.tsx`):
preenche o formulário → preview no DocuSign → envia. O template do DocuSign é
**fixo** (`DOCUSIGN_TEMPLATE_ID` no `.env`, hoje o "Contrato de Carro"), usado
para todos os tipos de produto.

A conta DocuSign (demo) tem 4 templates, verificados ao vivo via API:

| Template | Campos DocGen | Modelo de comissão |
|---|---|---|
| Contrato de Aeronave `50adc085…` | 47 | split (plataforma/escritório/especialista) |
| Contrato de Carro `2245d274…` (atual) | 47 | split — **labels idênticos** |
| Contrato de Embarcação `1c6eddd1…` | 47 | split — **labels idênticos** |
| Contrato de venda `141ff98d…` | 30 | flat (`commission_*`) — labels diferentes |

Os 3 templates de produto têm labels DocGen **100% idênticos** → o mesmo
formulário serve para os três. O "Contrato de venda" tem esquema próprio e
**fica fora do seletor** nesta iteração.

Mecânica DocGen relevante (validada na API + código `mapFormFieldsToDocGen`):
o backend cria o envelope draft, faz `GET docGenFormFields` para descobrir os
campos **que o template tem**, e só então faz `PUT` preenchendo esses campos.
Ou seja, **o template dita a lista de campos** — chaves extras no `formFields`
do app são simplesmente ignoradas (provado: o app manda `seller_address`, que
não existe como campo DocGen nos 3 templates, sem erro).

## Objetivo

1. **Feature A** — Etapa de seleção de template antes do preenchimento, com
   auto-seleção pelo tipo do produto e opção de trocar.
2. **Feature B** — Os contratos saem **sem comissão**: o app envia `0` nos
   campos monetários de comissão do DocuSign, e o especialista pode apagar os
   trechos de comissão do `Template.docx` sem quebrar o envio.

Fora de escopo: webhook de confirmação; "Contrato de venda" no seletor; zerar
comissão no banco/dashboards (só no DocuSign).

---

## Feature A — Seleção de template

### Backend

- **`docusign.client.ts`**: novo método `listTemplates(): Promise<{ templateId, name }[]>`
  → `GET /v2.1/accounts/{accountId}/templates`, reusando `getAccessToken()`.
- **`docusign.service.ts`**: expõe `listTemplates()` delegando ao client.
- **`contracts.controller.ts`**: novo `GET /contracts/templates`
  (`@Roles(SPECIALIST, ADMIN)`) → `[{ templateId, name }]`.
- **DTOs** `preview-contract.dto.ts` e `generate-contract.dto.ts`: campo
  opcional `template_id?: string` (`@IsOptional @IsString`).
- **`contracts.service.ts`**:
  - `previewContract` e `generateContract`: usar
    `dto.template_id ?? process.env.DOCUSIGN_TEMPLATE_ID` (fallback preserva
    comportamento atual e nunca quebra chamadas antigas).
  - `sendContractAfterPreview`: gravar o template efetivamente usado no preview
    em `Contract.template_id` e `provider_meta.templateId`. O envelope já foi
    criado no preview com aquele template, então o valor precisa ser o mesmo
    `dto.template_id` — não o env fixo (linha ~1378 hoje lê o env).

Não há validação do `template_id` contra a lista da conta: todos os templates
da conta são nossos, e um `template_id` inválido já falha no próprio DocuSign
com erro tratado. (ponytail: sem allowlist redundante.)

### Frontend

- **`services/contracts.service.ts`**: `listContractTemplates()` →
  `GET /contracts/templates`; incluir `template_id` em `GenerateContractData` /
  `PreviewContractData`.
- **`CreateContractPage.tsx`**:
  - Carregar templates no mount (junto do prefill).
  - Estado `selectedTemplateId`.
  - **Auto-seleção por tipo**: casar `prefillData.product_type` com o nome do
    template (`CAR`→contém "Carro", `BOAT`→"Embarca", `AIRCRAFT`→"Aeronave").
    Se nenhum casar, deixa o dropdown sem seleção.
  - UI: dropdown "Modelo de contrato" no topo do formulário (antes das seções
    de dados), editável. Enquanto `selectedTemplateId` estiver vazio, o botão
    "Pré-visualizar e Enviar" fica desabilitado.
  - Injetar `template_id: selectedTemplateId` no payload de `onPreview`
    (`buildContractData`). O envio pós-preview já reusa `previewFormData`, que
    passa a conter `template_id`.

---

## Feature B — Comissão zerada no DocuSign

### Backend (`buildFormFields`)

Zerar **apenas os valores monetários de comissão** enviados ao DocuSign,
independentemente do que o DTO trouxe:

- `platform_value` → `formatBRL(0)`  · `platform_value_written` → `numberToWords(0)`
- `platform_percentage` → `'0'`
- `commission_office_value` → `formatBRL(0)` · `commission_office_written` → `numberToWords(0)`
- `specialist_value` → `formatBRL(0)` · `specialist_value_written` → `numberToWords(0)`
- flat legado: `commission_value` → `formatBRL(0)` · `commision_value_written` → `numberToWords(0)`

Nomes/CNPJ/dados bancários das partes **não** são zerados (são dados de parte,
não valor de comissão; e some tudo quando o trecho for removido do template).
O cálculo interno (`resolveCommissionFromTotal`) e a persistência no `Contract`
(`platform_value`, `office_value`, `specialist_commission_value`, etc.)
**permanecem intactos** — some só do contrato assinado.

### À prova de remoção

Já garantido pelo mecanismo DocGen (o app itera os campos do template). Apagar
os trechos de comissão do `Template.docx` remove esses campos do
`GET docGenFormFields` → nunca vão no `PUT` → sem erro. Deixar **1 teste** em
`docusign.service.spec.ts` cobrindo `mapFormFieldsToDocGen`:
- (a) um template SEM os campos de comissão + `formFields` COM chaves de
  comissão → o resultado não contém nenhum campo de comissão e não lança;
- (b) chaves extras em `formFields` que não existem no template são ignoradas.

### Frontend (esconder seção de comissão)

Manter os inputs de comissão **registrados e pré-preenchidos pelo prefill**,
apenas ocultá-los (CSS `hidden`), para o backend continuar recebendo os valores
exigidos (`platform_*`, `office_name/cnpj`, `specialist_name/email/document`
são `@IsNotEmpty` no DTO) e gravando o split interno:

- Ocultar as colunas de comissão da seção "Valores da Transação" (Comissão
  Total, Plataforma, Escritório, Especialista) — manter "Valor Total" e "Valor
  Líquido do Vendedor" visíveis.
- Ocultar as seções "Dados da Plataforma", "Dados do Escritório", "Dados do
  Especialista".
- **Remover as regras `required` do react-hook-form** desses campos ocultos
  (senão validação de campo obrigatório bloqueia submit invisível). Os valores
  seguem vindos do prefill; onde o prefill não traz (banco do especialista),
  fica vazio — aceito, pois o backend marca esses como `@IsOptional`.
- `total_commission_rate` continua vindo do prefill (`suggested_total_rate`) num
  input oculto, para o cálculo interno seguir igual.

O auto-cálculo de `payment_seller_value` (preço − comissão) **não muda** nesta
iteração.

---

## Verificação (obrigatória ao final)

- Backend: `npm run lint`, `npm run build`, `npm test -- contracts` e
  `npm test -- docusign` (com `--maxWorkers=2`).
- Frontend: `npm run lint`, `npm run build`.
- QA visual: como o dev-server do Nest não pode subir nesta máquina, validar o
  fluxo do especialista via frontend + mock da API (Playwright), cobrindo:
  dropdown auto-selecionado por tipo, troca de template, seção de comissão
  oculta, submit funcionando.
- Prova de ponta com credenciais demo (script leve, sem Nest): gerar um preview
  real via template escolhido e confirmar `docGenFormFields` de comissão = `0`
  (ou ausentes se o template já foi editado).

## Riscos / notas

- Auto-seleção casa por **nome** do template (IDs mudam por conta/ambiente).
  Se os nomes na conta de produção diferirem, a auto-seleção falha suave
  (dropdown sem seleção) — não quebra, só exige escolha manual.
- 4 draft envelopes de sondagem foram criados na conta demo durante a análise
  (recipients placeholder, nunca enviados) — limpar/ignorar.
