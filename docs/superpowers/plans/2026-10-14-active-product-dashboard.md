# Active Product Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar produtos ativos em destaque e o total de produtos como informação auxiliar em todos os dashboards que exibem esse indicador.

**Architecture:** O serviço de dashboard continuará retornando as contagens totais existentes e acrescentará `activeProducts`, calculado no banco com `is_active: true`. Os dois dashboards consumirão o novo campo sem alterar os demais contratos; testes de serviço e de componente protegerão a regra e a apresentação.

**Tech Stack:** NestJS, Prisma, Jest, React, TypeScript, Vitest, Testing Library, Vite.

## Global Constraints

- `totalProducts`, `productsListed` e `productsByType` mantêm a semântica atual para compatibilidade.
- `activeProducts` considera somente registros com `is_active: true`.
- O título visível é `Produtos ativos` e o auxiliar é `<total> produtos no total`.
- Testes JavaScript e TypeScript devem usar no máximo dois workers; testes focados são preferidos.

---

### Task 1: Contagens distintas no backend

**Files:**
- Modify: `backend/src/features/dashboard/dashboard.service.spec.ts`
- Modify: `backend/src/features/dashboard/dashboard.service.ts`

**Interfaces:**
- Consumes: modelos Prisma `car`, `boat` e `aircraft`, todos com `is_active: boolean`.
- Produces: `getAdminStats(): Promise<{ totalProducts: number; activeProducts: number; ... }>` e `getSpecialistStats(specialistId): Promise<{ productsListed: number; activeProducts: number; ... }>`.

- [ ] **Step 1: Escrever testes que diferenciem ativos e total**

Adicionar casos que configurem contagens diferentes para chamadas sem filtro e chamadas com `where.is_active: true`. Para especialista, verificar também `specialist_id`:

```ts
it('retorna ativos separados do total no dashboard administrativo', async () => {
  const prisma = mkPrisma();
  prisma.car.count.mockImplementation(({ where }: any = {}) =>
    Promise.resolve(where?.is_active ? 2 : 3),
  );
  prisma.boat.count.mockImplementation(({ where }: any = {}) =>
    Promise.resolve(where?.is_active ? 1 : 4),
  );
  prisma.aircraft.count.mockImplementation(({ where }: any = {}) =>
    Promise.resolve(where?.is_active ? 5 : 6),
  );

  const result = await mkSvcWithPrisma(prisma).getAdminStats();

  expect(result.totalProducts).toBe(13);
  expect(result.activeProducts).toBe(8);
});

it('retorna ativos separados do total para o especialista', async () => {
  const prisma = mkPrisma();
  prisma.user.findUnique.mockResolvedValue({ speciality: 'CAR' });
  prisma.car.count.mockImplementation(({ where }: any) =>
    Promise.resolve(where.is_active ? 2 : 5),
  );

  const result = await mkSvcWithPrisma(prisma).getSpecialistStats('specialist-1');

  expect(result.productsListed).toBe(5);
  expect(result.activeProducts).toBe(2);
  expect(prisma.car.count).toHaveBeenCalledWith({
    where: { specialist_id: 'specialist-1', is_active: true },
  });
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha esperada**

Run: `cd backend && npm test -- dashboard.service.spec.ts --runInBand`

Expected: FAIL porque `activeProducts` ainda não existe e a consulta filtrada ainda não é feita.

- [ ] **Step 3: Implementar as contagens ativas**

No dashboard administrativo, executar em paralelo três novas contagens:

```ts
this.prisma.car.count({ where: { is_active: true } });
this.prisma.boat.count({ where: { is_active: true } });
this.prisma.aircraft.count({ where: { is_active: true } });
```

Somar os resultados em `activeProducts`. Para o especialista, criar uma segunda contagem da mesma especialidade, com:

```ts
where: { specialist_id: specialistId, is_active: true }
```

Retornar `activeProducts` sem mudar o significado de `totalProducts` ou `productsListed`.

- [ ] **Step 4: Executar o teste focado e confirmar sucesso**

Run: `cd backend && npm test -- dashboard.service.spec.ts --runInBand`

Expected: PASS, sem falhas.

- [ ] **Step 5: Commitar a camada de dados**

```bash
git add backend/src/features/dashboard/dashboard.service.ts backend/src/features/dashboard/dashboard.service.spec.ts
git commit -m "fix(dashboard): separate active and total products"
```

### Task 2: Apresentação no frontend

**Files:**
- Modify: `frontend/src/services/dashboard.service.ts`
- Modify: `frontend/src/pages/admin/DashboardPage.tsx`
- Modify: `frontend/src/pages/specialist/SpecialistDashboard.tsx`
- Create: `frontend/src/pages/dashboard-product-counts.test.tsx`

**Interfaces:**
- Consumes: `DashboardStats.activeProducts: number`, `DashboardStats.totalProducts: number`, `SpecialistDashboardStats.activeProducts: number` e `SpecialistDashboardStats.productsListed: number`.
- Produces: cards com título `Produtos ativos`, valor ativo em destaque e texto `<total> produtos no total`.

- [ ] **Step 1: Escrever testes de componente para os dois dashboards**

Mockar os serviços de dashboard, gráficos e animações. Renderizar o admin com `activeProducts: 8`, `totalProducts: 13`; renderizar o especialista com `activeProducts: 2`, `productsListed: 5`. Verificar:

```ts
expect(await screen.findByText('Produtos ativos')).toBeTruthy();
expect(screen.getByText('8')).toBeTruthy();
expect(screen.getByText('13 produtos no total')).toBeTruthy();
```

e, no segundo caso:

```ts
expect(await screen.findByText('Produtos ativos')).toBeTruthy();
expect(screen.getByText('2')).toBeTruthy();
expect(screen.getByText('5 produtos no total')).toBeTruthy();
```

- [ ] **Step 2: Executar o teste e confirmar a falha esperada**

Run: `cd frontend && npm test -- src/pages/dashboard-product-counts.test.tsx --pool=forks --poolOptions.forks.maxForks=2`

Expected: FAIL porque os tipos e os cards ainda não usam `activeProducts`.

- [ ] **Step 3: Atualizar tipos e cards**

Adicionar `activeProducts: number` às duas interfaces. No admin, alterar o KPI de produtos para:

```ts
{
  icon: Package,
  label: 'Produtos ativos',
  value: stats?.activeProducts ?? 0,
  sub: `${stats?.totalProducts ?? 0} produtos no total`,
}
```

No especialista, usar `stats?.activeProducts ?? 0` no destaque e `${stats?.productsListed ?? 0} produtos no total` no auxiliar.

- [ ] **Step 4: Executar o teste focado e confirmar sucesso**

Run: `cd frontend && npm test -- src/pages/dashboard-product-counts.test.tsx --pool=forks --poolOptions.forks.maxForks=2`

Expected: PASS, sem falhas.

- [ ] **Step 5: Commitar a interface**

```bash
git add frontend/src/services/dashboard.service.ts frontend/src/pages/admin/DashboardPage.tsx frontend/src/pages/specialist/SpecialistDashboard.tsx frontend/src/pages/dashboard-product-counts.test.tsx
git commit -m "fix(dashboard): highlight active products"
```

### Task 3: Verificação integrada e validação visual

**Files:**
- Verify: `backend/src/features/dashboard/dashboard.service.ts`
- Verify: `frontend/src/pages/admin/DashboardPage.tsx`
- Verify: `frontend/src/pages/specialist/SpecialistDashboard.tsx`
- Create locally: `artifacts/e2e/active-product-dashboard/`

**Interfaces:**
- Consumes: aplicação local, contas de administrador e especialista, base com produtos ativos e inativos.
- Produces: builds válidos e screenshots desktop/móvel dos dois dashboards.

- [ ] **Step 1: Executar testes focados em sequência**

```bash
cd backend && npm test -- dashboard.service.spec.ts --runInBand
cd frontend && npm test -- src/pages/dashboard-product-counts.test.tsx --pool=forks --poolOptions.forks.maxForks=2
```

Expected: os dois comandos terminam com zero falhas.

- [ ] **Step 2: Executar builds em sequência**

```bash
cd backend && npm run build
cd frontend && npm run build
```

Expected: ambos terminam com exit code 0.

- [ ] **Step 3: Preparar dados e iniciar aplicação**

Usar a configuração local documentada no repositório, garantir pelo menos um produto inativo e iniciar backend e frontend sem executar processos pesados em paralelo com testes ou builds.

- [ ] **Step 4: Validar no navegador**

Entrar como administrador e especialista. Em cada dashboard, confirmar visualmente:

- título `Produtos ativos`;
- número principal igual à contagem ativa preparada;
- auxiliar igual ao total, incluindo o produto inativo;
- ausência de corte ou sobreposição em desktop e viewport móvel.

Salvar evidências em `artifacts/e2e/active-product-dashboard/` ou anexá-las diretamente ao relatório da execução quando o navegador não oferecer persistência local.

- [ ] **Step 5: Revisar diff e publicar**

Revisar mudanças contra `origin/main`, executar novamente os comandos de verificação finais, enviar `codex/active-product-dashboard` e abrir PR com regra, testes e evidências visuais descritos no corpo.
