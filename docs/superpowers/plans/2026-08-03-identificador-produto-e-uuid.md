# Identificador de produto + PK de produtos em UUID — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que um especialista cadastre vários produtos do mesmo marca/modelo via import, distinguindo-os por um `identificador` obrigatório, e migrar a PK dos produtos de `Int` para `UUID`.

**Architecture:** Fase A adiciona um campo `identificador` (chave natural por especialista) aos 3 produtos e troca a chave de deduplicação do import de `(marca, modelo)` para `(specialist_id, identificador)` em todos os pontos de upsert. Fase B troca a PK `Int autoincrement` → `String @db.Uuid` nos 3 produtos e propaga nas FKs, DTOs e front. Fase C exporta os produtos atuais para CSV (antes do wipe) e apaga a base via `prisma db push --accept-data-loss`.

**Tech Stack:** NestJS + Prisma (PostgreSQL/Supabase dev), React + Vite + TypeScript, Jest (`*.spec.ts`, prisma mockado).

## Global Constraints

- **RAM da máquina:** nunca rodar a suite inteira sem cap. Todo comando de teste usa `--maxWorkers=2` e alvo focado (arquivo único). Nunca `npm test` puro.
- **Banco é dev/demo (Supabase com drift):** mudanças de schema vão por `npx prisma db push` (nunca `migrate deploy`). A troca de PK exige `--accept-data-loss`.
- **Consultor não recebe comissão** — nada nesta feature toca comissão.
- **Ordem entre fases é obrigatória:** A → B → C. O export da Fase C roda **antes** do `db push` que reseta a base.
- Mensagens de commit em português, seguindo o padrão do repo (`feat:`, `fix:`, `refactor:`, `test:`).

---

## File Structure

**Fase A**
- `backend/prisma/schema.prisma` — campo `identificador` + `@@unique` em Car/Boat/Aircraft.
- `backend/src/features/product-import-jobs/product-import-jobs.service.ts` — colunas + chave de dedup (3 ramos) + validação de valor vazio.
- `backend/src/features/cars/cars.service.ts` — `xlsxColumns`, `getCsvTemplate`, dedup em `importFromCsv`/`importFromXlsx`.
- `backend/src/features/boats/boats.service.ts` — idem.
- `backend/src/features/aircrafts/aircrafts.service.ts` — idem.
- `backend/src/features/product-import-jobs/product-import-jobs.service.spec.ts` — teste da chave de dedup (criar se não existir).

**Fase B**
- `backend/prisma/schema.prisma` — `id` UUID em Car/Boat/Aircraft; FKs em Car_image/Boat_image/Aircraft_image, Process, Product.
- `backend/src/features/processes/dto/create-process.dto.ts`, `assign-product.dto.ts` — `@IsInt` → `@IsUUID`.
- `backend/src/features/processes/processes.service.ts` — remover `Number(product_id)`.
- Controllers car/boat/aircraft — remover `ParseIntPipe` de params de id.
- `frontend/src/services/{cars,boats,aircrafts}.service.ts` — `getXById(id: string)` + `RawCar/RawBoat/RawAircraft.id: string`.
- `frontend/src/pages/catalog/ProductPage.tsx`, `frontend/src/pages/specialist/ProductFormPage.tsx` — remover `Number(id)`.

**Fase C**
- `backend/scripts/export-produtos-para-csv.ts` — export (novo).

---

## FASE A — Identificador de produto

### Task A1: Schema — campo `identificador`

**Files:**
- Modify: `backend/prisma/schema.prisma` (models `Car`, `Boat`, `Aircraft`)

**Interfaces:**
- Produces: coluna `identificador String` e constraint `@@unique([specialist_id, identificador])` nas 3 tabelas.

- [ ] **Step 1: Adicionar campo e unique em Car**

Em `model Car`, logo abaixo de `modelo String`, adicionar:

```prisma
  identificador              String
```

E junto dos índices existentes, adicionar:

```prisma
  @@unique([specialist_id, identificador])
```

- [ ] **Step 2: Repetir em Boat e Aircraft**

Mesma linha `identificador String` após `modelo` e mesmo `@@unique([specialist_id, identificador])` em `model Boat` e `model Aircraft`.

- [ ] **Step 3: Aplicar no banco dev**

Run: `cd backend && npx prisma db push`
Expected: falha pedindo default para coluna obrigatória em tabela com linhas existentes.

> Se a base tiver produtos, o push vai reclamar da coluna `NOT NULL` sem default. **Não** adicionar default permanente. Para dev, resolver assim: rodar o export da Fase C **antes**, ou aceitar o reset agora com `npx prisma db push --accept-data-loss` (a base será recriada; produtos atuais são recuperados na Fase C). Para esta task isolada, se a base estiver vazia o push passa direto.

- [ ] **Step 4: Regenerar client**

Run: `cd backend && npx prisma generate`
Expected: client regenerado, tipo `Car`/`Boat`/`Aircraft` com `identificador: string`.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(produtos): campo identificador + unique por especialista no schema"
```

---

### Task A2: Colunas de import + templates

**Files:**
- Modify: `backend/src/features/product-import-jobs/product-import-jobs.service.ts` (arrays `carColumns`, `boatColumns`, `aircraftColumns`)
- Modify: `backend/src/features/cars/cars.service.ts` (`xlsxColumns`, `getCsvTemplate`)
- Modify: `backend/src/features/boats/boats.service.ts` (idem)
- Modify: `backend/src/features/aircrafts/aircrafts.service.ts` (idem)

**Interfaces:**
- Consumes: schema da Task A1.
- Produces: templates com coluna `identificador` (obrigatória) nos 3 tipos, em ambos os caminhos (job e service).

- [ ] **Step 1: Adicionar coluna nos arrays do job service**

Em `product-import-jobs.service.ts`, em `carColumns`, `boatColumns` e `aircraftColumns`, adicionar como **primeira** coluna após as required de identidade (logo depois de `modelo`):

```ts
    { name: 'identificador', required: true, type: 'string' },
```

- [ ] **Step 2: Adicionar coluna no `xlsxColumns` de cada service**

Em `cars.service.ts`, `boats.service.ts`, `aircrafts.service.ts`, no array `xlsxColumns`, adicionar a mesma definição após `modelo`:

```ts
    { name: 'identificador', required: true, type: 'string' },
```

- [ ] **Step 3: Atualizar `getCsvTemplate` (headers + exemplo)**

Em cada service, `getCsvTemplate` monta `headers` a partir de `xlsxColumns` (já cobre a nova coluna automaticamente) mas tem um array `exampleValues` posicional. Adicionar o valor de exemplo do `identificador` na **mesma posição** da coluna (após o valor de `modelo`). Ex. em `cars.service.ts`:

```ts
    const exampleValues = [
      'BMW',
      'X5',
      'BMW-X5-1',
      // ...restante inalterado
    ];
```

Fazer o equivalente em boats/aircrafts (valor exemplo `MARCA-MODELO-1`).

- [ ] **Step 4: Atualizar o exemplo do `generateTemplate` (XLSX)**

Em cada service, o objeto `example` passado para `xlsxImportService.generateTemplate` precisa da chave nova:

```ts
      identificador: 'BMW-X5-1',
```

- [ ] **Step 5: Verificar que compila**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add backend/src/features/product-import-jobs/product-import-jobs.service.ts backend/src/features/cars/cars.service.ts backend/src/features/boats/boats.service.ts backend/src/features/aircrafts/aircrafts.service.ts
git commit -m "feat(import): coluna identificador obrigatoria nos templates de produto"
```

---

### Task A3: Chave de dedup por identificador (todos os pontos)

**Files:**
- Modify: `backend/src/features/product-import-jobs/product-import-jobs.service.ts` (`upsertProductFromRow`, 3 ramos)
- Modify: `backend/src/features/cars/cars.service.ts` (`importFromCsv` ~442, `importFromXlsx` ~556)
- Modify: `backend/src/features/boats/boats.service.ts` (`importFromCsv` ~478, `importFromXlsx` ~596)
- Modify: `backend/src/features/aircrafts/aircrafts.service.ts` (`importFromCsv` ~513, `importFromXlsx` ~645)
- Test: `backend/src/features/product-import-jobs/product-import-jobs.service.spec.ts`

**Interfaces:**
- Consumes: campo `identificador` (A1), coluna no payload (A2).
- Produces: dedup determinístico por `(specialist_id, identificador)`; `identificador` gravado no `data` de create/update.

- [ ] **Step 1: Escrever teste que falha (dedup por identificador)**

Se o arquivo `product-import-jobs.service.spec.ts` não existir, criar com um `PrismaService` mockado. O teste verifica que `upsertProductFromRow` para CAR busca por `identificador` e não por `modelo`:

```ts
it('busca produto existente por (specialist_id, identificador), nao por modelo', async () => {
  const findFirst = jest.fn().mockResolvedValue(null);
  const create = jest.fn().mockResolvedValue({ id: 'uuid-1' });
  const prisma = { car: { findFirst, create } } as any;
  const service = new ProductImportJobsService(prisma, {} as any, {} as any);

  await (service as any).upsertProductFromRow(
    'CAR',
    { marca: 'Ferrari', modelo: 'X', identificador: 'FERRARI-X-2', valor: '100', estado: 'SP', ano: '2020' },
    'spec-1',
  );

  expect(findFirst).toHaveBeenCalledWith({
    where: { specialist_id: 'spec-1', identificador: 'FERRARI-X-2' },
  });
  expect(create).toHaveBeenCalledWith({
    data: expect.objectContaining({ identificador: 'FERRARI-X-2' }),
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && npm test -- product-import-jobs.service --maxWorkers=2`
Expected: FAIL (findFirst chamado com marca/modelo, sem identificador no data).

- [ ] **Step 3: Trocar a chave nos 3 ramos do job service**

Em `upsertProductFromRow`, para cada ramo (car/boat/aircraft):
1. Adicionar `identificador: row.identificador` ao objeto `data`.
2. Trocar o `where` do `findFirst`:

```ts
const existing = await this.prisma.car.findFirst({
  where: {
    specialist_id: specialistId,
    identificador: row.identificador?.trim(),
  },
});
```

(idem `this.prisma.boat` / `this.prisma.aircraft`). Manter o resto do fluxo update/create igual. No update, `identificador` já entra via `updateData`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && npm test -- product-import-jobs.service --maxWorkers=2`
Expected: PASS.

- [ ] **Step 5: Trocar a chave nos 6 pontos síncronos**

Em cars/boats/aircrafts service, `importFromCsv` e `importFromXlsx`, cada `findFirst` que hoje busca por `{ marca, modelo, specialist_id }` passa a `{ specialist_id, identificador: row.identificador?.trim() }`, e o objeto de dados do create/update ganha `identificador: row.identificador`.

- [ ] **Step 6: Confirmar compilação e teste**

Run: `cd backend && npx tsc --noEmit && npm test -- product-import-jobs.service --maxWorkers=2`
Expected: sem erro de tipo; teste PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/features
git commit -m "feat(import): dedup de produto por (specialist_id, identificador)"
```

---

### Task A4: Validação de identificador vazio → erro de linha

**Files:**
- Modify: `backend/src/features/product-import-jobs/product-import-jobs.service.ts` (`upsertProductFromRow`, início)
- Test: `backend/src/features/product-import-jobs/product-import-jobs.service.spec.ts`

**Interfaces:**
- Consumes: A3.
- Produces: linha com `identificador` ausente/vazio lança erro (vira `FAILED` / `errorRows`), não cria produto.

- [ ] **Step 1: Escrever teste que falha**

```ts
it('lanca erro quando identificador vem vazio', async () => {
  const prisma = { car: { findFirst: jest.fn(), create: jest.fn() } } as any;
  const service = new ProductImportJobsService(prisma, {} as any, {} as any);

  await expect(
    (service as any).upsertProductFromRow(
      'CAR',
      { marca: 'Ferrari', modelo: 'X', identificador: '  ', valor: '100', estado: 'SP', ano: '2020' },
      'spec-1',
    ),
  ).rejects.toThrow(/identificador/i);
  expect(prisma.car.create).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && npm test -- product-import-jobs.service --maxWorkers=2`
Expected: FAIL (hoje não valida vazio).

- [ ] **Step 3: Guard no início de `upsertProductFromRow`**

Logo no começo do método, antes do `if (productType === ProductType.CAR)`:

```ts
if (!row.identificador || !row.identificador.trim()) {
  throw new BadRequestException('identificador é obrigatório e não pode ser vazio');
}
```

`BadRequestException` já é importado no arquivo. O erro é capturado pelo `try/catch` do loop de `processJob` e vira `FAILED` na linha.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && npm test -- product-import-jobs.service --maxWorkers=2`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/features/product-import-jobs/product-import-jobs.service.ts backend/src/features/product-import-jobs/product-import-jobs.service.spec.ts
git commit -m "feat(import): rejeita linha com identificador vazio"
```

---

## FASE B — PK de produtos em UUID

> A partir daqui a base **será resetada**. Se houver dados a preservar, executar a Fase C (export) **antes** do Step de `db push` da Task B1.

### Task B1: Schema — PK UUID e FKs

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: `Car/Boat/Aircraft.id: String @db.Uuid`; FKs correspondentes como `String? @db.Uuid`.

- [ ] **Step 1: Trocar a PK dos 3 produtos**

Em `model Car`, `model Boat`, `model Aircraft`:

```prisma
  id  String  @id @default(uuid()) @db.Uuid
```

(era `Int @default(autoincrement())`).

- [ ] **Step 2: Trocar as FKs**

- `Car_image.car_id`, `Boat_image.boat_id`, `Aircraft_image.aircraft_id`: `Int?` → `String? @db.Uuid`.
- `Process.car_id`, `Process.boat_id`, `Process.aircraft_id`: `Int?` → `String? @db.Uuid`.
- `Product.car_id`, `Product.boat_id`, `Product.aircraft_id`: `Int?` → `String? @db.Uuid`. Remover o comentário `// TODO: converter ... para UUID`.

- [ ] **Step 3: (SE for preservar dados) rodar o export da Fase C agora**

Ver Task C1. Só então continuar.

- [ ] **Step 4: Aplicar reset no banco dev**

Run: `cd backend && npx prisma db push --accept-data-loss`
Expected: tabelas de produto recriadas com `id` UUID. Aviso de perda de dados é esperado e autorizado.

- [ ] **Step 5: Regenerar client**

Run: `cd backend && npx prisma generate`
Expected: `Car.id` etc. tipados como `string`.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(produtos): PK de Car/Boat/Aircraft migrada para UUID"
```

---

### Task B2: Backend — DTOs, service e pipes

**Files:**
- Modify: `backend/src/features/processes/dto/create-process.dto.ts`
- Modify: `backend/src/features/processes/dto/assign-product.dto.ts`
- Modify: `backend/src/features/processes/processes.service.ts`
- Modify: controllers `cars.controller.ts`, `boats.controller.ts`, `aircrafts.controller.ts`

**Interfaces:**
- Consumes: schema UUID (B1).
- Produces: `product_id` como string/UUID ponta a ponta no backend.

- [ ] **Step 1: DTOs — `@IsInt` → `@IsUUID`**

Em `create-process.dto.ts` e `assign-product.dto.ts`, no campo `product_id`, trocar:

```ts
  @IsUUID('4', { message: 'product_id deve ser um UUID válido' })
  product_id: string;
```

Remover o import de `IsInt` se ficar sem uso; adicionar `IsUUID` ao import de `class-validator`. Remover `Min` se só era usado no id.

- [ ] **Step 2: `processes.service.ts` — remover `Number()`**

Nas linhas que fazem `Number(createProcessDto.product_id)` (~214, 274, 278, 282), usar `createProcessDto.product_id` direto (já é string). Os campos `car_id`/`boat_id`/`aircraft_id` agora recebem string.

- [ ] **Step 3: Controllers — remover `ParseIntPipe` de params de id de produto**

Em `cars.controller.ts`, `boats.controller.ts`, `aircrafts.controller.ts`, trocar `@Param('id', ParseIntPipe) id: number` por `@Param('id') id: string`. Remover import de `ParseIntPipe` se ficar sem uso. Ajustar as assinaturas dos métodos de service chamados (id: string).

- [ ] **Step 4: Ajustar services que recebem id numérico**

Em cars/boats/aircrafts service, métodos `findOne`/`update`/`remove` que tipavam `id: number` passam a `id: string`; remover qualquer `Number(id)` interno. `where: { id }` continua válido (agora string).

- [ ] **Step 5: Compilar**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros. Corrigir cada `id: number` remanescente que o compilador apontar em produto.

- [ ] **Step 6: Rodar testes de produto/processo focados**

Run: `cd backend && npm test -- cars.service --maxWorkers=2 && npm test -- processes.service --maxWorkers=2`
Expected: PASS (ou apenas as falhas pré-existentes de comissão já conhecidas — não relacionadas a id).

- [ ] **Step 7: Commit**

```bash
git add backend/src/features
git commit -m "refactor(backend): product_id como UUID em DTOs, services e controllers"
```

---

### Task B3: Frontend — id de produto como string

**Files:**
- Modify: `frontend/src/services/cars.service.ts`, `boats.service.ts`, `aircrafts.service.ts`
- Modify: `frontend/src/pages/catalog/ProductPage.tsx`
- Modify: `frontend/src/pages/specialist/ProductFormPage.tsx`

**Interfaces:**
- Consumes: API com id UUID (B2).
- Produces: front tratando id de produto como string.

- [ ] **Step 1: Tipos e assinaturas nos services**

Em cada service, `getXById(id: number)` → `getXById(id: string)`. No tipo `RawCar`/`RawBoat`/`RawAircraft`, `id: number` → `id: string`.

- [ ] **Step 2: `ProductPage.tsx` — remover `Number(id)`**

Trocar `getCarById(Number(id))` → `getCarById(id)` (idem boat/aircraft, linhas ~150/153/156). Nos usos `Number(product.id)` (~298, 368) e `productId={Number(id)}` (~670), passar a string direto. Ajustar props que tipavam `productId: number` para `string`.

- [ ] **Step 3: `specialist/ProductFormPage.tsx` — remover `Number(id)`**

Linha ~31 `const productId = Number(id)` → `const productId = id`. Linha ~87 `productId={id ? Number(id) : undefined}` → `productId={id}`. Ajustar tipos de prop para string.

- [ ] **Step 4: Grep de verificação — nenhum `Number(` sobre id de produto**

Run: `cd frontend && grep -rnE "Number\((id|product\.id|productId)" src`
Expected: **sem resultados**. (Os `Number()` de filtros de ano/preço em `CatalogPage.tsx` não casam este padrão e devem permanecer.)

- [ ] **Step 5: Build do front**

Run: `cd frontend && npm run build`
Expected: `tsc -b` sem erros e build conclui. Corrigir qualquer `id: number` de produto que o TS apontar.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "refactor(front): id de produto como string (UUID)"
```

---

## FASE C — Export dos produtos + wipe

### Task C1: Script de export para CSV

**Files:**
- Create: `backend/scripts/export-produtos-para-csv.ts`

**Interfaces:**
- Consumes: base **atual** (antes do reset da Task B1 Step 4).
- Produces: `backend/scripts/out/carros.csv`, `barcos.csv`, `aeronaves.csv` no formato dos templates (com coluna `identificador` preenchida `MARCA-MODELO-seq`).

> **Importante:** este script lê os produtos **antigos** (PK Int, sem coluna `identificador`). Ele gera o `identificador` em memória; não depende do schema novo. Rodar **antes** do `db push --accept-data-loss`.

- [ ] **Step 1: Escrever o script**

```ts
// backend/scripts/export-produtos-para-csv.ts
import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const OUT = join(__dirname, 'out');

function slug(s: string) {
  return (s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// gera MARCA-MODELO-seq por (specialist, marca, modelo)
function withIdentificadores<T extends { specialist_id: string | null; marca: string; modelo: string }>(
  rows: T[],
): (T & { identificador: string })[] {
  const counters = new Map<string, number>();
  return rows.map((r) => {
    const base = `${slug(r.marca)}-${slug(r.modelo)}`;
    const key = `${r.specialist_id ?? 'none'}|${base}`;
    const n = (counters.get(key) ?? 0) + 1;
    counters.set(key, n);
    return { ...r, identificador: `${base}-${n}` };
  });
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(';')];
  for (const row of rows) lines.push(headers.map((h) => esc(row[h])).join(';'));
  return lines.join('\n');
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const carros = withIdentificadores(await prisma.car.findMany());
  writeFileSync(
    join(OUT, 'carros.csv'),
    toCsv(
      ['marca', 'modelo', 'identificador', 'valor', 'estado', 'ano', 'cor', 'km', 'cambio', 'combustivel', 'tipo_categoria', 'descricao'],
      carros,
    ),
  );

  const barcos = withIdentificadores(await prisma.boat.findMany());
  writeFileSync(
    join(OUT, 'barcos.csv'),
    toCsv(
      ['marca', 'modelo', 'identificador', 'valor', 'estado', 'ano', 'fabricante', 'tamanho', 'estilo', 'combustivel', 'motor', 'ano_motor', 'tipo_embarcacao', 'descricao_completa', 'acessorios'],
      barcos,
    ),
  );

  const aeronaves = withIdentificadores(await prisma.aircraft.findMany());
  writeFileSync(
    join(OUT, 'aeronaves.csv'),
    toCsv(
      ['marca', 'modelo', 'identificador', 'valor', 'estado', 'ano', 'categoria', 'assentos', 'tipo_aeronave', 'descricao'],
      aeronaves,
    ),
  );

  console.log(`Exportado: ${carros.length} carros, ${barcos.length} barcos, ${aeronaves.length} aeronaves em ${OUT}`);
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Rodar o export (base ANTIGA, antes do reset)**

Run: `cd backend && npx ts-node scripts/export-produtos-para-csv.ts`
Expected: imprime as contagens e cria `backend/scripts/out/*.csv`. Abrir um CSV e conferir que a coluna `identificador` está preenchida e única por especialista.

- [ ] **Step 3: Commit (só o script; NÃO versionar os CSVs de dados)**

```bash
echo "scripts/out/" >> backend/.gitignore
git add backend/scripts/export-produtos-para-csv.ts backend/.gitignore
git commit -m "chore(scripts): export de produtos para CSV com identificador gerado"
```

---

### Task C2: Verificação ponta a ponta

**Files:** nenhum (validação manual).

- [ ] **Step 1: Confirmar reset aplicado**

A base já foi resetada na Task B1 Step 4. Confirmar via `npx prisma studio` que `Car` está vazia e `id` é UUID.

- [ ] **Step 2: Re-importar pela plataforma**

Subir `backend` + `frontend` (o usuário roda; não iniciar `nest start --watch` em background nesta máquina). Logado como especialista, importar `carros.csv` / `barcos.csv` / `aeronaves.csv` pela tela de import.
Expected: import conclui; N produtos criados; nenhum erro de estrutura.

- [ ] **Step 3: Validar o critério das Ferraris**

Num CSV de teste com 2 linhas mesma marca/modelo e `identificador` diferente (`FERRARI-X-1`, `FERRARI-X-2`), importar.
Expected: 2 produtos ativos distintos. Re-importar o mesmo arquivo → 0 criados, 2 atualizados, 0 duplicados. Remover uma linha e re-importar → o ausente fica inativo.

- [ ] **Step 4: Validar catálogo com UUID**

Abrir a página de um produto no catálogo (`/catalog/...`) e o fluxo de criar processo para esse produto.
Expected: página carrega com id UUID na URL; processo criado sem erro de `product_id`.

---

## Self-Review (feito na redação)

- **Cobertura do spec:** Fase A (identificador + dedup + validação) → A1–A4. Fase B (UUID back+front) → B1–B3. Fase C (export+wipe+reimport) → C1–C2. Full-sync preservado (não é tocado). ✔
- **Placeholders:** sem TODO/TBD; todos os steps têm código ou comando concreto. Os pontos "corrigir o que o TS apontar" vêm acompanhados de `tsc --noEmit`/`npm run build` como verificação determinística. ✔
- **Consistência de tipos:** `identificador: string` (A1) usado igual em colunas (A2) e dedup (A3); `product_id: string`/`@IsUUID` (B2) casa com `getXById(id: string)` (B3). ✔
- **Ordem crítica:** export (C1) explicitamente antes do `db push --accept-data-loss` (B1 Step 4), com nota cruzada nos dois pontos. ✔
