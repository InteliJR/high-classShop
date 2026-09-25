# Comissão do Especialista no Convite e na Edição Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exigir e proteger a comissão no ingresso de especialistas, preservar a edição administrativa e sinalizar especialistas legados cuja comissão continua nula.

**Architecture:** O convite continuará stateless: a comissão será validada pelo backend, assinada no JWT e consumida no autocadastro sem confiar no corpo público. A conversão de cargo adotará o mesmo requisito, enquanto as telas administrativas preservarão `null` como estado não configurado e usarão `0` apenas como valor efetivo de cálculo.

**Tech Stack:** NestJS 11, Prisma 6, class-validator, Jest 30, React 19, TypeScript, Vitest 4 e Testing Library.

## Global Constraints

- `commission_rate` aceita valores entre `0` e `100`, inclusive, com no máximo duas casas decimais.
- `0` é um valor explicitamente configurado; validações não podem depender de truthiness.
- `null` permanece armazenado para especialistas legados e vale `0%` somente no cálculo.
- O especialista não envia nem sobrescreve comissão no endpoint público de cadastro.
- Convites antigos sem comissão continuam válidos durante sua expiração de sete dias e criam `commission_rate: null`.
- Alterações de comissão não recalculam snapshots de contratos existentes.
- Nenhuma migration ou backfill será criado.
- Comandos Jest devem usar `--runInBand` ou `--maxWorkers=2`.
- Comandos Vitest devem usar `--pool=forks --poolOptions.forks.maxForks=2`.

---

### Task 1: Assinar a comissão no convite do especialista

**Files:**
- Create: `backend/src/auth/types/specialist-invite-payload.ts`
- Create: `backend/src/features/specialists/dto/invite-specialist.dto.ts`
- Create: `backend/src/features/specialists/dto/invite-specialist.dto.spec.ts`
- Create: `backend/src/features/specialists/specialists.service.spec.ts`
- Modify: `backend/src/features/specialists/specialists.controller.ts`
- Modify: `backend/src/features/specialists/specialists.service.ts`

**Interfaces:**
- Consumes: `ProductType` do Prisma e o segredo `jwtConstants.referral` já usado no convite.
- Produces: `InviteSpecialistDto` e `SpecialistInvitePayload`, usados pelo endpoint de convite e pelo cadastro na Task 2.

- [ ] **Step 1: Escrever o teste de validação do DTO**

```ts
// backend/src/features/specialists/dto/invite-specialist.dto.spec.ts
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InviteSpecialistDto } from './invite-specialist.dto';

const base = {
  email: 'especialista@example.com',
  speciality: 'CAR',
};

async function errorsFor(commission_rate?: number) {
  return validate(
    plainToInstance(InviteSpecialistDto, { ...base, commission_rate }),
  );
}

describe('InviteSpecialistDto', () => {
  it.each([0, 12.34, 100])('aceita comissão %s', async (rate) => {
    await expect(errorsFor(rate)).resolves.toHaveLength(0);
  });

  it.each([undefined, -0.01, 100.01, 12.345])(
    'rejeita comissão %s',
    async (rate) => {
      expect(await errorsFor(rate)).not.toHaveLength(0);
    },
  );
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `cd backend && npm test -- --runInBand --runTestsByPath src/features/specialists/dto/invite-specialist.dto.spec.ts`

Expected: FAIL porque `InviteSpecialistDto` ainda não existe.

- [ ] **Step 3: Criar o DTO e o tipo do token**

```ts
// backend/src/features/specialists/dto/invite-specialist.dto.ts
import { Transform } from 'class-transformer';
import { ProductType } from '@prisma/client';
import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsNumber,
  Max,
  Min,
} from 'class-validator';

export class InviteSpecialistDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @IsEnum(ProductType, {
    message: 'Especialidade deve ser CAR, BOAT ou AIRCRAFT.',
  })
  speciality: ProductType;

  @IsDefined({ message: 'Informe a comissão do especialista.' })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'A comissão deve ser um número com no máximo duas casas decimais.' },
  )
  @Min(0, { message: 'A comissão deve estar entre 0% e 100%.' })
  @Max(100, { message: 'A comissão deve estar entre 0% e 100%.' })
  commission_rate: number;
}
```

```ts
// backend/src/auth/types/specialist-invite-payload.ts
import type { ProductType } from '@prisma/client';

export type SpecialistInvitePayload = {
  type: 'SPECIALIST_INVITE';
  email: string;
  speciality: ProductType;
  commission_rate?: number;
};
```

- [ ] **Step 4: Executar o teste do DTO e confirmar sucesso**

Run: `cd backend && npm test -- --runInBand --runTestsByPath src/features/specialists/dto/invite-specialist.dto.spec.ts`

Expected: PASS com 7 casos.

- [ ] **Step 5: Escrever o teste de assinatura do convite**

```ts
// backend/src/features/specialists/specialists.service.spec.ts
import { SpecialistsService } from './specialists.service';

describe('SpecialistsService.inviteSpecialist', () => {
  it('assina a comissão definida pelo administrador', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const jwt = { sign: jest.fn().mockReturnValue('signed-invite') } as any;
    const ses = {
      sendSpecialistInviteEmail: jest.fn().mockResolvedValue(undefined),
    } as any;
    const notifications = {} as any;
    const service = new SpecialistsService(prisma, jwt, ses, notifications);

    const result = await service.inviteSpecialist({
      email: 'especialista@example.com',
      speciality: 'CAR' as any,
      commission_rate: 25,
    });

    expect(jwt.sign).toHaveBeenCalledWith(
      {
        type: 'SPECIALIST_INVITE',
        email: 'especialista@example.com',
        speciality: 'CAR',
        commission_rate: 25,
      },
      expect.objectContaining({ expiresIn: '7d' }),
    );
    expect(result).toMatchObject({
      email: 'especialista@example.com',
      inviteLink: expect.stringContaining('signed-invite'),
    });
  });
});
```

- [ ] **Step 6: Executar o teste do serviço e confirmar a falha**

Run: `cd backend && npm test -- --runInBand --runTestsByPath src/features/specialists/specialists.service.spec.ts`

Expected: FAIL porque `inviteSpecialist` ainda recebe dois argumentos e não assina `commission_rate`.

- [ ] **Step 7: Tipar o controller e assinar o DTO completo**

```ts
// backend/src/features/specialists/specialists.controller.ts
import { InviteSpecialistDto } from './dto/invite-specialist.dto';

@Post('invite')
@Roles(UserRole.ADMIN)
@HttpCode(HttpStatus.OK)
async inviteSpecialist(@Body() body: InviteSpecialistDto) {
  const result = await this.specialistsService.inviteSpecialist(body);
  return {
    success: true,
    message: 'Convite enviado com sucesso',
    data: result,
  };
}
```

```ts
// backend/src/features/specialists/specialists.service.ts
import { InviteSpecialistDto } from './dto/invite-specialist.dto';
import { SpecialistInvitePayload } from '../../auth/types/specialist-invite-payload';

async inviteSpecialist(dto: InviteSpecialistDto) {
  const { email, speciality, commission_rate } = dto;
  const existingUser = await this.prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new BadRequestException('Já existe um usuário com este email');
  }

  const payload: SpecialistInvitePayload = {
    type: 'SPECIALIST_INVITE',
    email,
    speciality,
    commission_rate,
  };
  const token = this.jwtService.sign(payload, {
    expiresIn: '7d',
    secret: jwtConstants.referral,
  });

  const frontendUrl = (
    process.env.FRONTEND_URL || 'http://localhost:5173'
  ).replace(/\/$/, '');
  const inviteLink = `${frontendUrl}/register-specialist?invite=${token}`;

  setImmediate(() => {
    this.sesService
      .sendSpecialistInviteEmail(email, inviteLink, speciality)
      .catch(() => {});
  });

  return { inviteLink, email };
}
```

- [ ] **Step 8: Executar os testes focados**

Run: `cd backend && npm test -- --runInBand --runTestsByPath src/features/specialists/dto/invite-specialist.dto.spec.ts src/features/specialists/specialists.service.spec.ts`

Expected: PASS.

- [ ] **Step 9: Commitar a entrega**

```bash
git add backend/src/auth/types/specialist-invite-payload.ts backend/src/features/specialists
git commit -m "feat(specialists): include commission in invite token"
```

### Task 2: Persistir somente a comissão confiável do token

**Files:**
- Modify: `backend/src/auth/auth.service.ts`
- Modify: `backend/src/auth/auth.service.spec.ts`
- Modify: `backend/src/features/specialists/specialists.service.ts`
- Modify: `backend/src/features/specialists/specialists.service.spec.ts`

**Interfaces:**
- Consumes: `SpecialistInvitePayload` produzido na Task 1.
- Produces: `validateSpecialistInviteToken(): { email; speciality; commission_rate }` e respostas de especialista que preservam a diferença entre `null` e `0`.

- [ ] **Step 1: Adicionar testes de persistência, sobrescrita e token legado**

```ts
// adicionar em backend/src/auth/auth.service.spec.ts
it('persiste a comissão assinada e ignora tentativa de sobrescrita no corpo', async () => {
  const prisma = mkSpecialistPrisma();
  const jwt = mkJwt();
  jwt.verify.mockReturnValue({
    type: 'SPECIALIST_INVITE',
    email: 'bruno@example.com',
    speciality: 'CAR',
    commission_rate: 25,
  });
  const svc = new AuthService(prisma, jwt, {} as any, {} as any);
  (svc as any).queueWelcomeEmail = jest.fn();

  await svc.registerSpecialist({
    ...specialistDto,
    commission_rate: 99,
  } as any);

  expect(prisma.user.create.mock.calls[0][0].data.commission_rate).toBe(25);
});

it('mantém comissão nula para convite legado', async () => {
  const prisma = mkSpecialistPrisma();
  const jwt = mkJwt();
  const svc = new AuthService(prisma, jwt, {} as any, {} as any);
  (svc as any).queueWelcomeEmail = jest.fn();

  await svc.registerSpecialist(specialistDto);

  expect(prisma.user.create.mock.calls[0][0].data.commission_rate).toBeNull();
});
```

- [ ] **Step 2: Executar o spec de autenticação e confirmar a falha**

Run: `cd backend && npm test -- --runInBand --runTestsByPath src/auth/auth.service.spec.ts`

Expected: FAIL porque o cadastro ainda não obtém a comissão do token.

- [ ] **Step 3: Validar o payload e gravar a comissão depois de `...rest`**

```ts
// backend/src/auth/auth.service.ts
import { SpecialistInvitePayload } from './types/specialist-invite-payload';

async validateSpecialistInviteToken(token: string) {
  try {
    const payload = this.jwtService.verify<SpecialistInvitePayload>(token, {
      secret: this.getJwtSecret('JWT_SECRET_REFERRAL'),
    });
    if (payload.type !== 'SPECIALIST_INVITE') {
      throw new UnauthorizedException('Token inválido');
    }

    const existingUser = await this.prismaService.user.findUnique({
      where: { email: payload.email },
    });
    if (existingUser) {
      throw new BadRequestException(
        'Já existe uma conta cadastrada com este email. Faça login para acessar sua conta.',
      );
    }

    const rate = payload.commission_rate;
    if (
      rate !== undefined &&
      (!Number.isFinite(rate) || rate < 0 || rate > 100)
    ) {
      throw new UnauthorizedException('Token de convite inválido');
    }

    return {
      email: payload.email,
      speciality: payload.speciality,
      commission_rate: rate ?? null,
    };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new UnauthorizedException('Token de convite inválido ou expirado');
  }
}
```

Em `registerSpecialist`, substituir a desestruturação do retorno do token por:

```ts
const { email, speciality, commission_rate } =
  await this.validateSpecialistInviteToken(invite_token);
```

E adicionar `commission_rate` depois de `speciality` no objeto `data` passado a
`this.prismaService.user.create`. O campo confiável deve permanecer depois de
`...rest`, para sobrescrever qualquer propriedade extra que chegue a uma
chamada interna sem o `ValidationPipe`:

```ts
data: {
  ...rest,
  cpf: cnpj,
  email,
  password_hash: passwordHash,
  role: UserRole.SPECIALIST,
  speciality,
  commission_rate,
},
```

- [ ] **Step 4: Executar o spec de autenticação**

Run: `cd backend && npm test -- --runInBand --runTestsByPath src/auth/auth.service.spec.ts`

Expected: PASS, incluindo convite com `25%`, tentativa de `99%` no corpo e token legado nulo.

- [ ] **Step 5: Testar a serialização distinta de `null` e `0`**

```ts
// adicionar em backend/src/features/specialists/specialists.service.spec.ts
describe('SpecialistsService.findAll', () => {
  it('preserva null e zero como estados distintos', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'legacy', commission_rate: null },
          { id: 'zero', commission_rate: 0 },
        ]),
      },
    } as any;
    const service = new SpecialistsService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.findAll();

    expect(result.map((item) => item.commission_rate)).toEqual([null, 0]);
  });
});
```

- [ ] **Step 6: Implementar uma normalização explícita nas respostas**

```ts
// backend/src/features/specialists/specialists.service.ts
private toResponse<T extends { commission_rate: unknown }>(specialist: T) {
  return {
    ...specialist,
    commission_rate:
      specialist.commission_rate == null
        ? null
        : Number(specialist.commission_rate),
  };
}

// findAll
return specialists.map((specialist) => this.toResponse(specialist));

// findOne e update devem retornar this.toResponse(specialist)
```

- [ ] **Step 7: Executar os testes focados de backend**

Run: `cd backend && npm test -- --runInBand --runTestsByPath src/auth/auth.service.spec.ts src/features/specialists/specialists.service.spec.ts`

Expected: PASS.

- [ ] **Step 8: Commitar a entrega**

```bash
git add backend/src/auth backend/src/features/specialists
git commit -m "feat(auth): persist specialist commission from invite"
```

### Task 3: Exigir comissão na conversão de cargo para especialista

**Files:**
- Modify: `backend/src/features/admin-database/dto/change-role.dto.ts`
- Modify: `backend/src/features/admin-database/admin-user-management.types.ts`
- Modify: `backend/src/features/admin-database/admin-user-management.labels.ts`
- Modify: `backend/src/features/admin-database/admin-user-management.labels.spec.ts`
- Modify: `backend/src/features/admin-database/admin-user-management.service.ts`
- Modify: `backend/src/features/admin-database/admin-user-management.service.spec.ts`
- Modify: `backend/src/features/admin-database/admin-database.controller.spec.ts`

**Interfaces:**
- Consumes: enum `UserRole.SPECIALIST` e transação serializável já existentes.
- Produces: `ChangeRoleDto.commission_rate?: number` e bloqueio `COMMISSION_REQUIRED`, consumidos pelo frontend na Task 5.

- [ ] **Step 1: Escrever os testes de regra de negócio**

```ts
// adicionar em admin-user-management.service.spec.ts
it('exige comissão ao promover para Especialista', async () => {
  const { service } = makeService();

  await expect(
    service.validateRoleChange(customerId, {
      role: UserRole.SPECIALIST,
      speciality: ProductType.CAR,
    }),
  ).resolves.toMatchObject({
    allowed: false,
    blockers: expect.arrayContaining([{ code: 'COMMISSION_REQUIRED' }]),
  });
});

it.each([0, 18.5])('persiste comissão %s na promoção', async (rate) => {
  const { prisma, service } = makeService();

  await service.changeRole(customerId, {
    role: UserRole.SPECIALIST,
    speciality: ProductType.AIRCRAFT,
    commission_rate: rate,
  });

  expect(prisma.transactionUser.update).toHaveBeenCalledWith({
    where: { id: customerId },
    data: {
      role: UserRole.SPECIALIST,
      speciality: ProductType.AIRCRAFT,
      commission_rate: rate,
    },
  });
});
```

No caso existente `atualiza promoção válida na transação serializável`, incluir
`commission_rate: 18` tanto no DTO enviado quanto no objeto `data` esperado.
Fazer a mesma atualização em qualquer fixture do arquivo que represente uma
mudança válida para `UserRole.SPECIALIST`; casos que testam ausência de contexto
devem continuar omitindo o campo deliberadamente.

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `cd backend && npm test -- --runInBand --runTestsByPath src/features/admin-database/admin-user-management.service.spec.ts`

Expected: FAIL porque o DTO e o serviço ainda ignoram a comissão na mudança de cargo.

- [ ] **Step 3: Estender os DTOs de cargo com a mesma validação numérica**

```ts
// aplicar em ChangeRoleDto e OfficeManagerReplacementDto
@IsOptional()
@IsNumber(
  { maxDecimalPlaces: 2 },
  { message: 'A comissão deve ser um número com no máximo duas casas decimais.' },
)
@Min(0, { message: 'A comissão deve estar entre 0% e 100%.' })
@Max(100, { message: 'A comissão deve estar entre 0% e 100%.' })
commission_rate?: number;
```

Adicionar `IsNumber`, `Min` e `Max` aos imports de `change-role.dto.ts`.

- [ ] **Step 4: Adicionar bloqueio contextual e persistência atômica**

Em `admin-user-management.types.ts`, inserir `'COMMISSION_REQUIRED'` como novo
membro de `ChangeBlockerCode`, logo após `'SPECIALITY_REQUIRED'`.

```ts
// admin-user-management.labels.ts
COMMISSION_REQUIRED: () =>
  'Informe a comissão para o cargo de Especialista.',
```

```ts
// admin-user-management.service.ts, dentro de validateRoleContext
if (
  dto.role === UserRole.SPECIALIST &&
  dto.commission_rate == null
) {
  this.add(blockers, 'COMMISSION_REQUIRED');
}
```

```ts
// admin-user-management.service.ts, dentro de roleData
if (dto.role === UserRole.SPECIALIST) {
  return {
    role: dto.role,
    speciality: dto.speciality,
    commission_rate: dto.commission_rate,
  };
}
```

- [ ] **Step 5: Atualizar os testes de labels e validação do controller**

Adicionar ao spec de labels a expectativa:

```ts
expect(blockerMessage({ code: 'COMMISSION_REQUIRED' })).toBe(
  'Informe a comissão para o cargo de Especialista.',
);
```

Adicionar ao spec do controller casos de `ChangeRoleDto` que aceitam `0` e rejeitam `12.345`, usando o `ValidationPipe` já instanciado pelo arquivo.

- [ ] **Step 6: Executar todos os specs da gestão de usuários**

Run: `cd backend && npm test -- --runInBand --runTestsByPath src/features/admin-database/admin-user-management.service.spec.ts src/features/admin-database/admin-user-management.labels.spec.ts src/features/admin-database/admin-database.controller.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commitar a entrega**

```bash
git add backend/src/features/admin-database
git commit -m "feat(admin): require commission for specialist role"
```

### Task 4: Coletar a comissão no convite e exibi-la no autocadastro

**Files:**
- Create: `frontend/src/lib/commission-rate.ts`
- Create: `frontend/src/lib/commission-rate.test.ts`
- Create: `frontend/src/pages/admin/NewSpecialistForm.test.tsx`
- Create: `frontend/src/pages/auth/RegisterSpecialistPage.test.tsx`
- Modify: `frontend/src/services/specialists.service.ts`
- Modify: `frontend/src/pages/admin/NewSpecialistForm.tsx`
- Modify: `frontend/src/pages/auth/RegisterSpecialistPage.tsx`

**Interfaces:**
- Consumes: payload do convite e resposta de validação produzidos nas Tasks 1 e 2.
- Produces: `parseCommissionRateInput`, `effectiveCommissionRate` e `isCommissionConfigured`, reutilizados nas Tasks 5 e 6.

- [ ] **Step 1: Escrever os testes da regra de entrada compartilhada**

```ts
// frontend/src/lib/commission-rate.test.ts
import { describe, expect, it } from 'vitest';
import {
  effectiveCommissionRate,
  isCommissionConfigured,
  parseCommissionRateInput,
} from './commission-rate';

describe('commission-rate', () => {
  it.each([
    ['0', 0],
    ['12.34', 12.34],
    ['100', 100],
  ])('aceita %s', (raw, value) => {
    expect(parseCommissionRateInput(raw)).toEqual({ ok: true, value });
  });

  it.each(['', '-1', '100.01', '12.345', 'abc'])(
    'rejeita %s',
    (raw) => expect(parseCommissionRateInput(raw).ok).toBe(false),
  );

  expect(effectiveCommissionRate(null)).toBe(0);
  expect(isCommissionConfigured(null)).toBe(false);
  expect(isCommissionConfigured(0)).toBe(true);
});
```

- [ ] **Step 2: Implementar as funções puras**

```ts
// frontend/src/lib/commission-rate.ts
export type CommissionRateParseResult =
  | { ok: true; value: number }
  | { ok: false; message: string };

export function parseCommissionRateInput(
  raw: string,
): CommissionRateParseResult {
  const value = raw.trim();
  if (!value) {
    return { ok: false, message: 'Informe a comissão do especialista.' };
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { ok: false, message: 'A comissão deve ser um número.' };
  }
  if (parsed < 0 || parsed > 100) {
    return { ok: false, message: 'A comissão deve estar entre 0% e 100%.' };
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    return {
      ok: false,
      message: 'A comissão deve ter no máximo duas casas decimais.',
    };
  }
  return { ok: true, value: parsed };
}

export function effectiveCommissionRate(rate?: number | null): number {
  return rate ?? 0;
}

export function isCommissionConfigured(rate?: number | null): rate is number {
  return rate != null;
}
```

- [ ] **Step 3: Executar o teste puro**

Run: `cd frontend && npm test -- --pool=forks --poolOptions.forks.maxForks=2 src/lib/commission-rate.test.ts`

Expected: PASS.

- [ ] **Step 4: Escrever o teste do formulário de convite**

```tsx
// frontend/src/pages/admin/NewSpecialistForm.test.tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NewSpecialistForm from './NewSpecialistForm';
import { inviteSpecialist } from '../../services/specialists.service';

vi.mock('../../services/specialists.service', () => ({
  inviteSpecialist: vi.fn(),
}));

afterEach(cleanup);

describe('NewSpecialistForm', () => {
  it('exige comissão e envia zero como valor configurado', async () => {
    vi.mocked(inviteSpecialist).mockResolvedValue({
      inviteLink: 'https://example.test/invite',
      email: 'especialista@example.com',
    });
    render(<NewSpecialistForm onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('E-mail do especialista'), {
      target: { value: 'especialista@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar convite' }));
    expect(await screen.findByText('Informe a comissão do especialista.')).toBeTruthy();

    fireEvent.change(
      screen.getByLabelText('Comissão do especialista (% da comissão total)'),
      { target: { value: '0' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Gerar convite' }));

    await waitFor(() =>
      expect(inviteSpecialist).toHaveBeenCalledWith({
        email: 'especialista@example.com',
        speciality: 'CAR',
        commission_rate: 0,
      }),
    );
  });
});
```

- [ ] **Step 5: Atualizar o serviço e o formulário de convite**

```ts
// frontend/src/services/specialists.service.ts
export type InviteSpecialistData = {
  email: string;
  speciality: 'CAR' | 'BOAT' | 'AIRCRAFT';
  commission_rate: number;
};

export async function inviteSpecialist(
  payload: InviteSpecialistData,
): Promise<{ inviteLink: string; email: string }> {
  try {
    const response = await api.post('/specialists/invite', payload);
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export type ValidatedSpecialistInvite = {
  email: string;
  speciality: 'CAR' | 'BOAT' | 'AIRCRAFT';
  commission_rate: number | null;
};
```

Em `NewSpecialistForm.tsx`, adicionar estado inicialmente vazio, validar com `parseCommissionRateInput` e enviar o objeto:

```tsx
const [commissionRate, setCommissionRate] = useState('');

const parsedCommission = parseCommissionRateInput(commissionRate);
if (!parsedCommission.ok) {
  setError(parsedCommission.message);
  return;
}

const result = await inviteSpecialist({
  email: email.trim(),
  speciality,
  commission_rate: parsedCommission.value,
});
```

```tsx
<label htmlFor="commission-rate">
  Comissão do especialista (% da comissão total)
</label>
<input
  id="commission-rate"
  type="number"
  min="0"
  max="100"
  step="0.01"
  value={commissionRate}
  onChange={(event) => setCommissionRate(event.target.value)}
  required
/>
<p className="mt-1 text-xs text-muted">
  Percentual que o especialista recebe sobre a comissão total da venda.
</p>
```

- [ ] **Step 6: Exibir a comissão validada como somente leitura no cadastro**

Atualizar o retorno de `validateSpecialistInvite` para `Promise<ValidatedSpecialistInvite>`. Em `RegisterSpecialistPage.tsx`, armazenar `number | null`, preencher durante a validação e renderizar:

```tsx
const [commissionRate, setCommissionRate] = useState<number | null>(null);

// dentro do then da validação
setCommissionRate(data.commission_rate);

<div>
  <label className="block text-sm font-medium text-ink-soft">
    Comissão definida pelo administrador
  </label>
  <input
    readOnly
    value={`${effectiveCommissionRate(commissionRate)}%`}
    className="mt-1 block w-full rounded-md border border-border bg-border-soft px-3 py-2 text-muted"
  />
  {!isCommissionConfigured(commissionRate) ? (
    <p className="mt-1 text-xs text-amber-700">
      Comissão ainda não configurada; o valor efetivo atual é 0%.
    </p>
  ) : null}
</div>
```

- [ ] **Step 7: Adicionar teste da apresentação somente leitura**

```tsx
// frontend/src/pages/auth/RegisterSpecialistPage.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RegisterSpecialistPage from './RegisterSpecialistPage';
import { validateSpecialistInvite } from '../../services/specialists.service';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams('invite=signed-token')],
}));
vi.mock('../../store/authStateManager', () => ({
  useAuth: () => ({ setAccessToken: vi.fn(), setUser: vi.fn() }),
}));
vi.mock('../../services/specialists.service', () => ({
  validateSpecialistInvite: vi.fn(),
  registerSpecialist: vi.fn(),
}));
vi.mock('../../services/appointments.service', () => ({
  getCalendlyAuthorizeUrl: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => vi.mocked(validateSpecialistInvite).mockReset());

describe('RegisterSpecialistPage', () => {
  it('mostra a comissão assinada como somente leitura', async () => {
    vi.mocked(validateSpecialistInvite).mockResolvedValue({
      email: 'especialista@example.com',
      speciality: 'CAR',
      commission_rate: 25,
    });

    render(<RegisterSpecialistPage />);

    expect(await screen.findByDisplayValue('25%')).toHaveProperty(
      'readOnly',
      true,
    );
  });

  it('explica o zero efetivo de um convite legado', async () => {
    vi.mocked(validateSpecialistInvite).mockResolvedValue({
      email: 'legado@example.com',
      speciality: 'BOAT',
      commission_rate: null,
    });

    render(<RegisterSpecialistPage />);

    expect(
      await screen.findByText(
        'Comissão ainda não configurada; o valor efetivo atual é 0%.',
      ),
    ).toBeTruthy();
  });
});
```

- [ ] **Step 8: Executar os testes frontend da entrega**

Run: `cd frontend && npm test -- --pool=forks --poolOptions.forks.maxForks=2 src/lib/commission-rate.test.ts src/pages/admin/NewSpecialistForm.test.tsx src/pages/auth/RegisterSpecialistPage.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commitar a entrega**

```bash
git add frontend/src/lib/commission-rate.ts frontend/src/lib/commission-rate.test.ts frontend/src/services/specialists.service.ts frontend/src/pages/admin/NewSpecialistForm.tsx frontend/src/pages/admin/NewSpecialistForm.test.tsx frontend/src/pages/auth/RegisterSpecialistPage.tsx frontend/src/pages/auth/RegisterSpecialistPage.test.tsx
git commit -m "feat(frontend): collect specialist commission in invite"
```

### Task 5: Coletar comissão na mudança administrativa de cargo

**Files:**
- Modify: `frontend/src/lib/admin-user-management.ts`
- Modify: `frontend/src/lib/admin-user-management.test.ts`
- Modify: `frontend/src/components/admin/AdminUserManagementDialog.tsx`
- Create: `frontend/src/components/admin/AdminUserManagementDialog.test.tsx`

**Interfaces:**
- Consumes: `COMMISSION_REQUIRED` e `ChangeRoleDto.commission_rate` da Task 3 e `parseCommissionRateInput` da Task 4.
- Produces: `RoleContext.commission_rate?: number` para promoções comuns e substituições de gerente.

- [ ] **Step 1: Atualizar e testar os contratos puros do frontend**

Modificar os tipos:

```ts
export type RoleContext = {
  role: UserRoleCode;
  company_id?: string;
  speciality?: SpecialityCode;
  commission_rate?: number;
};

export type DialogRequirement =
  | 'company'
  | 'speciality'
  | 'commission'
  | 'replacement';
```

Inserir `'COMMISSION_REQUIRED'` em `ChangeBlockerCode`, logo após
`'SPECIALITY_REQUIRED'`.

Atualizar a regra e a mensagem:

```ts
COMMISSION_REQUIRED: () =>
  'Informe a comissão para o cargo de Especialista.',

if (role === 'SPECIALIST') return ['speciality', 'commission'];
```

Atualizar o teste existente para esperar:

```ts
expect(getDialogRequirements('SPECIALIST')).toEqual([
  'speciality',
  'commission',
]);
expect(blockerMessage({ code: 'COMMISSION_REQUIRED' })).toBe(
  'Informe a comissão para o cargo de Especialista.',
);
```

- [ ] **Step 2: Executar o teste puro e confirmar sucesso**

Run: `cd frontend && npm test -- --pool=forks --poolOptions.forks.maxForks=2 src/lib/admin-user-management.test.ts`

Expected: PASS depois da alteração dos contratos.

- [ ] **Step 3: Escrever o teste do diálogo de promoção**

```tsx
// frontend/src/components/admin/AdminUserManagementDialog.test.tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminUserManagementDialog from './AdminUserManagementDialog';
import * as management from '../../lib/admin-user-management';

vi.mock('../../services/companies.service', () => ({ getCompanies: vi.fn() }));
vi.spyOn(management, 'validateRoleChange').mockResolvedValue({
  allowed: true,
  summary: 'Alteração permitida.',
  blockers: [],
});

afterEach(cleanup);

describe('AdminUserManagementDialog', () => {
  it('envia especialidade e comissão zero ao promover para especialista', async () => {
    render(
      <AdminUserManagementDialog
        state={{ userId: 'user-1', mode: 'role' }}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Novo cargo'), {
      target: { value: 'SPECIALIST' },
    });
    fireEvent.change(screen.getByLabelText('Especialidade'), {
      target: { value: 'BOAT' },
    });
    fireEvent.change(screen.getByLabelText('Taxa de comissão (%)'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar alteração' }));

    await waitFor(() =>
      expect(management.validateRoleChange).toHaveBeenCalledWith('user-1', {
        role: 'SPECIALIST',
        speciality: 'BOAT',
        commission_rate: 0,
      }),
    );
  });
});
```

- [ ] **Step 4: Implementar os campos para destino e substituição especialista**

Em `AdminUserManagementDialog.tsx`:

```tsx
const [replacementCommissionRate, setReplacementCommissionRate] = useState('');
```

No `rolePayload`, depois de preencher especialidade:

```ts
if (requirements.includes('commission')) {
  const parsed = parseCommissionRateInput(commissionRate);
  if (!parsed.ok) {
    setError(parsed.message);
    return null;
  }
  payload.commission_rate = parsed.value;
}
```

Na montagem de `payload.replacement`:

```ts
if (replacementRequirements.includes('commission')) {
  const parsed = parseCommissionRateInput(replacementCommissionRate);
  if (!parsed.ok) {
    setError(parsed.message);
    return null;
  }
  payload.replacement.commission_rate = parsed.value;
}
```

Renderizar um input `Taxa de comissão (%)` quando `requirements` incluir `commission` e `Taxa de comissão do gerente atual (%)` quando `replacementRequirements` incluir `commission`. Ambos usam `min="0"`, `max="100"`, `step="0.01"` e o estado correspondente.

Limpar `replacementCommissionRate` em `reset`, `changeTargetRole` e ao mudar `replacementRole`, junto com os demais campos de substituição.

- [ ] **Step 5: Executar os testes do diálogo e da biblioteca**

Run: `cd frontend && npm test -- --pool=forks --poolOptions.forks.maxForks=2 src/lib/admin-user-management.test.ts src/components/admin/AdminUserManagementDialog.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commitar a entrega**

```bash
git add frontend/src/lib/admin-user-management.ts frontend/src/lib/admin-user-management.test.ts frontend/src/components/admin/AdminUserManagementDialog.tsx frontend/src/components/admin/AdminUserManagementDialog.test.tsx
git commit -m "feat(admin): collect commission on specialist promotion"
```

### Task 6: Sinalizar comissão legada não configurada e permitir salvar zero

**Files:**
- Create: `frontend/src/components/commission/CommissionConfigurationBadge.tsx`
- Create: `frontend/src/components/commission/CommissionConfigurationBadge.test.tsx`
- Create: `frontend/src/pages/admin/CommissionsPage.test.tsx`
- Modify: `frontend/src/pages/admin/SpecialistsPage.tsx`
- Modify: `frontend/src/pages/admin/CommissionsPage.tsx`
- Modify: `frontend/src/pages/admin/DatabasePage.tsx`
- Modify: `backend/src/features/specialists/dto/update-specialist.dto.ts`
- Create: `backend/src/features/specialists/dto/update-specialist.dto.spec.ts`
- Modify: `backend/src/features/admin-database/dto/change-specialist-details.dto.ts`
- Modify: `backend/src/features/admin-database/admin-database.controller.spec.ts`

**Interfaces:**
- Consumes: `effectiveCommissionRate` e `isCommissionConfigured` da Task 4.
- Produces: flag visual compartilhada e edição que converte `null` em zero explícito.

- [ ] **Step 1: Criar o teste e o componente da flag**

```tsx
// CommissionConfigurationBadge.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import CommissionConfigurationBadge from './CommissionConfigurationBadge';

afterEach(cleanup);

describe('CommissionConfigurationBadge', () => {
  it('sinaliza null e não sinaliza zero explícito', () => {
    const { rerender } = render(<CommissionConfigurationBadge rate={null} />);
    expect(screen.getByText('Comissão não configurada')).toBeTruthy();

    rerender(<CommissionConfigurationBadge rate={0} />);
    expect(screen.queryByText('Comissão não configurada')).toBeNull();
  });
});
```

```tsx
// CommissionConfigurationBadge.tsx
import { isCommissionConfigured } from '../../lib/commission-rate';

export default function CommissionConfigurationBadge({
  rate,
}: {
  rate?: number | null;
}) {
  if (isCommissionConfigured(rate)) return null;
  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      Comissão não configurada
    </span>
  );
}
```

- [ ] **Step 2: Exibir a comissão na gestão de especialistas**

Em `SpecialistsPage.tsx`, adicionar o cabeçalho `Comissão`, atualizar `TableBody columns` de `5` para `6` e inserir:

```tsx
<TableCell>
  <div className="flex flex-col items-start gap-1">
    <span>{effectiveCommissionRate(specialist.commission_rate)}%</span>
    <CommissionConfigurationBadge rate={specialist.commission_rate} />
  </div>
</TableCell>
```

Em `DatabasePage.tsx`, quando `active === 'users'`, a coluna atual for
`Taxa de comissão`, `rowMeta[i].role === 'SPECIALIST'` e
`rowMeta[i].commission_rate == null`, renderizar o texto efetivo `0%` junto de
`<CommissionConfigurationBadge rate={null} />` no lugar do travessão genérico.

- [ ] **Step 3: Escrever o teste que salva zero em registro nulo**

```tsx
// frontend/src/pages/admin/CommissionsPage.test.tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CommissionsPage from './CommissionsPage';
import { getSpecialists, updateSpecialist } from '../../services/specialists.service';

vi.mock('../../services/companies.service', () => ({
  getCompanies: vi.fn().mockResolvedValue([]),
  updateCompany: vi.fn(),
}));
vi.mock('../../services/specialists.service', () => ({
  getSpecialists: vi.fn(),
  updateSpecialist: vi.fn(),
}));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSearchParams: () => [new URLSearchParams()],
}));

afterEach(cleanup);

describe('CommissionsPage', () => {
  it('permite salvar zero e remove a flag de comissão nula', async () => {
    const legacy = {
      id: 'specialist-1',
      name: 'Ana',
      surname: 'Silva',
      email: 'ana@example.com',
      cpf: '',
      rg: '',
      password_hash: '',
      speciality: 'CAR' as const,
      commission_rate: null,
    };
    vi.mocked(getSpecialists).mockResolvedValue([legacy]);
    vi.mocked(updateSpecialist).mockResolvedValue({
      ...legacy,
      commission_rate: 0,
    });

    render(<CommissionsPage />);
    expect(await screen.findByText('Comissão não configurada')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(updateSpecialist).toHaveBeenCalledWith('specialist-1', {
        commission_rate: 0,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText('Comissão não configurada')).toBeNull(),
    );
  });
});
```

- [ ] **Step 4: Diferenciar valor efetivo de estado configurado na linha**

Alterar `RateRow` para receber `configured`:

```tsx
function RateRow({
  label,
  initialRate,
  configured = true,
  onSave,
}: {
  label: string;
  initialRate: number;
  configured?: boolean;
  onSave: (rate: number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(initialRate));
  const dirty = !configured || value !== String(initialRate);
}
```

No bloco de label existente, inserir imediatamente depois de
`<span>{label}</span>`:

```tsx
<CommissionConfigurationBadge rate={configured ? initialRate : null} />
```

Na lista de especialistas:

```tsx
<RateRow
  key={specialist.id}
  label={`${specialist.name} ${specialist.surname}`}
  initialRate={effectiveCommissionRate(specialist.commission_rate)}
  configured={isCommissionConfigured(specialist.commission_rate)}
  onSave={(rate) => saveSpecialistRate(specialist.id, rate)}
/>
```

Usar `parseCommissionRateInput(value)` dentro de `handleSave`, em vez de `parseFloat`, para aplicar precisão e mensagens consistentes.

- [ ] **Step 5: Aplicar duas casas decimais nos DTOs de edição**

Nos decoradores `@IsNumber` de `UpdateSpecialistDto.commission_rate` e
`ChangeSpecialistDetailsDto.commission_rate`, usar `{ maxDecimalPlaces: 2 }`.
Estender `admin-database.controller.spec.ts` para confirmar que `0` é aceito e
`12.345` é rejeitado pelo `ValidationPipe`.

Criar o teste direto do DTO usado pela página de comissões:

```ts
// backend/src/features/specialists/dto/update-specialist.dto.spec.ts
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateSpecialistDto } from './update-specialist.dto';

describe('UpdateSpecialistDto', () => {
  it.each([0, 12.34, 100])('aceita comissão %s', async (commission_rate) => {
    await expect(
      validate(plainToInstance(UpdateSpecialistDto, { commission_rate })),
    ).resolves.toHaveLength(0);
  });

  it.each([-0.01, 12.345, 100.01])(
    'rejeita comissão %s',
    async (commission_rate) => {
      expect(
        await validate(
          plainToInstance(UpdateSpecialistDto, { commission_rate }),
        ),
      ).not.toHaveLength(0);
    },
  );
});
```

- [ ] **Step 6: Executar testes focados de frontend e backend**

Run: `cd frontend && npm test -- --pool=forks --poolOptions.forks.maxForks=2 src/components/commission/CommissionConfigurationBadge.test.tsx src/pages/admin/CommissionsPage.test.tsx src/lib/commission-rate.test.ts`

Expected: PASS.

Run: `cd backend && npm test -- --runInBand --runTestsByPath src/features/admin-database/admin-database.controller.spec.ts src/features/specialists/dto/update-specialist.dto.spec.ts src/features/specialists/specialists.service.spec.ts`

Expected: PASS.

- [ ] **Step 7: Executar builds sequencialmente**

Run: `cd backend && npm run build`

Expected: exit code `0`.

Run: `cd frontend && npm run build`

Expected: exit code `0`.

- [ ] **Step 8: Executar a verificação integrada manual**

1. Convidar um especialista com `25%`, abrir o link e confirmar que o cadastro mostra `25%` somente leitura.
2. Concluir o cadastro e verificar na gestão que a conta mostra `25%` sem flag.
3. Convidar outro especialista com `0%` e confirmar que ele aparece sem flag.
4. Abrir um especialista legado com `commission_rate = null` e confirmar `0%` mais `Comissão não configurada`.
5. Na página de comissões, salvar o zero sem alterar o input e confirmar que a flag desaparece.
6. Promover um usuário existente para especialista com comissão `0%` e confirmar que papel, especialidade e comissão são gravados juntos.
7. Alterar uma comissão positiva e confirmar que um contrato já criado mantém o snapshot anterior.

- [ ] **Step 9: Commitar a entrega final**

```bash
git add backend/src/features/specialists/dto/update-specialist.dto.ts backend/src/features/specialists/dto/update-specialist.dto.spec.ts backend/src/features/admin-database/dto/change-specialist-details.dto.ts backend/src/features/admin-database/admin-database.controller.spec.ts frontend/src/components/commission frontend/src/pages/admin/SpecialistsPage.tsx frontend/src/pages/admin/CommissionsPage.tsx frontend/src/pages/admin/CommissionsPage.test.tsx frontend/src/pages/admin/DatabasePage.tsx
git commit -m "feat(commissions): flag unconfigured specialist rates"
```

## Verificação final da branch

- [ ] Executar `git diff --check origin/develop...HEAD` e esperar nenhuma saída.
- [ ] Executar os testes backend tocados com `--runInBand`.
- [ ] Executar os testes frontend tocados com no máximo dois forks.
- [ ] Executar primeiro o build backend e depois o build frontend; não rodá-los em paralelo.
- [ ] Confirmar que não existe migration nova em `backend/prisma/migrations`.
- [ ] Confirmar que `RegisterSpecialistDto` não ganhou `commission_rate`.
- [ ] Confirmar que nenhuma resposta converte `commission_rate: null` em zero antes do frontend.
