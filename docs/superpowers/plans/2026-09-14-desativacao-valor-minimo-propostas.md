# Desativação do valor mínimo de propostas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar impossível ativar ou exibir o valor mínimo de propostas, preservando o código de suporte e mantendo o filtro de preço mínimo do catálogo.

**Architecture:** O backend terá uma trava de disponibilidade fixa e recusará tentativas administrativas de ativação, enquanto uma migração alinhará dados legados para `false`. O frontend terá uma trava equivalente na camada compartilhada de apresentação e removerá os pontos visuais e administrativos da funcionalidade, mantendo os campos de contrato e o cálculo disponíveis.

**Tech Stack:** NestJS 11, Prisma 6/PostgreSQL, Jest 30, React 19, TypeScript 5, Vitest 4 e Testing Library.

## Global Constraints

- Partir do commit mais recente da branch remota `origin/develop`.
- `minimum_proposal_enabled=true` nunca pode ativar a regra, mesmo se já estiver persistido no banco.
- Nenhuma tela de negociação ou configuração administrativa pode mostrar valor mínimo, percentual mínimo ou controle de ativação.
- O suporte técnico de cálculo, tipos e chaves deve permanecer no código.
- O filtro “Preço mínimo” do catálogo deve permanecer inalterado.
- Executar Jest com `--runInBand` e Vitest com no máximo dois forks; não executar suítes pesadas em paralelo.
- Preservar o arquivo local não rastreado `PROJECT-OVERVIEW.md`.

---

### Task 1: Trava imutável e proteção da configuração no backend

**Files:**
- Modify: `backend/src/features/settings/settings.service.spec.ts`
- Modify: `backend/src/features/settings/settings.service.ts`
- Create: `backend/prisma/migrations/20260914120000_disable_minimum_proposal/migration.sql`

**Interfaces:**
- Consumes: `SettingKey.MINIMUM_PROPOSAL_ENABLED` e o modelo Prisma `Settings` existentes.
- Produces: `MINIMUM_PROPOSAL_FEATURE_AVAILABLE: boolean`, `SettingsService.isMinimumProposalEnabled(): Promise<boolean>` sempre falso enquanto a trava estiver desligada, e rejeição de `update(key, "true")` para a chave de ativação.

- [ ] **Step 1: Escrever os testes que demonstram a impossibilidade de ativação**

Adicionar a `backend/src/features/settings/settings.service.spec.ts`:

```ts
describe('SettingsService minimum proposal availability', () => {
  function setup(storedValue = 'true') {
    const findUnique = jest.fn().mockResolvedValue({
      key: SettingKey.MINIMUM_PROPOSAL_ENABLED,
      value: storedValue,
      description: null,
    });
    const upsert = jest.fn().mockResolvedValue({
      key: SettingKey.MINIMUM_PROPOSAL_ENABLED,
      value: 'false',
      description: null,
    });
    const service = new SettingsService({
      settings: { findUnique, upsert },
    } as any);

    return { service, findUnique, upsert };
  }

  it('permanece desligado mesmo quando o banco contém true', async () => {
    const { service, findUnique } = setup('true');

    await expect(service.isMinimumProposalEnabled()).resolves.toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('recusa tentativa administrativa de ativação', async () => {
    const { service, upsert } = setup();

    await expect(
      service.update(SettingKey.MINIMUM_PROPOSAL_ENABLED, 'true'),
    ).rejects.toMatchObject({
      response: {
        error: {
          code: 400,
          message: 'A validação de valor mínimo de propostas está indisponível',
        },
      },
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('permite persistir explicitamente o estado desligado', async () => {
    const { service, upsert } = setup();

    await expect(
      service.update(SettingKey.MINIMUM_PROPOSAL_ENABLED, 'false'),
    ).resolves.toMatchObject({ value: 'false' });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { value: 'false' },
        create: expect.objectContaining({ value: 'false' }),
      }),
    );
  });
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha correta**

Run:

```bash
cd backend && npm test -- src/features/settings/settings.service.spec.ts --runInBand
```

Expected: FAIL nos casos que esperam retorno `false` sem consulta e rejeição de atualização para `true`; o serviço atual lê `true` do banco e faz `upsert`.

- [ ] **Step 3: Implementar a trava mínima no serviço**

Em `backend/src/features/settings/settings.service.ts`, exportar a disponibilidade perto do enum:

```ts
export const MINIMUM_PROPOSAL_FEATURE_AVAILABLE: boolean = false;
```

No início de `update`, antes da validação percentual, adicionar:

```ts
if (
  key === SettingKey.MINIMUM_PROPOSAL_ENABLED &&
  value === 'true'
) {
  throw new BadRequestException({
    success: false,
    error: {
      code: 400,
      message: 'A validação de valor mínimo de propostas está indisponível',
      details: { key, requested_value: value },
    },
  });
}
```

Fazer `isMinimumProposalEnabled` retornar antes de consultar configurações:

```ts
async isMinimumProposalEnabled(
  client: PrismaService | Prisma.TransactionClient = this.prisma,
): Promise<boolean> {
  if (!MINIMUM_PROPOSAL_FEATURE_AVAILABLE) {
    return false;
  }

  try {
    const setting = await this.findByKey(
      SettingKey.MINIMUM_PROPOSAL_ENABLED,
      client,
    );
    return setting.value === 'true';
  } catch {
    return true;
  }
}
```

Manter `getMinimumProposalPercentage` e suas validações intactos como suporte dormente.

- [ ] **Step 4: Alinhar dados legados sem depender da migração como trava**

Criar `backend/prisma/migrations/20260914120000_disable_minimum_proposal/migration.sql`:

```sql
UPDATE "Settings"
SET
  "value" = 'false',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'minimum_proposal_enabled';
```

- [ ] **Step 5: Executar os testes focados e verificar o SQL**

Run:

```bash
cd backend && npm test -- src/features/settings/settings.service.spec.ts src/features/proposals/proposals.service.spec.ts --runInBand
```

Expected: PASS; incluindo o teste existente “aceita qualquer proposta positiva e não busca percentual quando o mínimo está desligado”.

Run:

```bash
rg -n "minimum_proposal_enabled|value.*false" prisma/migrations/20260914120000_disable_minimum_proposal/migration.sql
```

Expected: a migração contém a chave correta e persiste `false`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/features/settings/settings.service.spec.ts backend/src/features/settings/settings.service.ts backend/prisma/migrations/20260914120000_disable_minimum_proposal/migration.sql
git commit -m "fix: bloqueia valor minimo de propostas"
```

---

### Task 2: Trava de apresentação e limpeza de erros legados no frontend

**Files:**
- Modify: `frontend/src/lib/negotiation-money.test.ts`
- Modify: `frontend/src/lib/negotiation-money.ts`

**Interfaces:**
- Consumes: `MinimumSource` com `currency`, `minimum_enabled` e `minimum_value` vindo da API.
- Produces: `getMinimumPresentation(source)` sempre invisível enquanto `MINIMUM_PROPOSAL_PRESENTATION_AVAILABLE` for falso; `normalizeMinimumFormError(error, source)` remove mensagens legadas de mínimo mesmo se a resposta antiga trouxer a flag ativa.

- [ ] **Step 1: Alterar os testes para exigir apresentação sempre desligada**

Substituir o caso que hoje formata um mínimo ativo em `frontend/src/lib/negotiation-money.test.ts` por:

```ts
it('hides minimum even when an outdated API marks it as enabled', () => {
  expect(
    getMinimumPresentation({
      currency: 'USD',
      minimum_enabled: true,
      minimum_value: 80000,
    }),
  ).toEqual({ visible: false, formattedValue: null });
});
```

Adicionar ao bloco de normalização:

```ts
it('clears a legacy minimum error even when an outdated API enables it', () => {
  expect(
    normalizeMinimumFormError(
      'O valor mínimo permitido é US$ 80.000,00.',
      {
        currency: 'USD',
        minimum_enabled: true,
        minimum_value: 80000,
      },
    ),
  ).toBeNull();
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha correta**

Run:

```bash
cd frontend && npm test -- src/lib/negotiation-money.test.ts --pool=forks --maxWorkers=2
```

Expected: FAIL porque `getMinimumPresentation` ainda retorna `visible: true` quando a API antiga envia a funcionalidade ativa.

- [ ] **Step 3: Implementar a trava local preservando o suporte**

Em `frontend/src/lib/negotiation-money.ts`, adicionar:

```ts
export const MINIMUM_PROPOSAL_PRESENTATION_AVAILABLE: boolean = false;
```

Atualizar a primeira condição de `getMinimumPresentation`:

```ts
if (
  !MINIMUM_PROPOSAL_PRESENTATION_AVAILABLE ||
  !source.minimum_enabled ||
  source.minimum_value === null
) {
  return { visible: false, formattedValue: null };
}
```

Manter o ramo de formatação existente depois da condição para preservar o suporte técnico.

- [ ] **Step 4: Executar o teste e confirmar sucesso**

Run:

```bash
cd frontend && npm test -- src/lib/negotiation-money.test.ts --pool=forks --maxWorkers=2
```

Expected: PASS em todos os testes de apresentação, erro e validação positiva.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/negotiation-money.test.ts frontend/src/lib/negotiation-money.ts
git commit -m "fix: oculta apresentacao do valor minimo"
```

---

### Task 3: Remoção de todos os pontos visuais de negociação e administração

**Files:**
- Create: `frontend/src/pages/minimum-proposal-ui.test.ts`
- Modify: `frontend/src/pages/admin/SettingsPage.tsx`
- Modify: `frontend/src/pages/negotiation/NegotiationPage.tsx`
- Modify: `frontend/src/pages/consultant/ConsultantProcessDetailPage.tsx`

**Interfaces:**
- Consumes: `normalizeMinimumFormError(error, processInfo)` da Task 2 para filtrar erros de servidores antigos.
- Produces: páginas sem rótulos, dicas ou controles de valor mínimo; o catálogo preserva o rótulo `Preço mínimo`.

- [ ] **Step 1: Criar um teste estrutural que proteja todas as superfícies visuais**

Criar `frontend/src/pages/minimum-proposal-ui.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import settingsPageSource from './admin/SettingsPage.tsx?raw';
import catalogPageSource from './catalog/CatalogPage.tsx?raw';
import consultantPageSource from './consultant/ConsultantProcessDetailPage.tsx?raw';
import negotiationPageSource from './negotiation/NegotiationPage.tsx?raw';

const proposalPages = [
  ['./admin/SettingsPage.tsx', settingsPageSource],
  ['./negotiation/NegotiationPage.tsx', negotiationPageSource],
  ['./consultant/ConsultantProcessDetailPage.tsx', consultantPageSource],
] as const;

describe('minimum proposal UI', () => {
  it.each(proposalPages)('does not expose minimum proposal copy in %s', (_path, source) => {
    expect(source).not.toMatch(
      /valor mínimo|mínimo aceito|porcentagem mínima|minimumProposalEnabled|minimumProposalPercentage/i,
    );
  });

  it('keeps the independent minimum price catalog filter', () => {
    expect(catalogPageSource).toContain('Preço mínimo');
  });
});
```

- [ ] **Step 2: Executar o teste e confirmar que as três páginas falham**

Run:

```bash
cd frontend && npm test -- src/pages/minimum-proposal-ui.test.ts --pool=forks --maxWorkers=2
```

Expected: FAIL para `SettingsPage.tsx`, `NegotiationPage.tsx` e `ConsultantProcessDetailPage.tsx`; o caso do catálogo passa.

- [ ] **Step 3: Remover os controles administrativos e carregamento associado**

Em `frontend/src/pages/admin/SettingsPage.tsx`:

- Remover `Save` da importação de ícones.
- Remover `getSettings`, `updateSetting` e as funções de conversão de porcentagem das importações.
- Remover os estados `isLoading`, `isSaving`, `minimumProposalEnabled` e `minimumProposalPercentage`.
- Remover o efeito `loadSettings`, `handleToggleMinimumProposal` e `handleSavePercentage`.
- Remover integralmente o card “Configurações de Propostas”.
- Remover o ternário de carregamento que existia apenas para essas configurações e renderizar diretamente o card do Google Meet dentro de `<div className="space-y-6">`.
- Preservar toda a lógica, mensagens e controles do Google Meet.

O início das importações deve ficar equivalente a:

```ts
import { useState, useEffect } from 'react';
import { Settings, Check, AlertCircle, Video, X, Loader2 } from 'lucide-react';
```

- [ ] **Step 4: Remover informações e dicas nas duas páginas de negociação**

Em `NegotiationPage.tsx` e `ConsultantProcessDetailPage.tsx`:

- Remover `getMinimumPresentation` da importação.
- Remover a constante local `minimum`.
- Remover o bloco com o rótulo `Valor mínimo:`.
- Remover a dica abaixo do formulário com `valor mínimo aceito`.
- Manter `normalizeMinimumFormError` para compatibilidade com erros de servidores antigos.
- Nos blocos `catch` de envio, normalizar a mensagem antes de chamar `setFormError`:

```ts
const message =
  err instanceof Error ? err.message : 'Erro ao enviar proposta';
setFormError(normalizeMinimumFormError(message, processInfo));
```

Na página do consultor, preservar o ponto final da mensagem genérica existente:

```ts
const message =
  err instanceof Error ? err.message : 'Erro ao enviar proposta.';
setFormError(normalizeMinimumFormError(message, processInfo));
```

- [ ] **Step 5: Executar os testes focados e confirmar sucesso**

Run:

```bash
cd frontend && npm test -- src/lib/negotiation-money.test.ts src/pages/minimum-proposal-ui.test.ts --pool=forks --maxWorkers=2
```

Expected: PASS; nenhuma das três páginas contém cópia ou controles de proposta mínima, e o catálogo ainda contém `Preço mínimo`.

- [ ] **Step 6: Verificar TypeScript e lint apenas nos arquivos alterados**

Run:

```bash
cd frontend && npx eslint src/lib/negotiation-money.ts src/lib/negotiation-money.test.ts src/pages/minimum-proposal-ui.test.ts src/pages/admin/SettingsPage.tsx src/pages/negotiation/NegotiationPage.tsx src/pages/consultant/ConsultantProcessDetailPage.tsx
```

Expected: exit code 0 sem erros.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/negotiation-money.ts frontend/src/lib/negotiation-money.test.ts frontend/src/pages/minimum-proposal-ui.test.ts frontend/src/pages/admin/SettingsPage.tsx frontend/src/pages/negotiation/NegotiationPage.tsx frontend/src/pages/consultant/ConsultantProcessDetailPage.tsx
git commit -m "fix: remove valor minimo da interface"
```

---

### Task 4: Verificação integrada e auditoria do escopo

**Files:**
- Verify only: all files modified in Tasks 1–3.

**Interfaces:**
- Consumes: backend travado, frontend sem apresentação e migração de dados.
- Produces: evidência de testes, builds e auditoria textual sem regressão no catálogo.

- [ ] **Step 1: Conferir memória disponível e executar a suíte completa do backend de forma serial**

Run:

```bash
free -h
cd backend && npm test -- --runInBand
```

Expected: memória suficiente para uma suíte serial; todos os testes PASS.

- [ ] **Step 2: Executar a suíte completa do frontend com dois forks**

Run:

```bash
cd frontend && npm test -- --pool=forks --maxWorkers=2
```

Expected: todos os testes PASS, incluindo a proteção do filtro do catálogo.

- [ ] **Step 3: Compilar backend e frontend sequencialmente**

Run:

```bash
npm run build:backend
npm run build:frontend
```

Expected: ambos os builds terminam com exit code 0; não executar os dois comandos em paralelo.

- [ ] **Step 4: Auditar textos e contratos remanescentes**

Run:

```bash
rg -n -i "valor mínimo|mínimo aceito|porcentagem mínima|minimumProposalEnabled|minimumProposalPercentage" frontend/src/pages -g '!minimum-proposal-ui.test.ts'
```

Expected: nenhum resultado.

Run:

```bash
rg -n "Preço mínimo" frontend/src/pages/catalog/CatalogPage.tsx
```

Expected: o rótulo do filtro do catálogo continua presente.

Run:

```bash
rg -n "calculateMinimumProposalValue|MINIMUM_PROPOSAL_PERCENTAGE|minimum_enabled|minimum_value" backend/src frontend/src/services frontend/src/lib
```

Expected: cálculo, chave, campos do contrato e suporte de apresentação continuam presentes.

- [ ] **Step 5: Revisar o diff e o estado final sem incluir arquivos locais alheios**

Run:

```bash
git diff --check
git status --short
git log --oneline origin/develop..HEAD
```

Expected: nenhum erro de whitespace; somente mudanças planejadas e `PROJECT-OVERVIEW.md` ainda não rastreado; histórico contém os commits da especificação, plano e implementação.
