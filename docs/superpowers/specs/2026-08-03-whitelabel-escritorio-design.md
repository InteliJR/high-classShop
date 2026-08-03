# Whitelabel de escritório via `/i/:slug` — Design

**Data:** 2026-08-03
**Status:** Aprovado para plano de implementação

## Problema

Hoje a comissão do escritório é atribuída por **um único caminho**:

```
cliente → consultant (User) → consultant.company_id → office split
```

(`backend/src/features/contracts/contracts.service.ts`, dois call sites: prefill `:259` e resolução final `:496`, ambos via `process.client?.consultant?.company_id`.)

Consequência: **sem consultor, não há comissão de escritório**. Um cliente que chega direto pelo escritório não gera receita para ele.

Queremos que cada escritório tenha um **site whitelabel** (com sua identidade visual) onde o cliente se cadastra e passa a ser cliente daquele escritório — e **qualquer processo que ele gere conta comissão para o escritório, mesmo sem consultor vinculado**.

## Decisões tomadas

1. **Servido como rota `/i/:slug`** no mesmo app (sem DNS/subdomínio/TLS por escritório).
2. **Precedência de comissão:** `client.consultant?.company_id ?? client.company_id`. Consultor tem prioridade; sem consultor, cai no vínculo direto. Comportamento atual intacto.
3. **Escopo desta fatia:** cadastro que vincula o cliente à Company + branding do escritório aplicado em `/i/:slug` e herdado após o login. Sem landing/catálogo dedicados.
4. **Slug auto-gerado** a partir do nome da empresa, editável depois no settings.
5. **Dashboard do OFFICE** ganha botão + modal exibindo a URL do site whitelabel.

## Insight central

A feature é, no fundo, **adicionar um segundo caminho** (`client → company` direto) à resolução de comissão + **um jeito de criar esse vínculo no cadastro**. Branding, `User.company_id`, `Company.color_identity`, `Company.logo` **já existem**.

## Arquitetura

### 1. Modelo de dados — 1 campo novo

```prisma
model Company {
  slug String? @unique  // identificador do whitelabel; url-safe [a-z0-9-]. null = sem whitelabel
}
```

- Nullable **apenas** para a migração não quebrar em colisão improvável durante backfill; na prática **sempre populado pela app** no create.
- `User.company_id` já existe e passa a ser usado também para CUSTOMER (hoje só OFFICE/CONSULTANT/SPECIALIST).
- Clientes existentes (`company_id = null`) se comportam **exatamente como hoje** — zero regressão.

### 2. Coração da feature — fallback de comissão

Em `contracts.service.ts`, nos dois call sites (`:259` e `:496`):

```ts
// antes:  process.client?.consultant?.company_id ?? null
// depois: process.client?.consultant?.company_id ?? process.client?.company_id ?? null
```

`client.company_id` já vem carregado (escalar). **Ganha teste unitário obrigatório** (caminho de dinheiro): cliente com `company_id`, sem consultor → office split resolvido corretamente.

### 3. Auto-geração de slug

Helper de string pura (sem lib), rodando no create da Company:

1. Normaliza o nome: minúsculas, remove acentos (`normalize('NFD')` + strip diacríticos), troca não-alfanumérico por `-`, colapsa hífens repetidos, tira hífen das pontas. Ex: `"Escritório Alpha & Co"` → `escritorio-alpha-co`.
2. Garante unicidade: se já existe, sufixa `-2`, `-3`… (checagem por `count`/`findUnique` em loop).

- Migração faz **backfill** dos escritórios existentes.
- OFFICE/ADMIN pode **editar** o slug no settings da empresa, com a mesma validação `^[a-z0-9-]+$` + checagem de unicidade.
- Ganha teste unitário do helper (normalização + colisão → sufixo).

### 4. Endpoint público de branding

```
GET /api/companies/by-slug/:slug   @Public()
→ { id, name, logoUrl, color_identity }
```

Reusa `resolveCompanyLogoUrl`. Consumido pela página `/i/:slug` para pintar cores/logo antes do login. 404 se o slug não existir.

### 5. Vínculo no cadastro

- `UserRegisterDto` ganha `company_slug?: string` opcional.
- No `register`: se `company_slug` resolve para uma Company existente, seta `company_id` no novo CUSTOMER. Se **não** resolve, cadastra mesmo assim sem vínculo (não quebra o signup).
- Slug resolvido **no servidor** — não confiamos em `company_id` cru vindo do cliente.
- Nota de segurança: atribuir-se a um escritório é inofensivo (só faz aquele escritório receber comissão de vendas do próprio cliente; plataforma e especialista mantêm seus cortes). Não requer proteção adicional.

### 6. Frontend — rota `/i/:slug`

- Rota **pública** que faz `GET /companies/by-slug/:slug` e guarda a empresa num estado leve de "whitelabel ativo".
- `ThemeProvider` / `getUserCompany` ganham fallback: `user.company ?? user.consultant?.company ?? whitelabelCompany`. Visitante anônimo já vê o branding do escritório.
- A página aplica o branding e leva ao **catálogo existente** (herda branding) + CTA de cadastro que carrega o `slug` → `register({ company_slug })`.
- Após login, o branding funciona sozinho (usuário tem `company_id`; `getUserWithBranding` já lê `user.company` primeiro).

### 7. Visibilidade no OFFICE (dashboard) + botão/modal do site whitelabel

**Listagens** — `backend/src/features/office/office.service.ts` (`:74` clientes, `:81` processos) passam a incluir o vínculo direto:

```ts
role: CUSTOMER, OR: [{ consultant: { company_id } }, { company_id }]
// processos:
client: { OR: [{ consultant: { company_id } }, { company_id }] }
```

**Botão + modal "Meu site do escritório"** no dashboard do OFFICE:

- Botão abre modal exibindo a URL completa: `${window.location.origin}/i/${slug}`.
- Ações: **copiar** e **abrir**. Sem QR/preview (YAGNI).
- `slug` vem do usuário logado — incluir `slug` no `select` de `getUserWithBranding` (`auth.service.ts:221`) para chegar em `user.company.slug`.

> ⚠️ **Identidade visual da PLATAFORMA neste botão/modal.**
> O dashboard do OFFICE é tematizado com a cor do **próprio escritório** (`var(--brand-primary)` é sobrescrito por `ThemeProvider` a partir do `company_id` do usuário OFFICE). Este botão/modal representa **a plataforma** (é gestão da plataforma, não conteúdo do escritório), então **NÃO usa `var(--brand-*)`** — usa as cores **fixas** da plataforma (`DEFAULT_BRAND_PRIMARY = "#3C3C3C"`, `DEFAULT_BRAND_SECONDARY = "#1C1C1C"` de `frontend/src/utils/branding.ts`, ou um token dedicado `--platform-primary`).
> Regra geral: **qualquer UI platform-owned usa a identidade visual fixa da plataforma, nunca o brand tematizado do tenant.** O whitelabel `/i/:slug` é o oposto: ali aplica-se o brand DO ESCRITÓRIO — esse é o objetivo dele.

## Fora de escopo (YAGNI)

- ❌ DNS/subdomínio/TLS por escritório.
- ❌ Landing/catálogo whitelabel dedicados.
- ❌ Comissão para o consultor (regra de negócio: consultor não recebe nesta plataforma).
- ❌ QR code / preview do site no modal.

## Superfície de arquivos

**Backend:**
- `prisma/schema.prisma` (+ migração com backfill de slug)
- `features/contracts/contracts.service.ts` (fallback de comissão, 2 linhas + teste)
- `auth/dto/auth.ts` (`company_slug` no `UserRegisterDto`)
- `auth/auth.service.ts` (`register` seta `company_id`; `slug` no `select` de `getUserWithBranding`)
- `features/companies/companies.controller.ts` + `.service.ts` (endpoint `by-slug`, helper de auto-slug + teste)
- `features/office/office.service.ts` (OR nas queries de clientes/processos)

**Frontend:**
- `routes/routes.tsx` (rota pública `/i/:slug`)
- nova página whitelabel + estado leve de "whitelabel ativo"
- `utils/branding.ts` + `contexts/ThemeProvider.tsx` (fallback whitelabelCompany)
- form de cadastro (envia `company_slug`)
- dashboard OFFICE: botão + modal "Meu site do escritório" (com identidade da plataforma)
- settings da empresa: campo `slug` editável (OFFICE/ADMIN)

## Testes-chave

1. **Comissão (backend, unit):** cliente com `company_id` e sem consultor → office split resolve para a company do cliente.
2. **Auto-slug (backend, unit):** normalização (acentos/espaços/símbolos) + colisão gera sufixo incremental.
3. **Registro (backend):** `company_slug` válido vincula CUSTOMER; slug inválido cadastra sem vínculo.
