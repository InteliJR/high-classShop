# Seleção de template de contrato + comissão zerada — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o especialista escolher o template do contrato (auto por tipo de produto, com troca) e fazer os 3 contratos de produto saírem sem comissão no DocuSign, resistindo à remoção manual dos campos no template.

**Architecture:** Reusa o fluxo DocGen existente (preview → send). O `template_id` passa a fluir do front → DTOs → `contracts.service` → `docuSignService`, com fallback para `DOCUSIGN_TEMPLATE_ID`. A comissão é zerada só no payload enviado ao DocuSign (`buildFormFields`); DB/cálculo interno ficam intactos. A UI de comissão é ocultada mantendo os inputs para não quebrar a validação `@IsNotEmpty` do backend.

**Tech Stack:** NestJS + Prisma (backend), React + react-hook-form + Vite (frontend), DocuSign eSign REST v2.1 (DocGen), Jest.

## Global Constraints

- Fallback obrigatório: onde `template_id` não vier, usar `process.env.DOCUSIGN_TEMPLATE_ID` (não quebrar chamadas legadas).
- Zerar comissão **só no DocuSign** — nunca no cálculo (`resolveCommissionFromTotal`) nem na persistência (`Contract.*_value`).
- Esconder a seção de comissão **sem** remover os inputs do form (backend exige `platform_*`, `office_name/cnpj`, `specialist_name/email/document` como `@IsNotEmpty`).
- "Contrato de venda" (`141ff98d…`, esquema flat) fica **fora** do seletor nesta iteração.
- Testes de backend rodam com `--maxWorkers=2` (RAM limitada nesta máquina).
- **Nunca** subir backend com `nest start --watch` (OOM). QA final: `npm run build` + `npm run start:prod`.
- Endpoints novos: `@Roles(UserRole.SPECIALIST, UserRole.ADMIN)`.

---

### Task 1: Backend — endpoint de listagem de templates

**Files:**
- Modify: `backend/src/providers/docusign/docusign.client.ts` (novo método `listTemplates`)
- Modify: `backend/src/providers/docusign/docusign.service.ts` (novo método `listTemplates`)
- Modify: `backend/src/features/contracts/contracts.controller.ts` (novo `GET templates`)
- Create/Modify test: `backend/src/providers/docusign/docusign.service.spec.ts`

**Interfaces:**
- Produces: `DocuSignClient.listTemplates(): Promise<Array<{ templateId: string; name: string }>>`
- Produces: `DocuSignService.listTemplates(): Promise<Array<{ templateId: string; name: string }>>`
- Produces: rota `GET /api/contracts/templates` → `ApiResponseDto<Array<{ templateId: string; name: string }>>`

- [ ] **Step 1: Escrever teste falho (service delega + mapeia)**

Criar `backend/src/providers/docusign/docusign.service.spec.ts`:

```typescript
import { DocuSignService } from './docusign.service';

describe('DocuSignService — listTemplates', () => {
  it('mapeia envelopeTemplates do client para {templateId, name}', async () => {
    const client = {
      listTemplates: jest.fn().mockResolvedValue([
        { templateId: 'a', name: 'Contrato de Carro' },
        { templateId: 'b', name: 'Contrato de Aeronave' },
      ]),
    } as any;
    const service = new DocuSignService(client);

    const result = await service.listTemplates();

    expect(client.listTemplates).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { templateId: 'a', name: 'Contrato de Carro' },
      { templateId: 'b', name: 'Contrato de Aeronave' },
    ]);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- docusign.service --maxWorkers=2`
Expected: FAIL (`service.listTemplates is not a function`).

- [ ] **Step 3: Implementar `listTemplates` no client**

Em `docusign.client.ts`, seguindo o padrão de `getEnvelope` (usa `getAccessToken()` + `this.get`):

```typescript
async listTemplates(): Promise<Array<{ templateId: string; name: string }>> {
  const token = await this.getAccessToken();
  const data = await this.get(
    `/v2.1/accounts/${this.accountId}/templates`,
    token,
  );
  return (data.envelopeTemplates || []).map((t: any) => ({
    templateId: t.templateId,
    name: t.name,
  }));
}
```

- [ ] **Step 4: Implementar `listTemplates` no service**

Em `docusign.service.ts` (delega ao client):

```typescript
async listTemplates(): Promise<Array<{ templateId: string; name: string }>> {
  return this.client.listTemplates();
}
```

- [ ] **Step 5: Adicionar rota no controller**

Em `contracts.controller.ts`, o controller injeta só `contractsService`. Injetar também `DocuSignService`. No constructor:

```typescript
constructor(
  private readonly contractsService: ContractsService,
  private readonly docuSignService: DocuSignService,
) {}
```

Adicionar o import no topo: `import { DocuSignService } from 'src/providers/docusign/docusign.service';`

E a rota (perto de `prefill`):

```typescript
@Get('templates')
@Roles(UserRole.SPECIALIST, UserRole.ADMIN)
async listTemplates(): Promise<
  ApiResponseDto<Array<{ templateId: string; name: string }>>
> {
  const templates = await this.docuSignService.listTemplates();
  return {
    success: true,
    message: 'Templates carregados com sucesso',
    data: templates,
  };
}
```

`DocusignModule` já exporta `DocuSignService` e `ContractsModule` já importa `DocusignModule` — sem mudança de módulo necessária.

- [ ] **Step 6: Rodar o teste e ver passar**

Run: `npm test -- docusign.service --maxWorkers=2`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/providers/docusign/docusign.client.ts backend/src/providers/docusign/docusign.service.ts backend/src/providers/docusign/docusign.service.spec.ts backend/src/features/contracts/contracts.controller.ts
git commit -m "feat(contracts): endpoint GET /contracts/templates lista templates DocuSign"
```

---

### Task 2: Backend — `template_id` opcional nos DTOs e uso no service

**Files:**
- Modify: `backend/src/features/contracts/dto/preview-contract.dto.ts`
- Modify: `backend/src/features/contracts/dto/generate-contract.dto.ts`
- Modify: `backend/src/features/contracts/contracts.service.ts` (3 pontos: `generateContract` ~697, `previewContract` ~1218, `sendContractAfterPreview` ~1378)

**Interfaces:**
- Consumes: rota do Task 1 (front envia `template_id` que veio de lá).
- Produces: `PreviewContractDto.template_id?: string` e `GenerateContractDto.template_id?: string`.

> Sem teste unitário dedicado: a resolução é um `??` trivial (ponytail — coberto pelo build + pela prova e2e do Task 6). O importante é o mesmo `template_id` do preview ser gravado no envio.

- [ ] **Step 1: Adicionar `template_id` ao `PreviewContractDto`**

No topo da classe `PreviewContractDto` (garantir `IsOptional`/`IsString` importados de `class-validator`):

```typescript
@IsString({ message: 'template_id deve ser uma string' })
@IsOptional()
template_id?: string;
```

- [ ] **Step 2: Adicionar `template_id` ao `GenerateContractDto`**

Mesma adição na classe `GenerateContractDto` (imports já têm `IsString`/`IsOptional`).

- [ ] **Step 3: Usar `template_id` em `generateContract`**

Em `contracts.service.ts` ~697, trocar:

```typescript
const templateId = globalThis.process.env.DOCUSIGN_TEMPLATE_ID;
if (!templateId) {
  throw new InternalServerErrorException('DOCUSIGN_TEMPLATE_ID não configurado');
}
```

por:

```typescript
const templateId =
  dto.template_id || globalThis.process.env.DOCUSIGN_TEMPLATE_ID;
if (!templateId) {
  throw new InternalServerErrorException(
    'Nenhum template informado e DOCUSIGN_TEMPLATE_ID não configurado',
  );
}
```

- [ ] **Step 4: Usar `template_id` em `previewContract`**

Em `contracts.service.ts` ~1218, aplicar a mesma troca (`dto.template_id || env`).

- [ ] **Step 5: Gravar `template_id` do preview em `sendContractAfterPreview`**

Em `contracts.service.ts` ~1378, trocar:

```typescript
const templateId = globalThis.process.env.DOCUSIGN_TEMPLATE_ID || '';
```

por:

```typescript
const templateId =
  dto.template_id || globalThis.process.env.DOCUSIGN_TEMPLATE_ID || '';
```

(Assim `Contract.template_id` e `provider_meta.templateId` refletem o template realmente usado no envelope do preview.)

- [ ] **Step 6: Verificar build**

Run: `npm run build`
Expected: sem erros de tipo (o campo é opcional; fluxos antigos seguem no fallback).

- [ ] **Step 7: Commit**

```bash
git add backend/src/features/contracts/dto/preview-contract.dto.ts backend/src/features/contracts/dto/generate-contract.dto.ts backend/src/features/contracts/contracts.service.ts
git commit -m "feat(contracts): template_id dinâmico com fallback para env no fluxo de contrato"
```

---

### Task 3: Backend — comissão zerada no DocuSign + prova de resistência à remoção

**Files:**
- Modify: `backend/src/features/contracts/contracts.service.ts` (`buildFormFields` ~953-1040)
- Modify: `backend/src/features/contracts/contracts.service.spec.ts` (teste de zero)
- Modify: `backend/src/providers/docusign/docusign.service.spec.ts` (teste removal-safe)

**Interfaces:**
- Consumes: `mapFormFieldsToDocGen(docGenFormFields, formFields)` (privado, existente em `docusign.service.ts`).

- [ ] **Step 1: Teste falho — `buildFormFields` zera os valores de comissão**

Adicionar em `contracts.service.spec.ts` (usa o mesmo `mkSvc`/`{} as any` para deps não usadas por `buildFormFields`):

```typescript
import {
  formatBRL,
  numberToWords,
} from '../../shared/utils/format.utils';

describe('ContractsService — buildFormFields zera comissão no DocuSign', () => {
  const dto: any = {
    seller_name: 'Vendedor', seller_cpf: '12345678901', seller_address: 'Rua 1',
    seller_cep: '01234567', seller_bank: 'Itau', seller_agency: '1', seller_checking_account: '2',
    buyer_name: 'Comprador', buyer_cpf: '98765432100', buyer_address: 'Rua 2', buyer_cep: '01234000',
    vehicle_model: 'Carro X', vehicle_year: '2020', vehicle_registration_id: 'ABC1234',
    vehicle_serial_number: 'CHASSI', vehicle_price: 100000, payment_seller_value: 90000,
    total_commission_rate: 10,
    platform_value: 4000, platform_percentage: 4, platform_name: 'Plat', platform_cnpj: '11111111000111',
    platform_bank: 'B', platform_agency: 'A', platform_checking_account: 'C',
    office_value: 2000, office_name: 'Escr', office_cnpj: '22222222000122',
    specialist_value: 4000, specialist_name: 'Esp', specialist_email: 'e@e.com',
    specialist_document: '33333333000133',
    city: 'São Paulo',
  };

  it('valores monetários de comissão vão zerados; dados das partes intactos', () => {
    const svc = new ContractsService({} as any, {} as any, {} as any, {} as any);
    const fields = (svc as any).buildFormFields(dto, 'CAR');

    // comissão zerada (split + flat legado)
    expect(fields.platform_value).toBe(formatBRL(0));
    expect(fields.platform_value_written).toBe(numberToWords(0));
    expect(fields.platform_percentage).toBe('0');
    expect(fields.commission_office_value).toBe(formatBRL(0));
    expect(fields.commission_office_written).toBe(numberToWords(0));
    expect(fields.specialist_value).toBe(formatBRL(0));
    expect(fields.specialist_value_written).toBe(numberToWords(0));
    expect(fields.commission_value).toBe(formatBRL(0));
    expect(fields.commision_value_written).toBe(numberToWords(0));

    // dados que NÃO são comissão seguem normais
    expect(fields.buyer_name).toBe('Comprador');
    expect(fields.vehicle_model).toBe('Carro X');
    expect(fields.platform_name).toBe('Plat');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- contracts.service --maxWorkers=2`
Expected: FAIL (hoje `platform_value` = `formatBRL(4000)`, não `formatBRL(0)`).

- [ ] **Step 3: Zerar os valores de comissão em `buildFormFields`**

Em `contracts.service.ts`, dentro do objeto `fields` de `buildFormFields`, substituir os valores monetários de comissão por zero (manter nomes/CNPJ/banco das partes como estão):

```typescript
// === Campos do template ANTIGO (compatibilidade) — comissão zerada no contrato ===
commission_value: formatBRL(0),
commision_value_written: numberToWords(0),
commission_name: dto.platform_name,
commision_cpf: formatCnpj(dto.platform_cnpj),
commission_bank: dto.platform_bank,
commission_agency: dto.platform_agency,
commission_checking_account: dto.platform_checking_account,

// === Split (novo) — valores de comissão zerados; dados das partes mantidos ===
platform_value: formatBRL(0),
platform_value_written: numberToWords(0),
platform_percentage: '0',
platform_name: dto.platform_name,
platform_cnpj: formatCnpj(dto.platform_cnpj),
platform_bank: dto.platform_bank,
platform_agency: dto.platform_agency,
platform_checking_account: dto.platform_checking_account,

commission_office_value: formatBRL(0),
commission_office_written: numberToWords(0),
office_name: dto.office_name,
office_cnpj: formatCnpj(dto.office_cnpj),
office_bank: dto.office_bank || '',
office_agency: dto.office_agency || '',
office_checking_account: dto.office_checking_account || '',

specialist_value: formatBRL(0),
specialist_value_written: numberToWords(0),
specialist_bank: dto.specialist_bank || '',
specialist_agency: dto.specialist_agency || '',
specialist_checking_account: dto.specialist_checking_account || '',
especialista_name: dto.specialist_name,
specialist_document: formatDocument(dto.specialist_document),
```

Deixar um comentário `ponytail:` no bloco: `// ponytail: comissão zerada só no payload DocuSign; DB/cálculo intactos (resolveCommissionFromTotal segue igual)`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- contracts.service --maxWorkers=2`
Expected: PASS (incluindo os testes de `resolveCommissionFromTotal` existentes — não devem quebrar, pois o cálculo não foi tocado).

- [ ] **Step 5: Teste removal-safe em `mapFormFieldsToDocGen`**

Adicionar em `docusign.service.spec.ts`:

```typescript
describe('DocuSignService — mapFormFieldsToDocGen é removal-safe', () => {
  const service = new DocuSignService({} as any);

  it('template sem campos de comissão não recebe nenhum campo de comissão e não lança', () => {
    // template só tem buyer_name (comissão foi apagada do Template.docx)
    const templateDocs = [
      { documentId: '1', docGenFormFieldList: [{ name: 'buyer_name', label: 'buyer_name', value: '' }] },
    ];
    const formFields = {
      buyer_name: 'Comprador',
      platform_value: 'R$ 0,00', // chave extra: NÃO existe no template
      specialist_value: 'R$ 0,00',
    };

    const result = (service as any).mapFormFieldsToDocGen(templateDocs, formFields);
    const names = result[0].docGenFormFieldList.map((f: any) => f.name);

    expect(names).toEqual(['buyer_name']); // só o que o template pediu
    expect(names).not.toContain('platform_value');
    expect(names).not.toContain('specialist_value');
    expect(result[0].docGenFormFieldList[0].value).toBe('Comprador');
  });
});
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -- docusign.service --maxWorkers=2`
Expected: PASS (o método já é removal-safe; o teste trava esse comportamento contra regressão).

- [ ] **Step 7: Commit**

```bash
git add backend/src/features/contracts/contracts.service.ts backend/src/features/contracts/contracts.service.spec.ts backend/src/providers/docusign/docusign.service.spec.ts
git commit -m "feat(contracts): zera comissão no payload DocuSign + testa resistência à remoção do template"
```

---

### Task 4: Frontend — service de templates + `template_id` nos tipos

**Files:**
- Modify: `frontend/src/services/contracts.service.ts`

**Interfaces:**
- Produces: `listContractTemplates(): Promise<Array<{ templateId: string; name: string }>>`
- Produces: `GenerateContractData.template_id?: string` (herdado por `PreviewContractData`)

- [ ] **Step 1: Adicionar `template_id` ao tipo**

Em `GenerateContractData` (após `process_id`), adicionar:

```typescript
  // Template DocuSign escolhido (opcional; backend faz fallback pro env)
  template_id?: string;
```

- [ ] **Step 2: Adicionar tipo + função de listagem**

No mesmo arquivo, junto às demais funções de API:

```typescript
export interface ContractTemplate {
  templateId: string;
  name: string;
}

export async function listContractTemplates(): Promise<ContractTemplate[]> {
  const response =
    await api.get<ApiResponse<ContractTemplate[]>>("/contracts/templates");
  return response.data.data;
}
```

- [ ] **Step 3: Verificar build/lint**

Run (em `frontend/`): `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/contracts.service.ts
git commit -m "feat(contracts): frontend service listContractTemplates + template_id"
```

---

### Task 5: Frontend — seletor de template + esconder seção de comissão

**Files:**
- Modify: `frontend/src/pages/specialist/CreateContractPage.tsx`

**Interfaces:**
- Consumes: `listContractTemplates`, `ContractTemplate` (Task 4); `template_id` em `buildContractData`.

- [ ] **Step 1: Importar e criar estado dos templates**

No import de `../../services/contracts.service`, adicionar `listContractTemplates` e o tipo `type ContractTemplate`. Após os estados de preview, adicionar:

```typescript
const [templates, setTemplates] = useState<ContractTemplate[]>([]);
const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
```

- [ ] **Step 2: Carregar templates + auto-seleção por tipo**

Adicionar um `useEffect` que roda após o prefill (depende de `prefillData`):

```typescript
useEffect(() => {
  const load = async () => {
    try {
      const list = await listContractTemplates();
      setTemplates(list);
      // auto-seleção pelo tipo do produto (casa por nome do template)
      const key =
        prefillData?.product_type === "CAR" ? "carro"
        : prefillData?.product_type === "BOAT" ? "embarca"
        : prefillData?.product_type === "AIRCRAFT" ? "aeronave"
        : "";
      const match = list.find((t) => t.name.toLowerCase().includes(key));
      if (match) setSelectedTemplateId(match.templateId);
    } catch (e) {
      console.error("Erro ao carregar templates:", e);
    }
  };
  if (prefillData) load();
}, [prefillData]);
```

- [ ] **Step 3: Injetar `template_id` no payload**

Em `buildContractData`, adicionar no objeto retornado:

```typescript
    template_id: selectedTemplateId || undefined,
```

- [ ] **Step 4: Adicionar o dropdown no topo do form**

Logo após `<form onSubmit={handleSubmit(onPreview)} ...>` e antes do grupo "Dados das partes":

```tsx
<section className="bg-surface rounded-lg border border-border p-6">
  <h2 className="text-base font-semibold text-ink mb-2 border-b pb-2">
    Modelo de contrato
  </h2>
  <p className="text-sm text-muted mb-3">
    Selecionado automaticamente pelo tipo do produto — troque se necessário.
  </p>
  <select
    value={selectedTemplateId}
    onChange={(e) => setSelectedTemplateId(e.target.value)}
    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent bg-surface"
  >
    <option value="">Selecione um modelo…</option>
    {templates.map((t) => (
      <option key={t.templateId} value={t.templateId}>
        {t.name}
      </option>
    ))}
  </select>
</section>
```

- [ ] **Step 5: Desabilitar o submit sem template**

No `<Button type="submit" ...>`, incluir `!selectedTemplateId` no `disabled`:

```tsx
disabled={isSubmitting || submitStatus.type === "success" || !selectedTemplateId}
```

- [ ] **Step 6: Esconder as colunas de comissão em "Valores da Transação"**

Nos 4 `<div>` da grade de "Valores da Transação" que exibem comissão (labels "Comissão Total da Venda (%)", "Comissão da Plataforma", "Comissão do Escritório", "Comissão do Especialista"), adicionar `hidden` à className do wrapper `<div>`. Manter visíveis "Valor Total do..." e "Valor Líquido do Vendedor". O input `total_commission_rate` continua registrado (fica no DOM oculto).

- [ ] **Step 7: Remover `required` do input de comissão total**

No `register("total_commission_rate", {...})`, remover a linha `required: "Comissão total é obrigatória",` (manter `valueAsNumber` e `min`). O valor segue vindo do prefill (`suggested_total_rate`).

- [ ] **Step 8: Ocultar as seções Plataforma / Escritório / Especialista**

Nas 3 `<section>` "Dados da Plataforma", "Dados do Escritório" e "Dados do Especialista", adicionar `hidden` à className da `<section>`. Em cada `register(...)` obrigatório dessas seções, remover a chave `required: ...` (campos: `platform_name`, `platform_cnpj`, `platform_bank`, `platform_agency`, `platform_checking_account`, `office_name`, `office_cnpj`, `specialist_name`, `specialist_email`, `specialist_document`, `specialist_bank`, `specialist_agency`, `specialist_checking_account`). Os inputs permanecem registrados e pré-preenchidos pelo prefill, então os valores continuam sendo enviados ao backend.

> Nota: os valores de `platform_*`, `office_name/cnpj`, `specialist_name/email/document` vêm do prefill e satisfazem os `@IsNotEmpty` do backend. Se algum vier vazio do prefill, o backend rejeita — nesse caso o especialista precisa que o cadastro de plataforma/escritório/especialista esteja completo (comportamento já esperado hoje).

- [ ] **Step 9: Build + lint**

Run (em `frontend/`): `npm run lint && npm run build`
Expected: sem erros. Conferir no navegador depois (Task 6) que o form abre com o modelo já selecionado e a comissão oculta.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/specialist/CreateContractPage.tsx
git commit -m "feat(contracts): seletor de template auto por tipo + esconde seção de comissão"
```

---

### Task 6: Verificação final + subir ambiente para QA do usuário

**Files:** nenhum (verificação).

- [ ] **Step 1: Lint + build + testes backend**

Run (em `backend/`):
```bash
npm run lint
npm run build
npm test -- contracts --maxWorkers=2
npm test -- docusign --maxWorkers=2
```
Expected: tudo verde.

- [ ] **Step 2: Lint + build frontend**

Run (em `frontend/`): `npm run lint && npm run build`
Expected: verde.

- [ ] **Step 3: Prova e2e leve com credenciais demo (sem Nest)**

Adaptar o script `scratchpad/compare-labels.js`: criar um preview real via `createEnvelopePreview`-equivalente OU, mais simples, criar draft a partir do template de Carro, `GET docGenFormFields`, `PUT` com os `formFields` já zerados de comissão, e conferir que os campos `platform_value`/`specialist_value`/`commission_office_value` saem como `R$ 0,00`. Deletar o draft ao final.
Expected: campos de comissão = `R$ 0,00` (ou ausentes se o template já foi editado). Sem erro no `PUT`/`sent`.

- [ ] **Step 4: Checar RAM antes de subir**

Run: `free -h`
Se a memória livre estiver baixa (<3-4GB), fechar processos pesados antes de continuar.

- [ ] **Step 5: Subir backend COMPILADO (sem watch)**

Run (em `backend/`, background):
```bash
npm run build && npm run start:prod
```
NÃO usar `npm run start:dev` / `nest start --watch` (OOM nesta máquina).

- [ ] **Step 6: Subir frontend (Vite)**

Run (em `frontend/`, background): `npm run dev` → http://localhost:5173

- [ ] **Step 7: Entregar para o usuário validar**

Avisar o usuário que o ambiente está no ar e listar o roteiro de QA: (a) abrir o fluxo de gerar contrato de um processo em `PROCESSING_CONTRACT`, (b) conferir o dropdown "Modelo de contrato" já selecionado pelo tipo do produto, (c) trocar de modelo e voltar, (d) confirmar que a seção de comissão não aparece, (e) pré-visualizar e conferir no DocuSign que a comissão sai zerada.

---

## Self-Review

**Spec coverage:**
- Feature A (endpoint, DTOs, service, front dropdown auto por tipo) → Tasks 1, 2, 4, 5. ✅
- Feature B (zerar comissão no DocuSign, removal-safe, esconder UI) → Tasks 3, 5. ✅
- Fallback env → Task 2 (Global Constraints). ✅
- "Contrato de venda" fora do seletor → dropdown lista o que o endpoint retorna; auto-seleção só casa os 3 de produto (usuário pode escolher qualquer um manualmente — aceito). ✅
- QA final via server compilado → Task 6. ✅

**Placeholder scan:** todos os steps têm código/comandos concretos. Sem TBD/TODO.

**Type consistency:** `listTemplates()` (client/service) e `listContractTemplates()`/`ContractTemplate` (front) usados de forma consistente; `template_id` opcional em DTOs e tipo do front batem.

## Handoff

Após aprovação, executar via subagent-driven-development (um subagente por task, review entre tasks).
