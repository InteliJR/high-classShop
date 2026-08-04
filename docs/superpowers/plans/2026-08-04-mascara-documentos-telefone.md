# Máscara de CPF/CNPJ/RG/Telefone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar e aplicar máscara de exibição (pontuação) em todos os campos de CPF/CNPJ/RG/telefone da plataforma — sempre pontuado na tela, sempre sem pontuação no banco, nunca com dígitos ocultos — e corrigir o bug do `CreateContractPage` que hoje envia documentos pontuados para o backend.

**Architecture:** Um único módulo `frontend/src/utils/mask.ts` concentra as funções puras de máscara (mesma função serve para "enquanto digita" e para "exibir valor salvo", pois ambas são apenas formatação de uma string de dígitos). Cada tela consumidora aplica a máscara no `onChange` e faz `stripFormatting()` antes de enviar ao backend. No backend, o RG passa a aceitar 11 dígitos (CPF, por causa da unificação RG/CPF) e o `ContractsService` ganha uma função pura `stripContractDocumentFields` para higienizar documentos antes de gravar no banco — defesa em profundidade complementar à correção no frontend.

**Tech Stack:** React + TypeScript (frontend, Vitest), NestJS + class-validator (backend, Jest), Prisma/PostgreSQL.

## Global Constraints

- Documentos e telefone são **sempre salvos no banco sem pontuação** (apenas dígitos).
- Documentos e telefone são **sempre exibidos ao usuário com pontuação completa** — nunca com dígitos ocultos/mascarados por segurança (não é esse tipo de "máscara").
- RG aceita um CPF completo (11 dígitos) como valor válido, devido à unificação RG/CPF — quando tiver 10-11 dígitos, formata como CPF; com 7-9 dígitos, usa o agrupamento de RG.
- Rodar testes com paralelismo limitado nesta máquina: backend `npm test -- --maxWorkers=2 <arquivo>`, frontend `npx vitest run <arquivo>` (Vitest não sobe múltiplos processos pesados por padrão, mas evite rodar a suíte inteira junto com outro processo pesado).
- Fora de escopo: `frontend/src/pages/admin/DatabasePage.tsx` (viewer genérico de debug), `formatBRL` e demais formatadores não relacionados a documento/telefone.

---

### Task 1: Criar `frontend/src/utils/mask.ts`

**Files:**
- Create: `frontend/src/utils/mask.ts`
- Test: `frontend/src/utils/mask.test.ts`

**Interfaces:**
- Produces: `stripFormatting(value: string): string`, `applyCpfMask(value: string): string`, `applyCnpjMask(value: string): string`, `applyCepMask(value: string): string`, `applyRgMask(value: string): string`, `applyPhoneMask(value: string): string` — todas puras, aceitam qualquer string (com ou sem pontuação) e devolvem a string formatada.

- [ ] **Step 1: Escrever o teste**

```typescript
// frontend/src/utils/mask.test.ts
import { describe, expect, it } from "vitest";
import {
  stripFormatting,
  applyCpfMask,
  applyCnpjMask,
  applyCepMask,
  applyRgMask,
  applyPhoneMask,
} from "./mask";

describe("stripFormatting", () => {
  it("remove tudo que não é dígito", () => {
    expect(stripFormatting("123.456.789-00")).toBe("12345678900");
    expect(stripFormatting("(11) 99999-9999")).toBe("11999999999");
    expect(stripFormatting("")).toBe("");
  });
});

describe("applyCpfMask", () => {
  it("aplica pontuação progressivamente enquanto digita", () => {
    expect(applyCpfMask("123")).toBe("123");
    expect(applyCpfMask("123456")).toBe("123.456");
    expect(applyCpfMask("123456789")).toBe("123.456.789");
    expect(applyCpfMask("12345678900")).toBe("123.456.789-00");
  });

  it("ignora pontuação já existente e trunca em 11 dígitos", () => {
    expect(applyCpfMask("123.456.789-00")).toBe("123.456.789-00");
    expect(applyCpfMask("1234567890099999")).toBe("123.456.789-00");
  });
});

describe("applyCnpjMask", () => {
  it("aplica pontuação progressivamente enquanto digita", () => {
    expect(applyCnpjMask("12")).toBe("12");
    expect(applyCnpjMask("12345678000199")).toBe("12.345.678/0001-99");
  });

  it("trunca em 14 dígitos", () => {
    expect(applyCnpjMask("123456780001999999")).toBe("12.345.678/0001-99");
  });
});

describe("applyCepMask", () => {
  it("formata CEP de 8 dígitos", () => {
    expect(applyCepMask("01234567")).toBe("01234-567");
    expect(applyCepMask("01234")).toBe("01234");
  });
});

describe("applyRgMask", () => {
  it("agrupa RG de 7, 8 ou 9 dígitos", () => {
    expect(applyRgMask("1234567")).toBe("1.234.567");
    expect(applyRgMask("12345678")).toBe("12.345.678");
    expect(applyRgMask("123456789")).toBe("12.345.678-9");
  });

  it("delega para máscara de CPF a partir de 10 dígitos (unificação RG/CPF)", () => {
    expect(applyRgMask("1234567890")).toBe("123.456.789-0");
    expect(applyRgMask("12345678900")).toBe("123.456.789-00");
  });

  it("trunca em 11 dígitos", () => {
    expect(applyRgMask("123456789001234")).toBe("123.456.789-00");
  });
});

describe("applyPhoneMask", () => {
  it("formata celular de 9 dígitos locais (DDD + 9)", () => {
    expect(applyPhoneMask("11987654321")).toBe("(11) 98765-4321");
  });

  it("formata fixo de 8 dígitos locais (DDD + 8)", () => {
    expect(applyPhoneMask("1132654321")).toBe("(11) 3265-4321");
  });

  it("formata progressivamente enquanto digita", () => {
    expect(applyPhoneMask("11")).toBe("(11");
    expect(applyPhoneMask("1198765")).toBe("(11) 98765");
  });

  it("trunca em 11 dígitos", () => {
    expect(applyPhoneMask("119876543219999")).toBe("(11) 98765-4321");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd frontend && npx vitest run src/utils/mask.test.ts`
Expected: FAIL — `Cannot find module './mask'`

- [ ] **Step 3: Implementar `frontend/src/utils/mask.ts`**

```typescript
/**
 * Utilitários de máscara para documentos (CPF/CNPJ/RG/CEP) e telefone.
 *
 * Documentos e telefone são sempre salvos no banco sem pontuação
 * (stripFormatting antes do submit) e sempre exibidos ao usuário
 * pontuados. Estas funções nunca ocultam dígitos — apenas formatam.
 */

/** Remove tudo que não é dígito. */
export function stripFormatting(value: string): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

/** Aplica máscara de CPF (###.###.###-##) enquanto o usuário digita. */
export function applyCpfMask(value: string): string {
  const digits = stripFormatting(value).slice(0, 11);
  let formatted = digits;
  if (digits.length > 3) formatted = digits.slice(0, 3) + "." + digits.slice(3);
  if (digits.length > 6)
    formatted = formatted.slice(0, 7) + "." + digits.slice(6);
  if (digits.length > 9)
    formatted = formatted.slice(0, 11) + "-" + digits.slice(9);
  return formatted;
}

/** Aplica máscara de CNPJ (##.###.###/####-##) enquanto o usuário digita. */
export function applyCnpjMask(value: string): string {
  const digits = stripFormatting(value).slice(0, 14);
  let formatted = digits;
  if (digits.length > 2) formatted = digits.slice(0, 2) + "." + digits.slice(2);
  if (digits.length > 5)
    formatted = formatted.slice(0, 6) + "." + digits.slice(5);
  if (digits.length > 8)
    formatted = formatted.slice(0, 10) + "/" + digits.slice(8);
  if (digits.length > 12)
    formatted = formatted.slice(0, 15) + "-" + digits.slice(12);
  return formatted;
}

/** Aplica máscara de CEP (#####-###) enquanto o usuário digita. */
export function applyCepMask(value: string): string {
  const digits = stripFormatting(value).slice(0, 8);
  if (digits.length > 5) {
    return digits.slice(0, 5) + "-" + digits.slice(5);
  }
  return digits;
}

/**
 * Aplica máscara de RG (#.###.###-#, variável de 7 a 9 dígitos).
 * A partir de 10 dígitos, o valor é tratado como CPF (unificação RG/CPF)
 * e formatado como tal.
 */
export function applyRgMask(value: string): string {
  const digits = stripFormatting(value);
  if (digits.length >= 10) {
    return applyCpfMask(digits);
  }
  const truncated = digits.slice(0, 9);
  if (truncated.length === 9) {
    return truncated.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, "$1.$2.$3-$4");
  }
  if (truncated.length === 8) {
    return truncated.replace(/(\d{2})(\d{3})(\d{3})/, "$1.$2.$3");
  }
  if (truncated.length === 7) {
    return truncated.replace(/(\d{1})(\d{3})(\d{3})/, "$1.$2.$3");
  }
  return truncated;
}

/**
 * Aplica máscara de telefone local: (##) ####-#### (8 dígitos) ou
 * (##) #####-#### (9 dígitos), enquanto o usuário digita.
 */
export function applyPhoneMask(value: string): string {
  const digits = stripFormatting(value).slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : digits;
  const local = digits.slice(2);
  if (local.length <= 4) return `(${digits.slice(0, 2)}) ${local}`;
  const dashAt = local.length >= 9 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${local.slice(0, dashAt)}-${local.slice(dashAt)}`;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd frontend && npx vitest run src/utils/mask.test.ts`
Expected: PASS (todos os casos)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/mask.ts frontend/src/utils/mask.test.ts
git commit -m "feat(frontend): utilitário compartilhado de máscara de documento/telefone"
```

---

### Task 2: Migrar `contracts.service.ts` e `CreateContractPage.tsx` para o util compartilhado

**Files:**
- Modify: `frontend/src/services/contracts.service.ts`
- Modify: `frontend/src/pages/specialist/CreateContractPage.tsx`

**Interfaces:**
- Consumes: `stripFormatting`, `applyCpfMask`, `applyCnpjMask`, `applyCepMask`, `applyRgMask` de `frontend/src/utils/mask.ts` (Task 1).

- [ ] **Step 1: Remover as funções de máscara duplicadas de `contracts.service.ts`**

Em `frontend/src/services/contracts.service.ts`:
- Adicionar no topo do arquivo: `import { stripFormatting, applyCpfMask, applyCnpjMask, applyCepMask } from "../utils/mask";`
- Remover as declarações locais de `stripFormatting`, `applyCpfMask`, `applyCnpjMask`, `applyCepMask` (linhas ~390-486, mantendo `formatBRL` que fica no arquivo).
- Remover também `formatCpf`, `formatCnpj`, `formatCep`, `formatRg` (linhas ~398-434) — são código morto (nenhum import externo os usa, confirmado via grep no repo).
- Todas as 41 chamadas internas a `stripFormatting(...)` no restante do arquivo continuam funcionando normalmente, agora resolvendo para a versão importada.

- [ ] **Step 2: Atualizar o import em `CreateContractPage.tsx`**

Em `frontend/src/pages/specialist/CreateContractPage.tsx`, trocar:

```typescript
import {
  prefillContract,
  previewContract,
  sendContractAfterPreview,
  cancelContractPreview,
  listContractTemplates,
  type GenerateContractData,
  type PrefillContractResponse,
  type PreviewContractData,
  type PreviewContractResponse,
  type ContractTemplate,
  applyCpfMask,
  applyCnpjMask,
  applyCepMask,
  formatBRL,
} from "../../services/contracts.service";
```

por:

```typescript
import {
  prefillContract,
  previewContract,
  sendContractAfterPreview,
  cancelContractPreview,
  listContractTemplates,
  type GenerateContractData,
  type PrefillContractResponse,
  type PreviewContractData,
  type PreviewContractResponse,
  type ContractTemplate,
  formatBRL,
} from "../../services/contracts.service";
import {
  applyCpfMask,
  applyCnpjMask,
  applyCepMask,
  applyRgMask,
  stripFormatting,
} from "../../utils/mask";
```

(`applyRgMask` e `stripFormatting` são usados nas Tasks 3 e 4 abaixo — importar já agora evita um segundo diff no mesmo bloco de import.)

- [ ] **Step 3: Verificar que o build de tipos passa**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: sem erros novos relacionados a `mask.ts`/`contracts.service.ts`/`CreateContractPage.tsx`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/contracts.service.ts frontend/src/pages/specialist/CreateContractPage.tsx
git commit -m "refactor(frontend): mover máscara de documento p/ utils/mask.ts, remover código morto"
```

---

### Task 3: Corrigir `CreateContractPage.tsx` — máscara faltante e strip antes do submit

**Files:**
- Modify: `frontend/src/pages/specialist/CreateContractPage.tsx`

**Interfaces:**
- Consumes: `applyCpfMask`, `applyCnpjMask`, `applyCepMask`, `applyRgMask`, `stripFormatting` de `frontend/src/utils/mask.ts` (import já feito na Task 2).

- [ ] **Step 1: Adicionar máscara em `buyer_cpf` (hoje só `seller_cpf` tem)**

Localizar o `register("buyer_cpf", {...})` (por volta da linha 1066-1069) e trocar pelo mesmo padrão de `Controller` + `applyCpfMask` já usado em `seller_cpf` (linhas ~873-882):

```typescript
<Controller
  name="buyer_cpf"
  control={control}
  render={({ field }) => (
    <input
      {...field}
      type="text"
      onChange={(e) => field.onChange(applyCpfMask(e.target.value))}
      // ...manter demais props (className, placeholder etc.) já existentes no input atual
    />
  )}
/>
```

Manter todas as props visuais/validação já existentes no input atual — só a fonte do valor (`register` puro → `Controller` com `applyCpfMask`) muda, espelhando exatamente o bloco de `seller_cpf`.

- [ ] **Step 2: Adicionar máscara em `seller_rg` e `buyer_rg`**

Nos dois pontos onde `seller_rg`/`buyer_rg` são registrados via `register(...)` puro (linhas ~903 e ~1084), trocar para `Controller` + `applyRgMask`, mesmo padrão do Step 1:

```typescript
<Controller
  name="seller_rg"
  control={control}
  render={({ field }) => (
    <input
      {...field}
      type="text"
      onChange={(e) => field.onChange(applyRgMask(e.target.value))}
      // manter demais props existentes
    />
  )}
/>
```

Repetir de forma análoga para `buyer_rg`.

- [ ] **Step 3: Formatar o prefill de RG**

Nos pontos onde `data.seller.rg`/`data.buyer.rg` populam o form (linhas ~240 e ~254, junto dos já existentes `applyCpfMask(data.seller.cpf)`), envolver com `applyRgMask`:

```typescript
seller_rg: data.seller.rg ? applyRgMask(data.seller.rg) : "",
// ...
buyer_rg: data.buyer.rg ? applyRgMask(data.buyer.rg) : "",
```

- [ ] **Step 4: Corrigir `buildContractData` para enviar documentos sem pontuação**

Em `buildContractData` (linhas ~403-462), envolver todos os campos de documento/CEP com `stripFormatting`, preservando os `|| undefined` já existentes:

```typescript
const buildContractData = (
  formData: ContractFormData,
): GenerateContractData => ({
  process_id: processId!,
  template_id: selectedTemplateId || undefined,
  seller_name: formData.seller_name,
  seller_email: formData.seller_email,
  seller_cpf: stripFormatting(formData.seller_cpf),
  seller_rg: formData.seller_rg ? stripFormatting(formData.seller_rg) : undefined,
  seller_address: formData.seller_address,
  seller_cep: stripFormatting(formData.seller_cep),
  seller_bank: formData.seller_bank,
  seller_agency: formData.seller_agency,
  seller_checking_account: formData.seller_checking_account,
  buyer_name: formData.buyer_name,
  buyer_email: formData.buyer_email,
  buyer_cpf: stripFormatting(formData.buyer_cpf),
  buyer_rg: formData.buyer_rg ? stripFormatting(formData.buyer_rg) : undefined,
  buyer_address: formData.buyer_address,
  buyer_cep: stripFormatting(formData.buyer_cep),
  vehicle_model: formData.vehicle_model,
  vehicle_year: formData.vehicle_year,
  vehicle_registration_id: formData.vehicle_registration_id,
  vehicle_serial_number: formData.vehicle_serial_number,
  vehicle_technical_info: formData.vehicle_technical_info || undefined,
  vehicle_price: formData.vehicle_price,
  payment_seller_value: formData.payment_seller_value,
  total_commission_rate: formData.total_commission_rate,
  platform_name: formData.platform_name || undefined,
  platform_cnpj: formData.platform_cnpj
    ? stripFormatting(formData.platform_cnpj)
    : undefined,
  platform_bank: formData.platform_bank || undefined,
  platform_agency: formData.platform_agency || undefined,
  platform_checking_account:
    formData.platform_checking_account || undefined,
  office_name: formData.office_name || undefined,
  office_cnpj: formData.office_cnpj
    ? stripFormatting(formData.office_cnpj)
    : undefined,
  office_bank: formData.office_bank || undefined,
  office_agency: formData.office_agency || undefined,
  office_checking_account: formData.office_checking_account || undefined,
  specialist_name: formData.specialist_name || undefined,
  specialist_email: formData.specialist_email || undefined,
  specialist_document: formData.specialist_document
    ? stripFormatting(formData.specialist_document)
    : undefined,
  specialist_bank: formData.specialist_bank || undefined,
  specialist_agency: formData.specialist_agency || undefined,
  specialist_checking_account:
    formData.specialist_checking_account || undefined,
  testimonial1_name: formData.testimonial1_name || undefined,
  testimonial1_cpf: formData.testimonial1_cpf
    ? stripFormatting(formData.testimonial1_cpf)
    : undefined,
  testimonial1_email: formData.testimonial1_email || undefined,
  testimonial2_name: formData.testimonial2_name || undefined,
  testimonial2_cpf: formData.testimonial2_cpf
    ? stripFormatting(formData.testimonial2_cpf)
    : undefined,
  testimonial2_email: formData.testimonial2_email || undefined,
  city: formData.city,
  description: formData.description || undefined,
});
```

- [ ] **Step 5: Verificar build de tipos**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/specialist/CreateContractPage.tsx
git commit -m "fix(frontend): mascarar buyer_cpf/rg e enviar documentos sem pontuação no contrato"
```

---

### Task 4: Backend — RG aceita CPF (unificação) e defesa contra documento pontuado

**Files:**
- Modify: `backend/src/auth/dto/auth.ts`
- Modify: `backend/src/features/consultants/dto/create-consultant.dto.ts`
- Modify: `backend/src/features/specialists/dto/create-specialist.dto.ts`
- Modify: `backend/src/features/specialists/dto/update-specialist.dto.ts`
- Modify: `backend/src/features/users/dto/update-user.dto.ts`
- Modify: `backend/src/shared/utils/format.utils.ts`
- Create: `backend/src/shared/utils/format.utils.spec.ts`
- Modify: `backend/src/features/contracts/contracts.service.ts`
- Modify: `backend/src/features/contracts/contracts.service.spec.ts`

**Interfaces:**
- Produces: `formatRg(value: string): string` (estendido), `stripContractDocumentFields(fields: ContractDocumentFields): ContractDocumentFields` (novo, exportado de `contracts.service.ts`).

- [ ] **Step 1: Relaxar o limite de RG nos DTOs de registro (`backend/src/auth/dto/auth.ts`)**

Nas 4 classes (`UserRegisterDto`, `RegisterConsultantDto`, `RegisterOfficeDto`, `RegisterSpecialistDto`), trocar cada ocorrência de:

```typescript
@Length(7, 10, { message: 'RG deve ter entre 7 e 10 dígitos' })
@Matches(/^\d{7,10}$/, {
  message: 'RG deve conter apenas números (7-10 dígitos)',
})
rg: string;
```

por:

```typescript
@Length(7, 11, { message: 'RG deve ter entre 7 e 11 dígitos' })
@Matches(/^\d{7,11}$/, {
  message: 'RG deve conter apenas números (7-11 dígitos)',
})
rg: string;
```

- [ ] **Step 2: Relaxar `create-consultant.dto.ts`**

Em `backend/src/features/consultants/dto/create-consultant.dto.ts`, trocar:

```typescript
@Length(9, 10, { message: 'RG deve ter entre 9 e 10 dígitos' })
```

por:

```typescript
@Length(9, 11, { message: 'RG deve ter entre 9 e 11 dígitos' })
```

(`@Matches(/^\d+$/)` já aceita qualquer quantidade de dígitos — não precisa mudar.)

- [ ] **Step 3: Relaxar `create-specialist.dto.ts`**

Em `backend/src/features/specialists/dto/create-specialist.dto.ts`, trocar:

```typescript
@Length(9, 9, { message: 'RG deve ter exatamente 9 dígitos' })
```

por:

```typescript
@Length(9, 11, { message: 'RG deve ter entre 9 e 11 dígitos' })
```

- [ ] **Step 4: Relaxar `update-specialist.dto.ts`**

Em `backend/src/features/specialists/dto/update-specialist.dto.ts`, trocar:

```typescript
@Matches(/^\d{9,10}$/, { message: 'RG deve conter 9 ou 10 dígitos' })
```

por:

```typescript
@Matches(/^\d{9,11}$/, { message: 'RG deve conter entre 9 e 11 dígitos' })
```

- [ ] **Step 5: Relaxar `update-user.dto.ts`**

Em `backend/src/features/users/dto/update-user.dto.ts`, trocar:

```typescript
@Matches(/^\d{9,10}$/, {
  message: 'RG deve conter entre 9 e 10 dígitos numéricos',
})
```

por:

```typescript
@Matches(/^\d{9,11}$/, {
  message: 'RG deve conter entre 9 e 11 dígitos numéricos',
})
```

Atualizar também o comentário do cabeçalho da classe (linha ~17: `RG (de 9 a 10 dígitos)` → `RG (de 9 a 11 dígitos — 11 quando for um CPF, pela unificação RG/CPF)`).

- [ ] **Step 6: Escrever o teste de `formatRg` estendido**

```typescript
// backend/src/shared/utils/format.utils.spec.ts
import { formatRg } from './format.utils';

describe('formatRg', () => {
  it('formata RG de 7, 8 ou 9 dígitos', () => {
    expect(formatRg('1234567')).toBe('1.234.567');
    expect(formatRg('12345678')).toBe('12.345.678');
    expect(formatRg('123456789')).toBe('12.345.678-9');
  });

  it('formata como CPF quando tiver 11 dígitos (unificação RG/CPF)', () => {
    expect(formatRg('12345678900')).toBe('123.456.789-00');
  });

  it('devolve o valor original para tamanhos inválidos', () => {
    expect(formatRg('123')).toBe('123');
  });
});
```

- [ ] **Step 7: Rodar o teste e confirmar que falha**

Run: `cd backend && npm test -- --maxWorkers=2 format.utils.spec`
Expected: FAIL no caso de 11 dígitos (hoje `formatRg` devolve o valor cru para qualquer tamanho fora de 7-9).

- [ ] **Step 8: Estender `formatRg` em `backend/src/shared/utils/format.utils.ts`**

Trocar:

```typescript
export function formatRg(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 9) return value;
  // RG pode ter 7, 8 ou 9 dígitos dependendo do estado
  if (digits.length === 9) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, '$1.$2.$3-$4');
  }
  if (digits.length === 8) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2.$3');
  }
  return digits.replace(/(\d{1})(\d{3})(\d{3})/, '$1.$2.$3');
}
```

por:

```typescript
export function formatRg(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  // Unificação RG/CPF: 10-11 dígitos é um CPF sendo usado como documento de RG.
  if (digits.length >= 10 && digits.length <= 11) {
    return formatCpf(digits);
  }
  if (digits.length < 7 || digits.length > 9) return value;
  // RG pode ter 7, 8 ou 9 dígitos dependendo do estado
  if (digits.length === 9) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, '$1.$2.$3-$4');
  }
  if (digits.length === 8) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2.$3');
  }
  return digits.replace(/(\d{1})(\d{3})(\d{3})/, '$1.$2.$3');
}
```

- [ ] **Step 9: Rodar o teste e confirmar que passa**

Run: `cd backend && npm test -- --maxWorkers=2 format.utils.spec`
Expected: PASS

- [ ] **Step 10: Escrever o teste de `stripContractDocumentFields`**

Adicionar ao final de `backend/src/features/contracts/contracts.service.spec.ts` (novo `describe`, sem tocar nos existentes):

```typescript
import { stripContractDocumentFields } from './contracts.service';

describe('stripContractDocumentFields', () => {
  it('remove pontuação de todos os campos de documento e CEP', () => {
    const result = stripContractDocumentFields({
      seller_cpf: '123.456.789-00',
      seller_rg: '12.345.678-9',
      seller_cep: '01234-567',
      buyer_cpf: '987.654.321-00',
      buyer_rg: undefined,
      buyer_cep: '09876-543',
      platform_cnpj: '12.345.678/0001-99',
      office_cnpj: '98.765.432/0001-11',
      specialist_document: '11.222.333/0001-44',
      testimonial1_cpf: '111.222.333-44',
      testimonial2_cpf: undefined,
    });

    expect(result).toEqual({
      seller_cpf: '12345678900',
      seller_rg: '123456789',
      seller_cep: '01234567',
      buyer_cpf: '98765432100',
      buyer_rg: undefined,
      buyer_cep: '09876543',
      platform_cnpj: '12345678000199',
      office_cnpj: '98765432000111',
      specialist_document: '11222333000144',
      testimonial1_cpf: '11122233344',
      testimonial2_cpf: undefined,
    });
  });

  it('mantém undefined como undefined (não vira string vazia)', () => {
    const result = stripContractDocumentFields({
      seller_cpf: '12345678900',
      seller_rg: undefined,
      seller_cep: '01234567',
      buyer_cpf: '98765432100',
      buyer_rg: undefined,
      buyer_cep: '09876543',
      platform_cnpj: undefined,
      office_cnpj: undefined,
      specialist_document: undefined,
      testimonial1_cpf: undefined,
      testimonial2_cpf: undefined,
    });

    expect(result.platform_cnpj).toBeUndefined();
    expect(result.testimonial1_cpf).toBeUndefined();
  });
});
```

- [ ] **Step 11: Rodar o teste e confirmar que falha**

Run: `cd backend && npm test -- --maxWorkers=2 contracts.service.spec`
Expected: FAIL — `stripContractDocumentFields is not exported`

- [ ] **Step 12: Implementar `stripContractDocumentFields` em `contracts.service.ts`**

Adicionar `stripFormatting` ao import já existente de `src/shared/utils/format.utils`:

```typescript
import {
  formatCpf,
  formatCnpj,
  formatDocument,
  formatCep,
  formatRg,
  formatBRL,
  numberToWords,
  stripFormatting,
} from 'src/shared/utils/format.utils';
```

Adicionar, antes da declaração da classe `ContractsService` (função pura de módulo, testável sem instanciar o serviço):

```typescript
export interface ContractDocumentFields {
  seller_cpf?: string;
  seller_rg?: string;
  seller_cep?: string;
  buyer_cpf?: string;
  buyer_rg?: string;
  buyer_cep?: string;
  platform_cnpj?: string;
  office_cnpj?: string;
  specialist_document?: string;
  testimonial1_cpf?: string;
  testimonial2_cpf?: string;
}

/**
 * Remove pontuação de todos os campos de documento/CEP do contrato antes de
 * gravar no banco — defesa em profundidade caso o chamador (frontend ou
 * integração futura) envie o valor já formatado. Recebe o DTO completo
 * (que tem mais campos além destes 11) e devolve só os campos
 * higienizados — os call sites leem `cleanDocs.seller_cpf` etc. e
 * continuam lendo os demais campos direto de `dto`.
 */
export function stripContractDocumentFields(
  fields: ContractDocumentFields,
): ContractDocumentFields {
  const strip = (v?: string) => (v ? stripFormatting(v) : v);
  return {
    seller_cpf: strip(fields.seller_cpf),
    seller_rg: strip(fields.seller_rg),
    seller_cep: strip(fields.seller_cep),
    buyer_cpf: strip(fields.buyer_cpf),
    buyer_rg: strip(fields.buyer_rg),
    buyer_cep: strip(fields.buyer_cep),
    platform_cnpj: strip(fields.platform_cnpj),
    office_cnpj: strip(fields.office_cnpj),
    specialist_document: strip(fields.specialist_document),
    testimonial1_cpf: strip(fields.testimonial1_cpf),
    testimonial2_cpf: strip(fields.testimonial2_cpf),
  };
}
```

- [ ] **Step 13: Rodar o teste e confirmar que passa**

Run: `cd backend && npm test -- --maxWorkers=2 contracts.service.spec`
Expected: PASS (inclusive os testes pré-existentes de `resolveCommissionFromTotal`/`buildFormFields` continuam passando).

- [ ] **Step 14: Usar `stripContractDocumentFields` nos dois pontos onde o contrato é gravado**

No método que grava o contrato direto (bloco `tx.contract.create` por volta da linha 734, dentro do fluxo de `generateContract`), logo antes do `const contract = await tx.contract.create({`, adicionar:

```typescript
const cleanDocs = stripContractDocumentFields(dto);
```

E dentro do `data: { ... }` desse `create`, trocar as 11 linhas correspondentes de `dto.X` para `cleanDocs.X`:

```typescript
seller_cpf: cleanDocs.seller_cpf,
seller_rg: cleanDocs.seller_rg,
seller_cep: cleanDocs.seller_cep,
// ...
buyer_cpf: cleanDocs.buyer_cpf,
buyer_rg: cleanDocs.buyer_rg,
buyer_cep: cleanDocs.buyer_cep,
// ...
platform_cnpj: cleanDocs.platform_cnpj,
// ...
office_cnpj: cleanDocs.office_cnpj,
// ...
specialist_document: cleanDocs.specialist_document,
// ...
testimonial1_cpf: cleanDocs.testimonial1_cpf || null,
// ...
testimonial2_cpf: cleanDocs.testimonial2_cpf || null,
```

(Manter todos os outros campos do `data: {...}` — `seller_name`, `seller_address`, `seller_bank` etc. — exatamente como estão, só os 11 campos de documento/CEP mudam de fonte.)

Repetir exatamente o mesmo ajuste (`const cleanDocs = stripContractDocumentFields(dto);` + trocar as mesmas 11 linhas) no segundo bloco `tx.contract.create` dentro de `sendContractAfterPreview` (por volta da linha 1388).

- [ ] **Step 15: Rodar a suíte de contratos e confirmar que passa**

Run: `cd backend && npm test -- --maxWorkers=2 contracts.service.spec`
Expected: PASS

- [ ] **Step 16: Build do backend**

Run: `cd backend && npm run build`
Expected: sem erros de tipo.

- [ ] **Step 17: Commit**

```bash
git add backend/src/auth/dto/auth.ts backend/src/features/consultants/dto/create-consultant.dto.ts backend/src/features/specialists/dto/create-specialist.dto.ts backend/src/features/specialists/dto/update-specialist.dto.ts backend/src/features/users/dto/update-user.dto.ts backend/src/shared/utils/format.utils.ts backend/src/shared/utils/format.utils.spec.ts backend/src/features/contracts/contracts.service.ts backend/src/features/contracts/contracts.service.spec.ts
git commit -m "fix(backend): RG aceita CPF (unificação) e higieniza documentos antes de gravar contrato"
```

---

### Task 5: `RegisterPage.tsx` — usar util compartilhado, mascarar RG

**Files:**
- Modify: `frontend/src/pages/auth/RegisterPage.tsx`

**Interfaces:**
- Consumes: `applyCpfMask`, `applyRgMask`, `applyPhoneMask` de `frontend/src/utils/mask.ts`.

- [ ] **Step 1: Importar o util e remover as funções locais duplicadas**

Adicionar import: `import { applyCpfMask, applyRgMask, applyPhoneMask } from "../../utils/mask";`

Remover as declarações locais `formatCPF` (linhas ~135-144), `formatRG` (~146-149) e `formatPhone` (~151-159).

- [ ] **Step 2: Trocar as chamadas `onChange`**

- `e.target.value = formatCPF(e.target.value);` (linha ~344) → `e.target.value = applyCpfMask(e.target.value);`
- `e.target.value = formatRG(e.target.value);` (linha ~370) → `e.target.value = applyRgMask(e.target.value);`
- `e.target.value = formatPhone(e.target.value);` (linha ~399) → `e.target.value = applyPhoneMask(e.target.value);`

- [ ] **Step 3: Ajustar validação e `maxLength` do RG para acomodar CPF (11 dígitos)**

No bloco do input de RG (linhas ~354-374):
- `maxLength={10}` → `maxLength={14}` (tamanho de um CPF pontuado, `"123.456.789-00"`)
- Na validação inline de cor (`watch("rg") && (() => {...})()`, linha ~362) e no `validate` do `register("rg", {...})` (linha ~368): trocar `d >= 7 && d <= 10` por `d >= 7 && d <= 11`, e a mensagem `"RG deve ter entre 7 e 10 dígitos"` por `"RG deve ter entre 7 e 11 dígitos"`.
- Placeholder `"0000000000"` (linha ~357) → `"0000000 ou CPF completo"`.

- [ ] **Step 4: Build de tipos**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/auth/RegisterPage.tsx
git commit -m "refactor(frontend): RegisterPage usa util compartilhado de máscara, RG aceita CPF"
```

---

### Task 6: Telas de convite (`RegisterOfficePage`, `RegisterSpecialistPage`, `RegisterConsultantPage`) — aplicar máscara

**Files:**
- Modify: `frontend/src/pages/auth/RegisterOfficePage.tsx`
- Modify: `frontend/src/pages/auth/RegisterSpecialistPage.tsx`
- Modify: `frontend/src/pages/auth/RegisterConsultantPage.tsx`

**Interfaces:**
- Consumes: `applyCpfMask`, `applyCnpjMask`, `applyRgMask`, `applyPhoneMask` de `frontend/src/utils/mask.ts`.

As três telas têm a mesma estrutura (`useState` + `onChange={(e) => setX(e.target.value)}`, sem máscara nenhuma). O padrão de edição é idêntico nas três, trocando `cpf`↔`cnpj` conforme o caso.

- [ ] **Step 1: `RegisterOfficePage.tsx`**

Adicionar import: `import { applyCpfMask, applyRgMask, applyPhoneMask } from "../../utils/mask";`

Trocar os três `onChange`:

```typescript
// CPF (linha ~182)
onChange={(e) => setCpf(applyCpfMask(e.target.value))}

// RG (linha ~195)
onChange={(e) => setRg(applyRgMask(e.target.value))}

// Telefone (linha ~208)
onChange={(e) => setPhone(applyPhoneMask(e.target.value))}
```

Ajustar o input de RG (linhas ~191-200): `maxLength={10}` → `maxLength={14}`; label `"RG (7-10 dígitos)"` → `"RG (7-11 dígitos, aceita CPF)"`.

No `handleSubmit`, ajustar a validação de tamanho do RG (linha ~63): `cleanRg.length < 7 || cleanRg.length > 10` → `cleanRg.length < 7 || cleanRg.length > 11`, mensagem `"RG deve ter entre 7 e 10 dígitos."` → `"RG deve ter entre 7 e 11 dígitos."`.

- [ ] **Step 2: `RegisterSpecialistPage.tsx`**

Adicionar import: `import { applyCnpjMask, applyRgMask, applyPhoneMask } from "../../utils/mask";`

Trocar os três `onChange`:

```typescript
// CNPJ (linha ~206)
onChange={(e) => setCnpj(applyCnpjMask(e.target.value))}

// RG (linha ~219)
onChange={(e) => setRg(applyRgMask(e.target.value))}

// Telefone (linha ~232)
onChange={(e) => setPhone(applyPhoneMask(e.target.value))}
```

Ajustar o input de RG (linhas ~215-224): `maxLength={10}` → `maxLength={14}`; label `"RG (7-10 dígitos)"` → `"RG (7-11 dígitos, aceita CPF)"`.

No `handleSubmit`, mesma alteração de validação do Step 1 (linha ~74).

- [ ] **Step 3: `RegisterConsultantPage.tsx`**

Adicionar import: `import { applyCpfMask, applyRgMask, applyPhoneMask } from "../../utils/mask";`

Trocar os três `onChange`:

```typescript
// CPF (linha ~177)
onChange={(e) => setCpf(applyCpfMask(e.target.value))}

// RG (linha ~190)
onChange={(e) => setRg(applyRgMask(e.target.value))}

// Telefone (linha ~203)
onChange={(e) => setPhone(applyPhoneMask(e.target.value))}
```

Ajustar o input de RG (linhas ~186-195): `maxLength={10}` → `maxLength={14}`; label `"RG (7-10 dígitos)"` → `"RG (7-11 dígitos, aceita CPF)"`.

No `handleSubmit`, mesma alteração de validação do Step 1 (linha ~61).

- [ ] **Step 4: Build de tipos**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/auth/RegisterOfficePage.tsx frontend/src/pages/auth/RegisterSpecialistPage.tsx frontend/src/pages/auth/RegisterConsultantPage.tsx
git commit -m "feat(frontend): mascarar cpf/cnpj/rg/telefone nas telas de cadastro por convite"
```

---

### Task 7: `ProfilePage.tsx` — mascarar, formatar prefill, corrigir strip no submit

**Files:**
- Modify: `frontend/src/pages/profile/ProfilePage.tsx`

**Interfaces:**
- Consumes: `applyCpfMask`, `applyRgMask`, `applyPhoneMask`, `stripFormatting` de `frontend/src/utils/mask.ts`.

- [ ] **Step 1: Importar o util**

Adicionar: `import { applyCpfMask, applyRgMask, applyPhoneMask, stripFormatting } from "../../utils/mask";`

- [ ] **Step 2: Formatar o prefill (linhas ~86-93)**

Trocar:

```typescript
setFormData({
  name: userData.name || "",
  surname: userData.surname || "",
  cpf: userData.cpf || "",
  rg: userData.rg || "",
  phone: userData.phone || "",
  calendly_url: userData.calendly_url || "",
});
```

por:

```typescript
setFormData({
  name: userData.name || "",
  surname: userData.surname || "",
  cpf: userData.cpf ? applyCpfMask(userData.cpf) : "",
  rg: userData.rg ? applyRgMask(userData.rg) : "",
  phone: userData.phone ? applyPhoneMask(userData.phone) : "",
  calendly_url: userData.calendly_url || "",
});
```

- [ ] **Step 3: Aplicar máscara por campo em `handleInputChange` (linhas ~230-233)**

`handleInputChange` hoje é genérico (usado por vários inputs, não só cpf/rg/phone). Trocar por:

```typescript
const MASKED_FIELDS: Record<string, (value: string) => string> = {
  cpf: applyCpfMask,
  rg: applyRgMask,
  phone: applyPhoneMask,
};

const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target;
  const mask = MASKED_FIELDS[name];
  setFormData((prev) => ({ ...prev, [name]: mask ? mask(value) : value }));
};
```

- [ ] **Step 4: Corrigir o submit para enviar cpf/rg sem pontuação (linhas ~244-254)**

Trocar:

```typescript
const dataToUpdate: UpdateUserData = {
  name: formData.name,
  surname: formData.surname,
  cpf: formData.cpf,
  rg: formData.rg,
};

const cleanPhone = formData.phone.replace(/\D/g, "");
if (cleanPhone) {
  dataToUpdate.phone = cleanPhone;
}
```

por:

```typescript
const dataToUpdate: UpdateUserData = {
  name: formData.name,
  surname: formData.surname,
  cpf: stripFormatting(formData.cpf),
  rg: stripFormatting(formData.rg),
};

const cleanPhone = stripFormatting(formData.phone);
if (cleanPhone) {
  dataToUpdate.phone = cleanPhone;
}
```

- [ ] **Step 5: Remover o placeholder "Apenas números" e ajustar `maxLength`/placeholder do RG**

No input de CPF (linhas ~511-520): remover `placeholder="Apenas números"`, ajustar `maxLength={11}` → `maxLength={14}`.

No input de RG (linhas ~528-537): remover `placeholder="Apenas números"`, ajustar `maxLength={10}` → `maxLength={14}`.

No input de telefone (linhas ~545-553): `maxLength={16}` já comporta `"(11) 99999-9999"` (14 caracteres) — manter.

- [ ] **Step 6: Build de tipos**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/profile/ProfilePage.tsx
git commit -m "fix(frontend): mascarar cpf/rg/telefone no perfil e corrigir strip antes do submit"
```

---

### Task 8: Formulários de empresa (`OfficeCompanySettingsPage`, `NewCompanyForm`, `MyCompanyPage`) — mascarar CNPJ

**Files:**
- Modify: `frontend/src/pages/office/OfficeCompanySettingsPage.tsx`
- Modify: `frontend/src/pages/admin/NewCompanyForm.tsx`
- Modify: `frontend/src/pages/admin/MyCompanyPage.tsx`

**Interfaces:**
- Consumes: `applyCnpjMask`, `stripFormatting` de `frontend/src/utils/mask.ts`.

- [ ] **Step 1: `OfficeCompanySettingsPage.tsx`**

Adicionar import: `import { applyCnpjMask, stripFormatting } from "../../utils/mask";`

No prefill (linha ~27), trocar `cnpj: c.cnpj,` por `cnpj: c.cnpj ? applyCnpjMask(c.cnpj) : c.cnpj,`.

No input (linha ~159), trocar `onChange={(e) => setForm({ ...form, cnpj: e.target.value })}` por `onChange={(e) => setForm({ ...form, cnpj: applyCnpjMask(e.target.value) })}`.

No `save` (antes de `officeService.updateCompany(form)`, linha ~43), stripar o CNPJ:

```typescript
const updated = await officeService.updateCompany({
  ...form,
  cnpj: form.cnpj ? stripFormatting(form.cnpj) : form.cnpj,
});
```

- [ ] **Step 2: `NewCompanyForm.tsx`**

Adicionar import: `import { applyCnpjMask } from "../../utils/mask";`

No prefill (linha ~59), trocar `setCnpj(companyToEdit.cnpj);` por `setCnpj(applyCnpjMask(companyToEdit.cnpj));`.

No input (linha ~238), trocar `onChange={(e) => setCnpj(e.target.value)}` por `onChange={(e) => setCnpj(applyCnpjMask(e.target.value))}`.

O submit já faz `cnpj.replace(/\D/g, "")` antes de enviar (linha ~165) — não precisa mudar, mas pode trocar por `stripFormatting(cnpj)` (importar de `utils/mask`) para consistência; não é obrigatório.

- [ ] **Step 3: `MyCompanyPage.tsx`**

Adicionar import: `import { applyCnpjMask, stripFormatting } from "../../utils/mask";`

No prefill (linha ~44), trocar `setCnpj(data.cnpj);` por `setCnpj(applyCnpjMask(data.cnpj));`.

No input (linha ~167), trocar `onChange={(e) => setCnpj(e.target.value)}` por `onChange={(e) => setCnpj(applyCnpjMask(e.target.value))}`.

No submit (linha ~85, dentro de `updatePlatformCompany({...})`), trocar `cnpj,` por `cnpj: stripFormatting(cnpj),`.

- [ ] **Step 4: Build de tipos**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/office/OfficeCompanySettingsPage.tsx frontend/src/pages/admin/NewCompanyForm.tsx frontend/src/pages/admin/MyCompanyPage.tsx
git commit -m "feat(frontend): mascarar CNPJ nos formulários de empresa (escritório/plataforma)"
```

---

### Task 9: Exibição — `CompaniesPage.tsx` e `ConsultantClientsPage.tsx`

**Files:**
- Modify: `frontend/src/pages/admin/CompaniesPage.tsx`
- Modify: `frontend/src/pages/consultant/ConsultantClientsPage.tsx`

**Interfaces:**
- Consumes: `applyCnpjMask`, `applyCpfMask` de `frontend/src/utils/mask.ts`.

- [ ] **Step 1: `CompaniesPage.tsx`**

Adicionar import: `import { applyCnpjMask } from "../../utils/mask";`

Na linha ~389, trocar:

```tsx
<span className="block text-xs text-subtle">
  {company.cnpj}
</span>
```

por:

```tsx
<span className="block text-xs text-subtle">
  {applyCnpjMask(company.cnpj)}
</span>
```

- [ ] **Step 2: `ConsultantClientsPage.tsx`**

Remover a função local `formatCPF` (linhas ~29-33) e o import correspondente não é necessário (não havia). Adicionar: `import { applyCpfMask } from "../../utils/mask";`

Na linha ~181, trocar `{formatCPF(client.cpf)}` por `{client.cpf ? applyCpfMask(client.cpf) : "-"}`.

- [ ] **Step 3: Build de tipos**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/admin/CompaniesPage.tsx frontend/src/pages/consultant/ConsultantClientsPage.tsx
git commit -m "fix(frontend): formatar CNPJ/CPF na exibição de empresas e clientes do consultor"
```

---

### Task 10: Verificação final

**Files:** nenhum (task só de verificação, sem código novo).

- [ ] **Step 1: Lint do frontend**

Run: `cd frontend && npm run lint`
Expected: sem erros novos.

- [ ] **Step 2: Build do frontend**

Run: `cd frontend && npm run build`
Expected: build passa.

- [ ] **Step 3: Testes do frontend (arquivos tocados)**

Run: `cd frontend && npx vitest run src/utils/mask.test.ts`
Expected: PASS.

- [ ] **Step 4: Lint do backend**

Run: `cd backend && npm run lint`
Expected: sem erros novos.

- [ ] **Step 5: Build do backend**

Run: `cd backend && npm run build`
Expected: build passa.

- [ ] **Step 6: Testes do backend (arquivos tocados)**

Run: `cd backend && npm test -- --maxWorkers=2 format.utils.spec`
Run: `cd backend && npm test -- --maxWorkers=2 contracts.service.spec`
Expected: PASS em ambos (incluindo os testes pré-existentes de `resolveCommissionFromTotal`/`buildFormFields` — se algum falhar por motivo já conhecido e não relacionado a este trabalho, confirmar contra o histórico do projeto antes de investigar como regressão nova).

- [ ] **Step 7: Smoke test manual (opcional, se houver ambiente local rodável)**

Não subir `nest start --watch` nesta máquina (histórico de travamento). Se for validar manualmente, usar apenas o frontend com a API já rodando via outro meio, ou revisar via leitura de diff — build + testes automatizados acima já cobrem o essencial.
