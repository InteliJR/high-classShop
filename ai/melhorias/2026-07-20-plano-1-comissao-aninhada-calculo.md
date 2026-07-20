# Comissão aninhada — Plano 1: cálculo do split (backend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o cálculo do split de comissão de "resíduo sobre a venda" para o modelo **aninhado** (fatia do especialista sobre o bolo; escritório e plataforma sobre o restante), isolando a matemática numa função pura testável.

**Architecture:** Extrair a conta pura (sem Prisma) para `commission-split.ts` com teste unitário rápido; `resolveCommissionFromTotal` passa a consumir essa função e para de calcular o especialista como resíduo. `calculateCommissionSplit` continua resolvendo as taxas cadastradas (a troca da fonte especialista→consultor é o **Plano 2**, fora daqui).

**Tech Stack:** NestJS, Prisma, Jest (rodar com `--runInBand` ou `--maxWorkers=2` nesta máquina).

## Global Constraints

- Percentuais em `Decimal(5,2)` (0–100). `total_commission_rate` já é `@Min(0) @Max(100)`.
- As três fatias (especialista + escritório + plataforma) somam **exatamente o bolo** — sem drift de centavos.
- Escritório opcional: sem escritório, o restante vai 100% pra plataforma.
- Não commitar sem o usuário pedir. Rodar Jest com paralelismo limitado (`--runInBand`).

## Contexto do roadmap (referência — não implementar aqui)

Este é o **Plano 1 de ~6**. Sequência sugerida:

1. **Cálculo aninhado (este plano)** — a conta pura + wiring no `resolveCommissionFromTotal`.
2. **Reamarrar escritório→consultor** — resolver a company via `cliente → consultant_id → company_id` (hoje usa `specialist.company_id`). *Decisão em aberto:* usar `User.consultant_id` ou `CustomerAdvisor.advisor_id` como vínculo autoritativo.
3. **Cadastros de fatia + permissões** — semântica dos campos (`User.commission_rate` = fatia % do bolo; `Company.commission_rate` = fatia % do restante) + telas de cadastro ADMIN-only.
4. **Aba de comissões + "escadinha"** — visão por processo do repasse de cada parte.
5. **Base analítica + export CSV/PDF** — planilha filtrada por papel.
6. **Melhorias soltas** — produto pós-consultoria (item 1), dashboard consolidado (item 5), aba de escritório com clientes por consultor (item 6).

Os planos 2–6 serão detalhados quando chegarmos neles (dependem de decisões/telas adiadas no spec).

---

### Task 1: Função pura do split aninhado

**Files:**
- Create: `backend/src/features/contracts/commission-split.ts`
- Test: `backend/src/features/contracts/commission-split.spec.ts`

**Interfaces:**
- Produces:
  - `computeNestedCommissionSplit(input: NestedCommissionInput): NestedCommissionSplit`
  - `interface NestedCommissionInput { proposalValue: number; totalCommissionRate: number; specialistShareRate: number; officeShareRate: number }`
  - `interface NestedCommissionSplit { bolo: number; specialistValue: number; officeValue: number; platformValue: number }`

- [ ] **Step 1: Escrever o teste que falha**

Create `backend/src/features/contracts/commission-split.spec.ts`:

```ts
import { computeNestedCommissionSplit } from './commission-split';

describe('computeNestedCommissionSplit', () => {
  it('divide bolo em especialista / escritório / plataforma (aninhado)', () => {
    const r = computeNestedCommissionSplit({
      proposalValue: 100_000,
      totalCommissionRate: 10, // bolo = 10.000
      specialistShareRate: 70, // 70% do bolo
      officeShareRate: 40, // 40% do restante
    });
    expect(r.bolo).toBe(10_000);
    expect(r.specialistValue).toBe(7_000);
    expect(r.officeValue).toBe(1_200); // 40% de 3.000
    expect(r.platformValue).toBe(1_800); // resto do restante
  });

  it('sem escritório: restante inteiro vai pra plataforma', () => {
    const r = computeNestedCommissionSplit({
      proposalValue: 100_000,
      totalCommissionRate: 10,
      specialistShareRate: 70,
      officeShareRate: 0,
    });
    expect(r.officeValue).toBe(0);
    expect(r.platformValue).toBe(3_000);
  });

  it('as três fatias somam exatamente o bolo (sem drift de centavos)', () => {
    const r = computeNestedCommissionSplit({
      proposalValue: 99_999.99,
      totalCommissionRate: 7.33,
      specialistShareRate: 63.5,
      officeShareRate: 41.7,
    });
    expect(r.specialistValue + r.officeValue + r.platformValue).toBe(r.bolo);
  });

  it('especialista com 100% do bolo zera escritório e plataforma', () => {
    const r = computeNestedCommissionSplit({
      proposalValue: 50_000,
      totalCommissionRate: 8,
      specialistShareRate: 100,
      officeShareRate: 50,
    });
    expect(r.specialistValue).toBe(r.bolo);
    expect(r.officeValue).toBe(0);
    expect(r.platformValue).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx jest commission-split --runInBand`
Expected: FAIL — `Cannot find module './commission-split'`.

- [ ] **Step 3: Implementar a função pura**

Create `backend/src/features/contracts/commission-split.ts`:

```ts
export interface NestedCommissionInput {
  /** Valor de referência da venda (proposta aceita ou preço do produto). */
  proposalValue: number;
  /** % da venda que o especialista define e vira o "bolo" (0–100). */
  totalCommissionRate: number;
  /** Fatia do especialista SOBRE O BOLO (0–100). */
  specialistShareRate: number;
  /** Fatia do escritório SOBRE O RESTANTE (0–100); 0 quando não há escritório. */
  officeShareRate: number;
}

export interface NestedCommissionSplit {
  bolo: number;
  specialistValue: number;
  officeValue: number;
  platformValue: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Split aninhado da comissão:
 *   bolo         = venda × total%
 *   especialista = bolo × fatiaEspecialista%
 *   restante     = bolo − especialista
 *   escritório   = restante × fatiaEscritório%
 *   plataforma   = restante − escritório   (resíduo → soma sempre bate no bolo)
 *
 * A plataforma absorve o resíduo de arredondamento do restante e o restante é
 * derivado de `bolo − especialista`, então especialista + escritório + plataforma
 * = bolo exatamente, sem drift de centavos.
 */
export function computeNestedCommissionSplit(
  input: NestedCommissionInput,
): NestedCommissionSplit {
  const bolo = round2((input.proposalValue * input.totalCommissionRate) / 100);
  const specialistValue = round2((bolo * input.specialistShareRate) / 100);
  const restante = round2(bolo - specialistValue);
  const officeValue = round2((restante * input.officeShareRate) / 100);
  const platformValue = round2(restante - officeValue);
  return { bolo, specialistValue, officeValue, platformValue };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx jest commission-split --runInBand`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit** (só se o usuário autorizar commits)

```bash
git add backend/src/features/contracts/commission-split.ts backend/src/features/contracts/commission-split.spec.ts
git commit -m "feat(comissoes): função pura do split aninhado"
```

---

### Task 2: Ligar `resolveCommissionFromTotal` ao split aninhado

**Files:**
- Modify: `backend/src/features/contracts/contracts.service.ts:464-537` (`resolveCommissionFromTotal`)

**Interfaces:**
- Consumes: `computeNestedCommissionSplit` (Task 1); `calculateCommissionSplit(...)` que já retorna `{ officeRate, specialistRate, ... }` (reinterpretados: `specialistRate` = fatia do especialista sobre o bolo; `officeRate` = fatia do escritório sobre o restante).
- Produces: `resolveCommissionFromTotal` mantém a MESMA assinatura de retorno `{ platformRate, officeRate, specialistRate, platformValue, officeValue, specialistValue }` — os callers (geração/contrato) não mudam.

- [ ] **Step 1: Importar a função pura no topo de `contracts.service.ts`**

Adicionar junto aos imports existentes do módulo:

```ts
import { computeNestedCommissionSplit } from './commission-split';
```

- [ ] **Step 2: Substituir o corpo do cálculo em `resolveCommissionFromTotal`**

Trocar o bloco de validação de piso + cálculo de resíduo (linhas ~496-536, do `const round2 = ...` até o `return { ... }`) por:

```ts
    const proposalValue = process.accepted_proposal
      ? Number(process.accepted_proposal.proposed_value)
      : Number(
          process.car?.valor ??
            process.boat?.valor ??
            process.aircraft?.valor ??
            0,
        );

    if (proposalValue <= 0) {
      throw new BadRequestException(
        'Processo sem proposta aceita e sem produto associado — não é possível calcular a comissão.',
      );
    }

    // Modelo aninhado: especialista = fatia do bolo; escritório = fatia do
    // restante; plataforma = o que sobra do restante. Ver commission-split.ts.
    const split = computeNestedCommissionSplit({
      proposalValue,
      totalCommissionRate,
      specialistShareRate: specialistRate,
      officeShareRate: officeRate,
    });

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const effectiveRate = (value: number) =>
      proposalValue > 0 ? round2((value / proposalValue) * 100) : 0;

    return {
      // Taxas efetivas sobre a venda (para o documento do contrato)
      platformRate: effectiveRate(split.platformValue),
      officeRate: effectiveRate(split.officeValue),
      specialistRate: effectiveRate(split.specialistValue),
      platformValue: split.platformValue,
      officeValue: split.officeValue,
      specialistValue: split.specialistValue,
    };
```

Isso **remove** a validação `lockedFloor` (`totalCommissionRate < platformRate + officeRate`) e o `specialistRate = total - platform - office` (resíduo), que não existem mais no modelo aninhado.

> Nota: `specialistRate` obtido de `calculateCommissionSplit` passa a ser lido como **fatia do especialista sobre o bolo**; `officeRate` como **fatia do escritório sobre o restante**. Os campos de banco (`User.commission_rate`, `Company.commission_rate`) não mudam de tipo — muda a interpretação. A troca da FONTE do escritório (especialista→consultor) é o Plano 2.

- [ ] **Step 3: Ajustar a busca de taxas destruturada no início do método**

No começo de `resolveCommissionFromTotal`, a linha que hoje é:

```ts
    const { platformRate, officeRate } = await this.calculateCommissionSplit(
      process.specialist,
      platformCompany,
    );
```

passa a precisar também de `specialistRate`:

```ts
    const { officeRate, specialistRate } = await this.calculateCommissionSplit(
      process.specialist,
      platformCompany,
    );
```

(`platformRate` do cadastro não é mais usado — a plataforma é derivada.)

- [ ] **Step 4: Compilar e checar tipos**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros. (Se `platformCompany` ficar sem uso, remover a variável correspondente ou manter se ainda alimenta `calculateCommissionSplit`.)

- [ ] **Step 5: Teste de fumaça do wiring**

Adicionar em `commission-split.spec.ts` um teste que documenta a taxa efetiva usada no retorno:

```ts
it('taxa efetiva sobre a venda = valor / venda × 100', () => {
  const r = computeNestedCommissionSplit({
    proposalValue: 100_000,
    totalCommissionRate: 10,
    specialistShareRate: 70,
    officeShareRate: 40,
  });
  const effective = (v: number) => Math.round((v / 100_000) * 100 * 100) / 100;
  expect(effective(r.specialistValue)).toBe(7); // 7% da venda
  expect(effective(r.officeValue)).toBe(1.2);
  expect(effective(r.platformValue)).toBe(1.8);
});
```

Run: `cd backend && npx jest commission-split --runInBand`
Expected: PASS.

- [ ] **Step 6: Lint + build**

Run: `cd backend && npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 7: Commit** (só se autorizado)

```bash
git add backend/src/features/contracts/contracts.service.ts backend/src/features/contracts/commission-split.spec.ts
git commit -m "feat(comissoes): resolveCommissionFromTotal usa split aninhado"
```

---

### Task 3: Ajustar o prefill para não exibir taxas enganosas

**Files:**
- Modify: `backend/src/features/contracts/contracts.service.ts:247-338` (método de prefill/preview)

**Interfaces:**
- Consumes: `calculateCommissionSplit` (retorna `specialistRate` = fatia do bolo, `officeRate` = fatia do restante).
- Produces: sem mudança de assinatura pública; ajusta apenas os valores/taxas "sugeridos" retornados no prefill.

- [ ] **Step 1: Neutralizar o cálculo de valores %-da-venda no prefill**

Hoje (linhas ~270-276) o prefill multiplica `rate × proposalValue / 100` tratando as taxas como % da venda — o que ficou **incorreto** no modelo aninhado (agora são fatias do bolo/restante e o bolo depende do total que o especialista ainda vai digitar). Como o prefill é só sugestão (a conta autoritativa é `resolveCommissionFromTotal`), zerar os valores sugeridos e devolver apenas as fatias:

```ts
    // No modelo aninhado, os valores dependem da comissão total que o
    // especialista ainda vai digitar no formulário — o prefill devolve só as
    // fatias cadastradas, sem valores calculados.
    const platformValue = 0;
    const officeValue = 0;
    const specialistValue = 0;
```

- [ ] **Step 2: Ajustar `suggested_total_rate`**

A linha `suggested_total_rate: platformRate + officeRate + specialistRate` soma coisas de bases diferentes no modelo novo. Trocar por um default neutro (o especialista define o total na tela):

```ts
      suggested_total_rate: 0,
```

- [ ] **Step 3: Compilar**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros (se `platformValue`/`officeValue`/`specialistValue` viram constantes, garantir que `Math.round(... * 100) / 100` ainda recebe número — recebe, é `0`).

- [ ] **Step 4: Build**

Run: `cd backend && npm run build`
Expected: sem erros.

- [ ] **Step 5: Commit** (só se autorizado)

```bash
git add backend/src/features/contracts/contracts.service.ts
git commit -m "fix(comissoes): prefill não sugere valores %-da-venda no modelo aninhado"
```

---

## Self-review (cobertura do spec — só a parte deste plano)

- ✅ Modelo aninhado (spec §2): Task 1 (conta pura) + Task 2 (wiring).
- ✅ Soma exata = bolo (spec §2): teste em Task 1.
- ✅ Escritório opcional → 100% plataforma (spec §2): teste em Task 1.
- ✅ Único campo editável na venda é o total (spec §3): `total_commission_rate` segue sendo a única entrada; fatias vêm do cadastro. Task 2/3.
- ⏭️ Reamarrar escritório→consultor (spec §7) → **Plano 2**.
- ⏭️ Semântica/telas de cadastro das fatias (spec §3) → **Plano 3**.
- ⏭️ Aba de comissões, escadinha, base analítica, export (spec §5) → **Planos 4–5**.
- ⏭️ Itens 1/5/6 (spec §4, §6) → **Plano 6**.

## Riscos

- **Reinterpretação de dados existentes:** `User.commission_rate` e `Company.commission_rate` mudam de significado (% da venda → fatia do bolo/restante). Valores cadastrados hoje passam a significar outra coisa. Como as fatias são cadastro ADMIN e o recurso é novo, tratar como reconfiguração manual (spec §8 marcou migração como fora de escopo) — confirmar com o ADMIN antes de subir.
- **Contrato:** os campos snapshot do `Contract` (`platform_percentage`, `specialist_commission_rate`, valores) continuam sendo preenchidos pelo retorno de `resolveCommissionFromTotal`; conferir no fluxo de geração que nada mais dependia do piso removido.
