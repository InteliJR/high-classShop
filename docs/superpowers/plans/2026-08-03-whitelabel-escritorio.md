# Whitelabel de Escritório (`/i/:slug`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada escritório (Company) ganha um site whitelabel em `/i/:slug` com sua identidade visual; clientes que se cadastram por lá viram clientes do escritório (`User.company_id` direto, sem consultor) e geram comissão de escritório em seus processos.

**Architecture:** A comissão de escritório, hoje resolvida só por `client.consultant.company_id`, ganha o fallback `?? client.company_id`. O vínculo é criado no cadastro via `company_slug`. Branding do escritório já é lido de `user.company` (backend e frontend) — só estendemos para o visitante anônimo em `/i/:slug`. O slug é auto-gerado do nome no create, editável no settings.

**Tech Stack:** NestJS + Prisma (PostgreSQL/Supabase) no backend; React + Vite + TS + Zustand no frontend. Testes backend em Jest.

## Global Constraints

- **Nunca rodar o backend em watch/dev server** (`nest start --watch`) nesta máquina — trava. Verificação de backend é só via Jest.
- **Jest sempre com `--maxWorkers=2`** e escopado ao arquivo/teste (nunca a suíte inteira bare) — a máquina tem pouca RAM.
- **Frontend não tem testes unitários** — verificação é `npm run build` + `npm run lint`. QA visual só via Playwright mockando a API (nunca subir backend).
- **Migração de schema:** `.env` aponta pra Supabase tratada como **demo**. Alteração é **aditiva** (coluna nullable) → aplicar com `npx prisma db push` (nunca `migrate deploy` contra a Supabase). Backfill via script dedicado.
- **Regra de comissão:** consultor **não** recebe comissão nesta plataforma. Este plano só adiciona comissão de **escritório** — não adicionar nada para consultor.
- **Identidade visual da plataforma:** o botão/modal "Meu site do escritório" no dashboard OFFICE usa cores **fixas da plataforma** (`DEFAULT_BRAND_PRIMARY = "#3C3C3C"`, `DEFAULT_BRAND_SECONDARY = "#1C1C1C"`), **nunca** `var(--brand-*)` (que ali é a cor do próprio escritório). O whitelabel `/i/:slug` é o oposto: aplica o brand DO ESCRITÓRIO.

## File Structure

**Backend (criar):**
- `backend/src/features/companies/slug.util.ts` — helper puro de geração de slug.
- `backend/src/features/companies/slug.util.spec.ts` — teste do helper.

**Backend (modificar):**
- `backend/prisma/schema.prisma` — campo `slug` em `Company`.
- `backend/prisma/backfill-company-slug.ts` — script de backfill (criar).
- `backend/src/features/contracts/contracts.service.ts` — fallback de comissão (`:259`, `:496`).
- `backend/src/features/contracts/contracts.service.spec.ts` — testes do fallback.
- `backend/src/auth/dto/auth.ts` — `company_slug` no `UserRegisterDto`.
- `backend/src/auth/auth.service.ts` — `register` seta `company_id`; `slug` no select de `getUserWithBranding`.
- `backend/src/auth/auth.service.spec.ts` — teste do vínculo no register (criar se não existir).
- `backend/src/features/companies/companies.service.ts` — auto-slug no `create`.
- `backend/src/features/companies/companies.controller.ts` — endpoint público `by-slug`.
- `backend/src/features/companies/companies.service.spec.ts` — teste do by-slug (criar se não existir).
- `backend/src/features/office/office.service.ts` — OR nas queries de clientes/processos (`dashboard`, `listClients`); slug edit em `updateCompany`.
- `backend/src/features/office/dto/update-company.dto.ts` — `slug` no `OfficeUpdateCompanyDto`.

**Frontend (criar):**
- `frontend/src/store/whitelabelStore.ts` — estado leve do escritório whitelabel ativo.
- `frontend/src/pages/whitelabel/WhitelabelPage.tsx` — página `/i/:slug`.

**Frontend (modificar):**
- `frontend/src/types/types.ts` — `slug` em `CompanyBranding`; `company_slug` em `RegisterValues`.
- `frontend/src/services/companies.service.ts` — `getCompanyBySlug`.
- `frontend/src/utils/branding.ts` — fallback whitelabel em `getUserCompany`.
- `frontend/src/contexts/ThemeProvider.tsx` — lê whitelabel quando não há user.
- `frontend/src/routes/routes.tsx` — rota pública `/i/:slug`.
- `frontend/src/pages/auth/RegisterPage.tsx` — envia `company_slug`.
- `frontend/src/pages/office/OfficeDashboardPage.tsx` — botão + modal "Meu site do escritório".
- `frontend/src/pages/office/OfficeCompanySettingsPage.tsx` — campo de edição do slug.

---

### Task 1: Helper de geração de slug

**Files:**
- Create: `backend/src/features/companies/slug.util.ts`
- Test: `backend/src/features/companies/slug.util.spec.ts`

**Interfaces:**
- Produces:
  - `slugify(name: string): string` — normaliza para `[a-z0-9-]`.
  - `generateUniqueSlug(name: string, exists: (slug: string) => Promise<boolean>): Promise<string>` — sufixa `-2`, `-3`… até `exists` retornar `false`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/features/companies/slug.util.spec.ts
import { slugify, generateUniqueSlug } from './slug.util';

describe('slugify', () => {
  it('normaliza acentos, espaços e símbolos', () => {
    expect(slugify('Escritório Alpha & Co')).toBe('escritorio-alpha-co');
  });
  it('colapsa hífens e tira das pontas', () => {
    expect(slugify('  --Náutica  Premium--  ')).toBe('nautica-premium');
  });
  it('string sem alfanumérico vira fallback estável', () => {
    expect(slugify('###')).toBe('escritorio');
  });
});

describe('generateUniqueSlug', () => {
  it('retorna o slug base quando livre', async () => {
    const slug = await generateUniqueSlug('Alpha Co', async () => false);
    expect(slug).toBe('alpha-co');
  });
  it('sufixa incrementalmente quando há colisão', async () => {
    const taken = new Set(['alpha-co', 'alpha-co-2']);
    const slug = await generateUniqueSlug('Alpha Co', async (s) => taken.has(s));
    expect(slug).toBe('alpha-co-3');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest --maxWorkers=2 src/features/companies/slug.util.spec.ts`
Expected: FAIL — `Cannot find module './slug.util'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/features/companies/slug.util.ts
export function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // não-alfanumérico → hífen
    .replace(/-+/g, '-') // colapsa hífens
    .replace(/^-|-$/g, ''); // tira das pontas
  return base || 'escritorio'; // fallback quando nome não tem alfanumérico
}

export async function generateUniqueSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let n = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest --maxWorkers=2 src/features/companies/slug.util.spec.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/features/companies/slug.util.ts backend/src/features/companies/slug.util.spec.ts
git commit -m "feat(companies): helper de geração de slug (whitelabel)"
```

---

### Task 2: Campo `slug` na Company + auto-slug no create + backfill

**Files:**
- Modify: `backend/prisma/schema.prisma` (`model Company`, após `platform_commission_rate`)
- Modify: `backend/src/features/companies/companies.service.ts:100-123` (`create`)
- Create: `backend/prisma/backfill-company-slug.ts`

**Interfaces:**
- Consumes: `generateUniqueSlug` (Task 1).
- Produces: `Company.slug` (nullable, unique) no banco; toda Company criada via `companies.service.create` recebe slug.

- [ ] **Step 1: Adicionar o campo no schema**

Em `backend/prisma/schema.prisma`, dentro de `model Company`, logo após a linha `platform_commission_rate Decimal? @db.Decimal(5, 2)`:

```prisma
  // Identificador do site whitelabel do escritório (/i/:slug).
  // Auto-gerado do nome no create; editável no settings. null = sem whitelabel.
  slug String? @unique
```

- [ ] **Step 2: Aplicar no banco (aditivo, Supabase demo)**

Run: `cd backend && npx prisma db push`
Expected: coluna `slug` criada como nullable; `prisma generate` roda junto. NÃO usar `migrate deploy`.

- [ ] **Step 3: Injetar auto-slug no create**

Em `companies.service.ts`, no método `create`, trocar o bloco que cria a company (linhas ~112-113):

```ts
      const { logo: logoBase64, ...rest } = data;
      const slug = await generateUniqueSlug(
        rest.name,
        async (s) =>
          (await this.prisma.company.findUnique({ where: { slug: s } })) !==
          null,
      );
      const created = await this.prisma.company.create({
        data: { ...rest, slug },
      });
```

E adicionar o import no topo do arquivo:

```ts
import { generateUniqueSlug } from './slug.util';
```

- [ ] **Step 4: Criar o script de backfill**

```ts
// backend/prisma/backfill-company-slug.ts
import { PrismaClient } from '@prisma/client';
import { generateUniqueSlug } from '../src/features/companies/slug.util';

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    where: { slug: null },
    select: { id: true, name: true },
  });
  for (const c of companies) {
    const slug = await generateUniqueSlug(
      c.name,
      async (s) =>
        (await prisma.company.findUnique({ where: { slug: s } })) !== null,
    );
    await prisma.company.update({ where: { id: c.id }, data: { slug } });
    console.log(`${c.name} → ${slug}`);
  }
  console.log(`Backfill concluído: ${companies.length} escritórios.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 5: Rodar o backfill**

Run: `cd backend && npx ts-node prisma/backfill-company-slug.ts`
Expected: uma linha por escritório existente + "Backfill concluído".

- [ ] **Step 6: Verificar que o create ainda compila**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/features/companies/companies.service.ts backend/prisma/backfill-company-slug.ts
git commit -m "feat(companies): campo slug + auto-geração no create + backfill"
```

---

### Task 3: Fallback de comissão para `client.company_id` (núcleo)

**Files:**
- Modify: `backend/src/features/contracts/contracts.service.ts:259` e `:496`
- Test: `backend/src/features/contracts/contracts.service.spec.ts`

**Interfaces:**
- Consumes: `Process.client.company_id` (escalar já carregado).
- Produces: comissão de escritório resolvida por `client.consultant?.company_id ?? client.company_id`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao `describe('ContractsService — resolveCommissionFromTotal', ...)` em `contracts.service.spec.ts`:

```ts
  it('cliente vinculado direto ao escritório (sem consultor) gera comissão de escritório', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      specialist: { id: 's1', commission_rate: null, company_id: null },
      client: { consultant: null, company_id: 'c1' },
      car: { valor: 100000 },
      boat: null,
      aircraft: null,
      accepted_proposal: null,
    });
    prisma.company.findUnique.mockResolvedValue({
      name: 'Escritório Whitelabel',
      cnpj: '11222333000181',
      bank: null,
      agency: null,
      checking_account: null,
      commission_rate: 8,
    });
    const svc = mkSvc(prisma, mkPlatformCompanyService(10));

    const result = await (svc as any).resolveCommissionFromTotal('p1', 20);

    expect(result.officeRate).toBe(8);
    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
    });
  });

  it('consultor tem prioridade sobre o company_id direto do cliente', async () => {
    const prisma = mkPrisma();
    prisma.process.findUnique.mockResolvedValue({
      specialist: { id: 's1', commission_rate: null, company_id: null },
      client: { consultant: { company_id: 'consultantCo' }, company_id: 'directCo' },
      car: { valor: 100000 },
      boat: null,
      aircraft: null,
      accepted_proposal: null,
    });
    prisma.company.findUnique.mockResolvedValue({
      name: 'Escritório do Consultor',
      cnpj: '11222333000181',
      bank: null,
      agency: null,
      checking_account: null,
      commission_rate: 8,
    });
    const svc = mkSvc(prisma, mkPlatformCompanyService(10));

    await (svc as any).resolveCommissionFromTotal('p1', 20);

    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: 'consultantCo' },
    });
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx jest --maxWorkers=2 src/features/contracts/contracts.service.spec.ts -t "vinculado direto"`
Expected: FAIL — `officeRate` é 0 (código ainda não olha `client.company_id`) e `company.findUnique` não foi chamado.

- [ ] **Step 3: Aplicar o fallback nos dois call sites**

Em `contracts.service.ts`, na linha ~259 (dentro de `getContractPrefillData`):

```ts
      processData.client?.consultant?.company_id ??
        processData.client?.company_id ??
        null,
```

Em `contracts.service.ts`, na linha ~496 (dentro de `resolveCommissionFromTotal`):

```ts
        process.client?.consultant?.company_id ??
          process.client?.company_id ??
          null,
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx jest --maxWorkers=2 src/features/contracts/contracts.service.spec.ts -t "vinculado direto|prioridade sobre"`
Expected: PASS (2 testes novos).

> Nota: há 5 testes pré-existentes quebrados neste arquivo (mockam `specialist.company_id`, mas o código lê `client.consultant.company_id`) — não são regressão desta task. Verifique com `git stash` que eles já falhavam antes, mas **não** os conserte aqui (fora de escopo).

- [ ] **Step 5: Commit**

```bash
git add backend/src/features/contracts/contracts.service.ts backend/src/features/contracts/contracts.service.spec.ts
git commit -m "feat(contracts): comissão de escritório cai pra client.company_id sem consultor"
```

---

### Task 4: Cadastro vincula cliente ao escritório via `company_slug`

**Files:**
- Modify: `backend/src/auth/dto/auth.ts` (`UserRegisterDto`)
- Modify: `backend/src/auth/auth.service.ts:38-68` (`register`)
- Test: `backend/src/auth/auth.service.spec.ts` (criar se não existir)

**Interfaces:**
- Consumes: `Company.slug` (Task 2).
- Produces: `POST /api/auth/register` aceita `company_slug?: string`; CUSTOMER criado com `company_id` quando o slug resolve.

- [ ] **Step 1: Adicionar `company_slug` ao DTO**

No fim da classe `UserRegisterDto` em `backend/src/auth/dto/auth.ts`, antes do `}` final:

```ts
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug inválido' })
  company_slug?: string;
```

Garantir que `Matches` está importado de `class-validator` no topo do arquivo (adicionar se faltar).

- [ ] **Step 2: Escrever o teste que falha**

```ts
// backend/src/auth/auth.service.spec.ts
import { AuthService } from './auth.service';

function mkPrisma(company: any) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => ({
        id: 'u1',
        ...data,
      })),
    },
    company: { findUnique: jest.fn().mockResolvedValue(company) },
  } as any;
}

function mkSvc(prisma: any) {
  // demais deps não são usadas no caminho de register feliz
  const svc = new AuthService(
    prisma,
    {} as any,
    {} as any,
    {} as any,
  );
  // queueWelcomeEmail é fire-and-forget; stub pra não tocar SES
  (svc as any).queueWelcomeEmail = jest.fn();
  return svc;
}

const baseData = {
  name: 'Ana',
  surname: 'Silva',
  email: 'ana@x.com',
  cpf: '12345678901',
  rg: '1234567',
  phone: '11999998888',
  password: 'secret123',
};

describe('AuthService.register — vínculo whitelabel', () => {
  it('seta company_id quando company_slug resolve', async () => {
    const prisma = mkPrisma({ id: 'c1' });
    const svc = mkSvc(prisma);

    await svc.register({ ...baseData, company_slug: 'alpha-co' } as any);

    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { slug: 'alpha-co' },
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ company_id: 'c1' }),
      }),
    );
  });

  it('cadastra sem vínculo quando o slug não existe', async () => {
    const prisma = mkPrisma(null);
    const svc = mkSvc(prisma);

    await svc.register({ ...baseData, company_slug: 'inexistente' } as any);

    const createArg = prisma.user.create.mock.calls[0][0];
    expect(createArg.data.company_id).toBeUndefined();
  });
});
```

> Antes de rodar, confira o construtor real de `AuthService` (ordem/quantidade de deps) e ajuste `mkSvc`. Se a assinatura divergir, corrija o stub — não o teste de comportamento.

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && npx jest --maxWorkers=2 src/auth/auth.service.spec.ts`
Expected: FAIL — `register` ignora `company_slug` (não chama `company.findUnique`, não seta `company_id`).

- [ ] **Step 4: Implementar o vínculo no register**

Em `auth.service.ts`, dentro de `register`, substituir o bloco de separação/criação (linhas ~52-61):

```ts
    // Separação da req — company_slug é resolvido no servidor, não persistido cru
    const { password, company_slug, ...dataSave } = data;

    // Resolve o escritório do whitelabel (se veio). Slug inválido/ausente →
    // cadastra sem vínculo (não quebra o signup).
    let companyId: string | undefined;
    if (company_slug) {
      const company = await this.prismaService.company.findUnique({
        where: { slug: company_slug },
      });
      companyId = company?.id;
    }

    // Criar o hash da senha
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Cria o usuário
    const user = await this.prismaService.user.create({
      data: {
        ...dataSave,
        password_hash: passwordHash,
        role: registerRole,
        ...(companyId ? { company_id: companyId } : {}),
      },
    });
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && npx jest --maxWorkers=2 src/auth/auth.service.spec.ts`
Expected: PASS (2 testes).

- [ ] **Step 6: Commit**

```bash
git add backend/src/auth/dto/auth.ts backend/src/auth/auth.service.ts backend/src/auth/auth.service.spec.ts
git commit -m "feat(auth): register vincula cliente ao escritório via company_slug"
```

---

### Task 5: Endpoint público `GET /companies/by-slug/:slug`

**Files:**
- Modify: `backend/src/features/companies/companies.service.ts` (novo método `findBySlug`)
- Modify: `backend/src/features/companies/companies.controller.ts` (nova rota pública)
- Test: `backend/src/features/companies/companies.service.spec.ts` (criar se não existir)

**Interfaces:**
- Consumes: `Company.slug` (Task 2), `resolveLogoUrl` (já existe em `companies.service.ts`).
- Produces: `GET /api/companies/by-slug/:slug` → `{ id, name, logoUrl, color_identity, slug }`; 404 se não existir.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// backend/src/features/companies/companies.service.spec.ts
import { NotFoundException } from '@nestjs/common';
import { CompaniesService } from './companies.service';

function mkSvc(company: any) {
  const prisma = {
    company: { findUnique: jest.fn().mockResolvedValue(company) },
  } as any;
  const s3 = {} as any;
  const svc = new CompaniesService(prisma, s3);
  (svc as any).resolveLogoUrl = jest.fn().mockResolvedValue('https://logo');
  return { svc, prisma };
}

describe('CompaniesService.findBySlug', () => {
  it('retorna branding público quando o slug existe', async () => {
    const { svc } = mkSvc({
      id: 'c1',
      name: 'Alpha',
      slug: 'alpha',
      logo: 'companies/x.png',
      color_identity: ['#111', '#222'],
    });

    const result = await svc.findBySlug('alpha');

    expect(result).toEqual({
      id: 'c1',
      name: 'Alpha',
      slug: 'alpha',
      logoUrl: 'https://logo',
      color_identity: ['#111', '#222'],
    });
  });

  it('lança NotFound quando o slug não existe', async () => {
    const { svc } = mkSvc(null);
    await expect(svc.findBySlug('nope')).rejects.toThrow(NotFoundException);
  });
});
```

> Ajuste `new CompaniesService(...)` à assinatura real do construtor antes de rodar.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx jest --maxWorkers=2 src/features/companies/companies.service.spec.ts`
Expected: FAIL — `findBySlug` não existe.

- [ ] **Step 3: Implementar `findBySlug` no service**

```ts
  // Branding público do whitelabel — consumido pela página /i/:slug (sem auth).
  async findBySlug(slug: string) {
    const company = await this.prisma.company.findUnique({ where: { slug } });
    if (!company) {
      throw new NotFoundException('Escritório não encontrado');
    }
    const logoUrl = await this.resolveLogoUrl(company.logo);
    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      logoUrl,
      color_identity: company.color_identity,
    };
  }
```

(`NotFoundException` já é importado no arquivo — confirmar.)

- [ ] **Step 4: Expor a rota pública no controller**

Em `companies.controller.ts`, adicionar (antes da rota `@Get(':id')` para o `:id` não capturar `by-slug`):

```ts
  @Public()
  @Get('by-slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.companiesService.findBySlug(slug);
  }
```

Garantir imports de `@Public()` (de `src/auth/decorators` ou equivalente já usado no projeto) e `Param`.

- [ ] **Step 5: Rodar e ver passar + compilar**

Run: `cd backend && npx jest --maxWorkers=2 src/features/companies/companies.service.spec.ts && npx tsc --noEmit`
Expected: PASS (2 testes) + sem erros de tipo.

- [ ] **Step 6: Commit**

```bash
git add backend/src/features/companies/companies.service.ts backend/src/features/companies/companies.controller.ts backend/src/features/companies/companies.service.spec.ts
git commit -m "feat(companies): endpoint público by-slug para branding whitelabel"
```

---

### Task 6: Visibilidade do escritório inclui clientes vinculados direto

**Files:**
- Modify: `backend/src/features/office/office.service.ts` (`dashboard` `:72-83`, `listClients` `:288-323`)
- Test: `backend/src/features/office/office.service.spec.ts` (arquivo já existe)

**Interfaces:**
- Consumes: `User.company_id`, `User.consultant.company_id`.
- Produces: contagens e listagem do OFFICE incluem CUSTOMERs com `company_id` da própria Company (mesmo sem consultor).

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao `office.service.spec.ts` (seguindo o padrão de mock já presente no arquivo — inspecionar antes):

```ts
  it('dashboard conta clientes vinculados direto ao escritório (sem consultor)', async () => {
    // prisma.user.count é chamado 3x (2 consultores + clientes); prisma.process.count 1x.
    // Verifica que o where de clientes usa OR incluindo { company_id }.
    // (Ajustar índices conforme a ordem real do Promise.all.)
    const clientsWhere = prismaUserCountCalls[2].where;
    expect(clientsWhere.OR).toEqual([
      { consultant: { company_id: 'company-1' } },
      { company_id: 'company-1' },
    ]);
  });
```

> Este arquivo já tem infraestrutura de mock — reutilize-a. Se for mais simples asserir via `toHaveBeenCalledWith`, faça isso. O comportamento a travar: o `where` de clientes/processos contém o `OR` com `{ company_id }`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx jest --maxWorkers=2 src/features/office/office.service.spec.ts -t "vinculados direto"`
Expected: FAIL — where atual só tem `consultant: { company_id }`.

- [ ] **Step 3: Aplicar o OR em `dashboard`**

Em `office.service.ts`, no `Promise.all` do `dashboard`, trocar o count de clientes (`:72-77`) e o de processos (`:78-83`):

```ts
      this.prisma.user.count({
        where: {
          role: UserRole.CUSTOMER,
          OR: [
            { consultant: { company_id: companyId } },
            { company_id: companyId },
          ],
        },
      }),
      this.prisma.process.count({
        where: {
          status: { notIn: [ProcessStatus.COMPLETED, ProcessStatus.REJECTED] },
          client: {
            OR: [
              { consultant: { company_id: companyId } },
              { company_id: companyId },
            ],
          },
        },
      }),
```

- [ ] **Step 4: Aplicar o OR em `listClients`**

Em `listClients`, o `where.OR` já é usado para a busca textual (`q`) — **não sobrescrever**. Trocar as atribuições de escopo por um bloco em `where.AND` para não colidir:

No ramo ADMIN (`:297`):

```ts
      if (opts.companyId)
        where.AND = [
          {
            OR: [
              { consultant: { company_id: opts.companyId } },
              { company_id: opts.companyId },
            ],
          },
        ];
      if (opts.consultantId) where.consultant_id = opts.consultantId;
```

No ramo OFFICE (`:301`), trocar `where.consultant = { company_id: scope.companyId }` por:

```ts
      where.AND = [
        {
          OR: [
            { consultant: { company_id: scope.companyId } },
            { company_id: scope.companyId },
          ],
        },
      ];
```

(O filtro `q` continua populando `where.OR` — Prisma combina `AND` + `OR` de topo corretamente. Confirmar que o teste de busca existente segue verde.)

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && npx jest --maxWorkers=2 src/features/office/office.service.spec.ts`
Expected: PASS (novo teste + os pré-existentes do arquivo).

- [ ] **Step 6: Commit**

```bash
git add backend/src/features/office/office.service.ts backend/src/features/office/office.service.spec.ts
git commit -m "feat(office): dashboard e clientes incluem vínculo direto ao escritório"
```

---

### Task 7: Slug no branding do login + edição do slug pelo OFFICE

**Files:**
- Modify: `backend/src/auth/auth.service.ts:221` e `:232` (select de `getUserWithBranding`)
- Modify: `backend/src/features/office/dto/update-company.dto.ts` (`slug` em `OfficeUpdateCompanyDto`)
- Modify: `backend/src/features/office/office.service.ts` (`updateCompany` — validar unicidade do slug)
- Test: `backend/src/features/office/office.service.spec.ts`

**Interfaces:**
- Consumes: `Company.slug`, `slugify` (Task 1).
- Produces: `user.company.slug` chega no login; `PATCH /office/company` aceita `slug` validado e único.

- [ ] **Step 1: Incluir slug no select do branding**

Em `auth.service.ts`, `getUserWithBranding`, adicionar `slug: true` nos dois `company.select` (o direto em `:221` e o de `consultant.company` em `:232`):

```ts
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            color_identity: true,
          },
        },
```

(Repetir no select de `consultant.company`.)

- [ ] **Step 2: Adicionar slug ao `OfficeUpdateCompanyDto`**

Em `office/dto/update-company.dto.ts`, dentro da classe:

```ts
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug deve conter apenas letras minúsculas, números e hífens',
  })
  @MaxLength(80)
  slug?: string;
```

(`Matches` e `MaxLength` já importados no arquivo.)

- [ ] **Step 3: Escrever o teste que falha (unicidade do slug)**

Adicionar ao `office.service.spec.ts`:

```ts
  it('updateCompany rejeita slug já usado por outro escritório', async () => {
    // mock: company.findFirst({ where: { slug, NOT: { id } } }) → outra company
    // Espera ConflictException/BadRequest (conforme padrão do arquivo p/ cnpj).
  });
```

> Espelhe exatamente o teste de duplicidade de CNPJ que já existe no arquivo (mesmo tipo de exceção e forma de mock).

- [ ] **Step 4: Rodar e ver falhar**

Run: `cd backend && npx jest --maxWorkers=2 src/features/office/office.service.spec.ts -t "slug já usado"`
Expected: FAIL — `updateCompany` não valida slug.

- [ ] **Step 5: Validar unicidade no `updateCompany`**

Em `office.service.ts`, dentro de `updateCompany`, antes do `prisma.company.update`, espelhando a checagem de CNPJ existente (`:29`):

```ts
    if (dto.slug) {
      const dup = await this.prisma.company.findFirst({
        where: { slug: dto.slug, NOT: { id: companyId } },
      });
      if (dup) {
        throw new ConflictException('Este endereço de site já está em uso');
      }
    }
```

(`ConflictException` — usar a mesma exceção que a checagem de CNPJ usa neste arquivo.)

- [ ] **Step 6: Rodar e ver passar + compilar**

Run: `cd backend && npx jest --maxWorkers=2 src/features/office/office.service.spec.ts && npx tsc --noEmit`
Expected: PASS + sem erros de tipo.

- [ ] **Step 7: Commit**

```bash
git add backend/src/auth/auth.service.ts backend/src/features/office/dto/update-company.dto.ts backend/src/features/office/office.service.ts backend/src/features/office/office.service.spec.ts
git commit -m "feat(office): slug no branding do login + edição validada do slug"
```

---

### Task 8: Frontend — tipos, service, store e fallback de branding

**Files:**
- Modify: `frontend/src/types/types.ts` (`CompanyBranding.slug`, `RegisterValues.company_slug`)
- Modify: `frontend/src/services/companies.service.ts` (`getCompanyBySlug`)
- Create: `frontend/src/store/whitelabelStore.ts`
- Modify: `frontend/src/utils/branding.ts` (`getUserCompany` cai no whitelabel)
- Modify: `frontend/src/contexts/ThemeProvider.tsx`

**Interfaces:**
- Consumes: `GET /companies/by-slug/:slug` (Task 5).
- Produces:
  - `getCompanyBySlug(slug: string): Promise<CompanyBranding>`
  - `useWhitelabel` store: `{ company: CompanyBranding | null, setCompany(c) }`
  - `ThemeProvider` aplica brand do whitelabel quando não há user logado.

- [ ] **Step 1: Estender os tipos**

Em `frontend/src/types/types.ts`, na interface `CompanyBranding` (linha ~135), adicionar:

```ts
  slug?: string | null;
```

E em `RegisterValues` (linha ~186), adicionar:

```ts
  company_slug?: string;
```

- [ ] **Step 2: Adicionar `getCompanyBySlug` ao service**

Em `frontend/src/services/companies.service.ts`:

```ts
export async function getCompanyBySlug(slug: string): Promise<CompanyBranding> {
  const { data } = await api.get<CompanyBranding>(`/companies/by-slug/${slug}`);
  return data;
}
```

(Importar `CompanyBranding` de `../types/types` se ainda não estiver importado.)

- [ ] **Step 3: Criar o store do whitelabel**

```ts
// frontend/src/store/whitelabelStore.ts
import { create } from "zustand";
import type { CompanyBranding } from "../types/types";

// ponytail: brand do whitelabel vive em memória; sobrevive à navegação SPA.
// Um refresh fora de /i/:slug perde o brand (aceitável) — persistir em
// sessionStorage se essa UX passar a importar.
interface WhitelabelState {
  company: CompanyBranding | null;
  setCompany: (c: CompanyBranding | null) => void;
}

export const useWhitelabel = create<WhitelabelState>((set) => ({
  company: null,
  setCompany: (company) => set({ company }),
}));
```

- [ ] **Step 4: Fallback em `getUserCompany`**

`getUserCompany` é chamado sem o whitelabel; o fallback fica no ThemeProvider (Step 5) para não acoplar o util ao store. Deixar `branding.ts` como está. **(Nenhuma mudança de código neste step — decisão de design.)**

- [ ] **Step 5: ThemeProvider aplica brand do whitelabel quando anônimo**

Reescrever `frontend/src/contexts/ThemeProvider.tsx`:

```tsx
import type React from "react";
import { useLayoutEffect } from "react";
import { useAuth } from "../store/authStateManager";
import { useWhitelabel } from "../store/whitelabelStore";
import { getBrandColors, getUserCompany } from "../utils/branding";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const user = useAuth((state) => state.user);
  const whitelabel = useWhitelabel((state) => state.company);
  // Usuário logado tem prioridade; visitante anônimo em /i/:slug usa o whitelabel.
  const company = getUserCompany(user) ?? whitelabel;
  const { primary, secondary, primaryFg, secondaryFg } = getBrandColors(company);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand-primary", primary);
    root.style.setProperty("--brand-secondary", secondary);
    root.style.setProperty("--brand-primary-fg", primaryFg);
    root.style.setProperty("--brand-secondary-fg", secondaryFg);
  }, [primary, secondary, primaryFg, secondaryFg]);

  return <>{children}</>;
}
```

- [ ] **Step 6: Build + lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: build e lint sem erros.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/types.ts frontend/src/services/companies.service.ts frontend/src/store/whitelabelStore.ts frontend/src/contexts/ThemeProvider.tsx
git commit -m "feat(front): tipos, service by-slug, store e fallback de branding whitelabel"
```

---

### Task 9: Frontend — rota e página `/i/:slug`

**Files:**
- Create: `frontend/src/pages/whitelabel/WhitelabelPage.tsx`
- Modify: `frontend/src/routes/routes.tsx` (rota pública `/i/:slug`)

**Interfaces:**
- Consumes: `getCompanyBySlug` (Task 8), `useWhitelabel` (Task 8).
- Produces: rota `/i/:slug` que aplica o brand e leva ao catálogo + cadastro do escritório.

- [ ] **Step 1: Criar a página**

```tsx
// frontend/src/pages/whitelabel/WhitelabelPage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCompanyBySlug } from "../../services/companies.service";
import { useWhitelabel } from "../../store/whitelabelStore";
import { resolveCompanyLogo } from "../../utils/branding";
import Button from "../../components/ui/button";

export default function WhitelabelPage() {
  const { slug } = useParams<{ slug: string }>();
  const setCompany = useWhitelabel((s) => s.setCompany);
  const company = useWhitelabel((s) => s.company);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug) return;
    getCompanyBySlug(slug)
      .then(setCompany)
      .catch(() => setError("Escritório não encontrado."));
  }, [slug, setCompany]);

  if (error) return <div className="p-8 text-status-bad">{error}</div>;
  if (!company) return <div className="p-8 text-muted">Carregando...</div>;

  const logo = resolveCompanyLogo(company);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-brand-primary text-brand-primary-fg p-8">
      {logo && <img src={logo} alt={company.name} className="h-20 object-contain" />}
      <h1 className="text-2xl font-semibold">{company.name}</h1>
      <p className="opacity-80 max-w-md text-center">
        Explore nosso catálogo exclusivo e crie sua conta com nosso escritório.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => navigate("/catalog/cars")}>Ver catálogo</Button>
        <Button onClick={() => navigate("/register")}>Criar conta</Button>
      </div>
    </div>
  );
}
```

> Ajuste classes utilitárias (`bg-brand-primary`, `text-brand-primary-fg`) às que o projeto realmente expõe no Tailwind — confira `frontend/src/index.css`/config. O brand já foi aplicado às CSS vars pelo ThemeProvider ao setar o whitelabel.

- [ ] **Step 2: Registrar a rota pública**

Em `frontend/src/routes/routes.tsx`, junto às rotas públicas (ex: perto de `/catalog/:category`), adicionar:

```tsx
import WhitelabelPage from "../pages/whitelabel/WhitelabelPage";
// ...
{ path: "/i/:slug", element: <WhitelabelPage /> },
```

- [ ] **Step 3: Build + lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: sem erros.

- [ ] **Step 4: Verificação visual (Playwright, mockando a API)**

Escrever um teste Playwright que intercepta `GET **/companies/by-slug/alpha` retornando `{ id, name:'Alpha', slug:'alpha', color_identity:['#0a5','#083'], logoUrl:null }`, navega para `/i/alpha` e assere que o nome aparece e que `--brand-primary` do `documentElement` é `#0a5`.

Run: `cd frontend && npx playwright test <arquivo>`
Expected: PASS. (Nunca subir o backend real.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/whitelabel/WhitelabelPage.tsx frontend/src/routes/routes.tsx
git commit -m "feat(front): rota e página /i/:slug com branding do escritório"
```

---

### Task 10: Frontend — cadastro envia `company_slug`

**Files:**
- Modify: `frontend/src/pages/auth/RegisterPage.tsx` (`onSubmit`)

**Interfaces:**
- Consumes: `useWhitelabel` (Task 8), `RegisterValues.company_slug` (Task 8).
- Produces: `auth.register` recebe `company_slug` quando o cadastro veio de um whitelabel.

- [ ] **Step 1: Injetar o slug no payload**

Em `RegisterPage.tsx`, importar o store e incluir o slug no `registerData` dentro de `onSubmit` (perto do bloco que injeta `consultant_id`, ~linha 115):

```tsx
import { useWhitelabel } from "../../store/whitelabelStore";
// dentro do componente:
const whitelabelCompany = useWhitelabel((s) => s.company);
// dentro de onSubmit, antes de await auth.register(registerData):
if (whitelabelCompany?.slug) {
  registerData.company_slug = whitelabelCompany.slug;
}
```

- [ ] **Step 2: Build + lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Verificação (Playwright, opcional)**

Se houver teste Playwright de cadastro: preencher o form vindo de `/i/:slug`, interceptar `POST **/auth/register` e assertir que o body contém `company_slug: 'alpha'`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/auth/RegisterPage.tsx
git commit -m "feat(front): cadastro envia company_slug do whitelabel"
```

---

### Task 11: Frontend — botão + modal "Meu site do escritório" (identidade da PLATAFORMA)

**Files:**
- Modify: `frontend/src/pages/office/OfficeDashboardPage.tsx`

**Interfaces:**
- Consumes: `user.company.slug` (Task 7), `DEFAULT_BRAND_PRIMARY/SECONDARY` de `utils/branding.ts`.
- Produces: botão que abre modal com a URL `${origin}/i/${slug}`, copiar e abrir.

- [ ] **Step 1: Implementar botão + modal com cores fixas da plataforma**

Em `OfficeDashboardPage.tsx`, adicionar (usar o componente de Dialog/Modal que o projeto já tem em `components/ui`; se não houver, um overlay simples). **Não usar `var(--brand-*)`** — usar as constantes da plataforma:

```tsx
import { useState } from "react";
import { useAuth } from "../../store/authStateManager";
import { DEFAULT_BRAND_PRIMARY, DEFAULT_BRAND_SECONDARY } from "../../utils/branding";

// dentro do componente:
const user = useAuth((s) => s.user);
const slug = user?.company?.slug;
const [open, setOpen] = useState(false);
const url = slug ? `${window.location.origin}/i/${slug}` : null;

// no JSX (ex: no topo do dashboard), só quando há slug:
{url && (
  <>
    <button
      onClick={() => setOpen(true)}
      style={{ backgroundColor: DEFAULT_BRAND_PRIMARY, color: "#fff" }}
      className="rounded-md px-4 py-2 text-sm font-medium"
    >
      Meu site do escritório
    </button>
    {open && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={() => setOpen(false)}
      >
        <div
          className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
          style={{ borderTop: `4px solid ${DEFAULT_BRAND_SECONDARY}` }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="mb-2 text-lg font-semibold" style={{ color: DEFAULT_BRAND_SECONDARY }}>
            Seu site whitelabel
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            Compartilhe este link — quem se cadastrar por ele vira cliente do seu escritório.
          </p>
          <code className="block break-all rounded bg-gray-100 p-3 text-sm">{url}</code>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(url)}
              style={{ backgroundColor: DEFAULT_BRAND_PRIMARY, color: "#fff" }}
              className="rounded-md px-4 py-2 text-sm"
            >
              Copiar link
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border px-4 py-2 text-sm"
              style={{ borderColor: DEFAULT_BRAND_PRIMARY, color: DEFAULT_BRAND_SECONDARY }}
            >
              Abrir
            </a>
          </div>
        </div>
      </div>
    )}
  </>
)}
```

> **Constraint desta task:** este componente representa a plataforma, então usa `DEFAULT_BRAND_PRIMARY/SECONDARY` fixos — **jamais** `var(--brand-primary)` (que no dashboard OFFICE é a cor do escritório). Ver `docs/superpowers/specs/2026-08-03-whitelabel-escritorio-design.md` §7.

- [ ] **Step 2: Build + lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Verificação visual (Playwright)**

Logar como OFFICE (mockando `user.company.slug='alpha'` no store/localStorage), abrir o dashboard, clicar em "Meu site do escritório" e assertir que o modal mostra `/i/alpha` e que a cor do botão é `#3C3C3C` (não a cor do escritório).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/office/OfficeDashboardPage.tsx
git commit -m "feat(office-front): botão/modal do site whitelabel com identidade da plataforma"
```

---

### Task 12: Frontend — edição do slug no settings do escritório

**Files:**
- Modify: `frontend/src/pages/office/OfficeCompanySettingsPage.tsx`

**Interfaces:**
- Consumes: `officeService.updateCompany` (já envia o form; backend Task 7 aceita `slug`).
- Produces: campo editável de slug no settings, com dica da URL resultante.

- [ ] **Step 1: Adicionar o campo de slug ao form**

Em `OfficeCompanySettingsPage.tsx`, incluir `slug` no estado do form (já vem em `company` do `getCompany`) e um input:

```tsx
<label className="block text-sm font-medium">Endereço do site (slug)</label>
<input
  value={form.slug ?? ""}
  onChange={(e) =>
    setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
  }
  className="w-full rounded-md border px-3 py-2"
  placeholder="meu-escritorio"
/>
<p className="text-xs text-muted">
  Seu site: {window.location.origin}/i/{form.slug || "meu-escritorio"}
</p>
```

> O `slug` já é enviado por `officeService.updateCompany(form)` (manda o form inteiro). Confirme que `form` inclui `slug` (adicionar ao estado inicial a partir de `company.slug`).

- [ ] **Step 2: Tratar erro de slug duplicado**

O backend retorna 409 (`friendlyMessage` já é injetado pelo interceptor da api). Garantir que o `catch` do `save` exibe `err.friendlyMessage` (o padrão da página provavelmente já faz isso — confirmar).

- [ ] **Step 3: Build + lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/office/OfficeCompanySettingsPage.tsx
git commit -m "feat(office-front): edição do slug do site whitelabel no settings"
```

---

## Verificação final (após todas as tasks)

- [ ] Backend: `cd backend && npx jest --maxWorkers=2 src/features/companies src/features/contracts src/features/office src/auth` — verde nos arquivos tocados (ignorar os 5 testes de comissão pré-quebrados, documentados na Task 3).
- [ ] Backend: `cd backend && npx tsc --noEmit` — sem erros de tipo.
- [ ] Frontend: `cd frontend && npm run build && npm run lint` — sem erros.
- [ ] Fluxo end-to-end (Playwright, API mockada): `/i/:slug` pinta o brand → cadastro envia `company_slug` → (mock) usuário logado com `company_id` → dashboard OFFICE mostra o link. Nunca subir o backend real nesta máquina.
- [ ] Rodar `/adversarial-review` antes do merge (skill do projeto para features novas).
