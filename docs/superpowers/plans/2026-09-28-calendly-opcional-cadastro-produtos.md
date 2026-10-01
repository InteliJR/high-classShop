# Calendly Optional Product Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir cadastro manual e importação CSV de produtos por especialistas sem exigir conexão com o Calendly.

**Architecture:** Remover dos controllers de carros, embarcações e aeronaves a consulta de Calendly, preservando as validações de papel e especialidade. Depois que todos os consumidores forem removidos, excluir o helper de autorização de Calendly e seus testes isolados.

**Tech Stack:** NestJS 11, TypeScript 5.7, Jest 30, Prisma 6.

## Global Constraints

- Calendly permanece opcional e limitado aos fluxos de agendamento.
- Cadastro manual e importação CSV devem funcionar sem conexão ativa para carros, embarcações e aeronaves.
- Permissões de papel e especialidade não mudam.
- Validações de arquivo e dados do produto não mudam.
- Não alterar OAuth, perfil ou agendamentos do Calendly.
- Executar Jest com no máximo dois workers.

---

### Task 1: Liberar cadastro e importação de carros

**Files:**
- Modify: `backend/src/features/cars/cars.controller.spec.ts`
- Modify: `backend/src/features/cars/cars.controller.ts`

**Interfaces:**
- Consumes: `assertSpecialistCanCreate(productType, user)` e `ProductImportJobsService.createJobFromCsv(buffer, user, ProductType.CAR)`.
- Produces: `CarsController` com construtor `(carsService, productImportJobsService)` e sem acesso ao Prisma no cadastro/importação.

- [ ] **Step 1: Substituir os testes do gate por testes do comportamento opcional**

```ts
import { ProductType } from '@prisma/client';
import { CarsController } from './cars.controller';

function mkController() {
  const carsService = {
    create: jest.fn().mockResolvedValue({ id: 'car-1' }),
  } as any;
  const productImportJobsService = {
    createJobFromCsv: jest.fn().mockResolvedValue({ id: 'job-1' }),
  } as any;
  const controller = new (CarsController as any)(
    carsService,
    productImportJobsService,
  ) as CarsController;
  return { controller, carsService, productImportJobsService };
}

const specialist = {
  id: 'spec-1',
  role: 'SPECIALIST',
  speciality: 'CAR',
} as any;

describe('CarsController — Calendly opcional', () => {
  it('permite criação manual sem consultar Calendly', async () => {
    const { controller, carsService } = mkController();
    const dto = {} as any;

    await expect(controller.create(dto, specialist)).resolves.toEqual({
      id: 'car-1',
    });
    expect(dto.specialist_id).toBe(specialist.id);
    expect(carsService.create).toHaveBeenCalledWith(dto);
  });

  it('permite importação CSV sem consultar Calendly', async () => {
    const { controller, productImportJobsService } = mkController();
    const file = {
      buffer: Buffer.from('marca,modelo'),
      mimetype: 'text/csv',
      originalname: 'carros.csv',
    } as Express.Multer.File;

    await expect(controller.importCsv(file, specialist)).resolves.toEqual({
      id: 'job-1',
    });
    expect(productImportJobsService.createJobFromCsv).toHaveBeenCalledWith(
      file.buffer,
      specialist,
      ProductType.CAR,
    );
  });
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha pelo acesso ao Prisma ausente**

Run: `cd backend && npm test -- --runTestsByPath src/features/cars/cars.controller.spec.ts --runInBand`

Expected: FAIL porque `create` e `importCsv` ainda chamam `assertSpecialistHasCalendly` com `this.prisma` indefinido.

- [ ] **Step 3: Remover o gate e a dependência de Prisma do controller de carros**

Remover `assertSpecialistHasCalendly` do import, remover `PrismaService`, remover o terceiro parâmetro do construtor e apagar as duas chamadas:

```ts
export class CarsController {
  constructor(
    private readonly carsService: CarsService,
    private readonly productImportJobsService: ProductImportJobsService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  create(
    @Body() createCarDto: CreateCarDto,
    @CurrentUser() user: UserEntity,
  ) {
    assertSpecialistCanCreate('CAR', user);
    createCarDto.specialist_id = user.id;
    return this.carsService.create(createCarDto);
  }
}
```

Em `importCsv`, preservar `assertSpecialistCanCreate('CAR', user)` e iniciar imediatamente a validação de `file`.

- [ ] **Step 4: Executar o teste e confirmar sucesso**

Run: `cd backend && npm test -- --runTestsByPath src/features/cars/cars.controller.spec.ts --runInBand`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commitar a mudança de carros**

```bash
git add backend/src/features/cars/cars.controller.ts backend/src/features/cars/cars.controller.spec.ts
git commit -m "fix(cars): allow product creation without Calendly"
```

### Task 2: Liberar cadastro e importação de embarcações

**Files:**
- Modify: `backend/src/features/boats/boats.controller.spec.ts`
- Modify: `backend/src/features/boats/boats.controller.ts`

**Interfaces:**
- Consumes: `assertSpecialistCanCreate(productType, user)` e `ProductImportJobsService.createJobFromCsv(buffer, user, ProductType.BOAT)`.
- Produces: `BoatsController` com construtor `(boatsService, productImportJobsService)` e sem acesso ao Prisma no cadastro/importação.

- [ ] **Step 1: Escrever testes que permitem as duas formas de cadastro sem Calendly**

```ts
import { ProductType } from '@prisma/client';
import { BoatsController } from './boats.controller';

function mkController() {
  const boatsService = {
    create: jest.fn().mockResolvedValue({ id: 'boat-1' }),
  } as any;
  const productImportJobsService = {
    createJobFromCsv: jest.fn().mockResolvedValue({ id: 'job-1' }),
  } as any;
  const controller = new (BoatsController as any)(
    boatsService,
    productImportJobsService,
  ) as BoatsController;
  return { controller, boatsService, productImportJobsService };
}

const specialist = {
  id: 'spec-1',
  role: 'SPECIALIST',
  speciality: 'BOAT',
} as any;

describe('BoatsController — Calendly opcional', () => {
  it('permite criação manual sem consultar Calendly', async () => {
    const { controller, boatsService } = mkController();
    const dto = {} as any;

    await expect(controller.create(dto, specialist)).resolves.toEqual({
      id: 'boat-1',
    });
    expect(dto.specialist_id).toBe(specialist.id);
    expect(boatsService.create).toHaveBeenCalledWith(dto);
  });

  it('permite importação CSV sem consultar Calendly', async () => {
    const { controller, productImportJobsService } = mkController();
    const file = {
      buffer: Buffer.from('marca,modelo'),
      mimetype: 'text/csv',
      originalname: 'embarcacoes.csv',
    } as Express.Multer.File;

    await expect(controller.importCsv(file, specialist)).resolves.toEqual({
      id: 'job-1',
    });
    expect(productImportJobsService.createJobFromCsv).toHaveBeenCalledWith(
      file.buffer,
      specialist,
      ProductType.BOAT,
    );
  });
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha pelo gate atual**

Run: `cd backend && npm test -- --runTestsByPath src/features/boats/boats.controller.spec.ts --runInBand`

Expected: FAIL porque os endpoints ainda consultam o Calendly.

- [ ] **Step 3: Remover `assertSpecialistHasCalendly`, `PrismaService`, o parâmetro de construtor e as duas chamadas no controller de embarcações**

O construtor resultante deve ser:

```ts
constructor(
  private readonly boatsService: BoatsService,
  private readonly productImportJobsService: ProductImportJobsService,
) {}
```

O método `create` deixa de ser `async`, preserva `assertSpecialistCanCreate('BOAT', user)`, atribui `specialist_id` e retorna `boatsService.create`. `importCsv` preserva a autorização e todas as validações de arquivo existentes.

- [ ] **Step 4: Executar o teste e confirmar sucesso**

Run: `cd backend && npm test -- --runTestsByPath src/features/boats/boats.controller.spec.ts --runInBand`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commitar a mudança de embarcações**

```bash
git add backend/src/features/boats/boats.controller.ts backend/src/features/boats/boats.controller.spec.ts
git commit -m "fix(boats): allow product creation without Calendly"
```

### Task 3: Liberar cadastro e importação de aeronaves

**Files:**
- Modify: `backend/src/features/aircrafts/aircrafts.controller.spec.ts`
- Modify: `backend/src/features/aircrafts/aircrafts.controller.ts`

**Interfaces:**
- Consumes: `assertSpecialistCanCreate(productType, user)` e `ProductImportJobsService.createJobFromCsv(buffer, user, ProductType.AIRCRAFT)`.
- Produces: `AircraftsController` com construtor `(aircraftsService, productImportJobsService)` e sem acesso ao Prisma no cadastro/importação.

- [ ] **Step 1: Escrever testes que permitem as duas formas de cadastro sem Calendly**

```ts
import { ProductType } from '@prisma/client';
import { AircraftsController } from './aircrafts.controller';

function mkController() {
  const aircraftsService = {
    create: jest.fn().mockResolvedValue({ id: 'aircraft-1' }),
  } as any;
  const productImportJobsService = {
    createJobFromCsv: jest.fn().mockResolvedValue({ id: 'job-1' }),
  } as any;
  const controller = new (AircraftsController as any)(
    aircraftsService,
    productImportJobsService,
  ) as AircraftsController;
  return { controller, aircraftsService, productImportJobsService };
}

const specialist = {
  id: 'spec-1',
  role: 'SPECIALIST',
  speciality: 'AIRCRAFT',
} as any;

describe('AircraftsController — Calendly opcional', () => {
  it('permite criação manual sem consultar Calendly', async () => {
    const { controller, aircraftsService } = mkController();
    const dto = {} as any;

    await expect(controller.create(dto, specialist)).resolves.toEqual({
      id: 'aircraft-1',
    });
    expect(dto.specialist_id).toBe(specialist.id);
    expect(aircraftsService.create).toHaveBeenCalledWith(dto);
  });

  it('permite importação CSV sem consultar Calendly', async () => {
    const { controller, productImportJobsService } = mkController();
    const file = {
      buffer: Buffer.from('marca,modelo'),
      mimetype: 'text/csv',
      originalname: 'aeronaves.csv',
    } as Express.Multer.File;

    await expect(controller.importCsv(file, specialist)).resolves.toEqual({
      id: 'job-1',
    });
    expect(productImportJobsService.createJobFromCsv).toHaveBeenCalledWith(
      file.buffer,
      specialist,
      ProductType.AIRCRAFT,
    );
  });
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha pelo gate atual**

Run: `cd backend && npm test -- --runTestsByPath src/features/aircrafts/aircrafts.controller.spec.ts --runInBand`

Expected: FAIL porque os endpoints ainda consultam o Calendly.

- [ ] **Step 3: Remover `assertSpecialistHasCalendly`, `PrismaService`, o parâmetro de construtor e as duas chamadas no controller de aeronaves**

O construtor resultante deve ser:

```ts
constructor(
  private readonly aircraftsService: AircraftsService,
  private readonly productImportJobsService: ProductImportJobsService,
) {}
```

O método `create` deixa de ser `async`, preserva `assertSpecialistCanCreate('AIRCRAFT', user)`, atribui `specialist_id` e retorna `aircraftsService.create`. `importCsv` preserva a autorização e todas as validações de arquivo existentes.

- [ ] **Step 4: Executar o teste e confirmar sucesso**

Run: `cd backend && npm test -- --runTestsByPath src/features/aircrafts/aircrafts.controller.spec.ts --runInBand`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commitar a mudança de aeronaves**

```bash
git add backend/src/features/aircrafts/aircrafts.controller.ts backend/src/features/aircrafts/aircrafts.controller.spec.ts
git commit -m "fix(aircrafts): allow product creation without Calendly"
```

### Task 4: Remover o helper obsoleto e verificar a correção integrada

**Files:**
- Modify: `backend/src/shared/helpers/specialist-auth.helper.ts`
- Delete: `backend/src/shared/helpers/specialist-auth.helper.spec.ts`

**Interfaces:**
- Consumes: controllers sem referências a `assertSpecialistHasCalendly`.
- Produces: helper de autorização restrito a papel, especialidade e propriedade do produto.

- [ ] **Step 1: Confirmar que o helper de Calendly não tem consumidores**

Run: `rg -n "assertSpecialistHasCalendly" backend/src --glob '!shared/helpers/specialist-auth.helper.ts' --glob '!shared/helpers/specialist-auth.helper.spec.ts'`

Expected: nenhuma ocorrência.

- [ ] **Step 2: Remover a implementação e seu teste isolado**

Em `specialist-auth.helper.ts`, remover:

```ts
import { PrismaService } from 'src/prisma/prisma.service';
```

Também remover o bloco final completo:

```ts
/**
 * Valida se o especialista tem o Calendly conectado antes de anunciar um produto.
 * - ADMIN ignora a checagem.
 *
 * @throws ForbiddenException se o SPECIALIST não tiver uma conexão ativa
 */
export async function assertSpecialistHasCalendly(
  user: UserEntity,
  prisma: PrismaService,
): Promise<void> {
  if (user.role !== UserRole.SPECIALIST) {
    return;
  }

  const connection = await prisma.calendlyConnection.findUnique({
    where: { user_id: user.id },
    select: { is_active: true },
  });

  if (!connection?.is_active) {
    throw new ForbiddenException(
      'Conecte seu Calendly antes de anunciar produtos. Acesse seu perfil para conectar.',
    );
  }
}
```

Excluir `backend/src/shared/helpers/specialist-auth.helper.spec.ts`, pois sua única responsabilidade era validar a regra removida.

- [ ] **Step 3: Executar as suítes focadas dos três controllers**

Run: `cd backend && npm test -- --runTestsByPath src/features/cars/cars.controller.spec.ts src/features/boats/boats.controller.spec.ts src/features/aircrafts/aircrafts.controller.spec.ts --maxWorkers=2`

Expected: PASS, 3 suites e 6 tests.

- [ ] **Step 4: Confirmar ausência do gate e compilar o backend**

Run: `rg -n "assertSpecialistHasCalendly|Conecte seu Calendly antes de anunciar" backend/src`

Expected: nenhuma ocorrência.

Run: `cd backend && npm run build`

Expected: exit code 0.

- [ ] **Step 5: Verificar o diff e commit final**

Run: `git diff --check`

Expected: exit code 0 e nenhuma saída.

```bash
git add backend/src/shared/helpers/specialist-auth.helper.ts backend/src/shared/helpers/specialist-auth.helper.spec.ts
git commit -m "refactor(auth): remove obsolete product Calendly gate"
```
