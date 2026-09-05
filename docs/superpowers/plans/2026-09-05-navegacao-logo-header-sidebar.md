# Navegação pela logo no Header e na Sidebar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a logo da plataforma ou do escritório parceiro um atalho consistente para o catálogo público ou para o início da área autenticada, tanto no Header quanto na Sidebar.

**Architecture:** Adicionar um helper puro em `roleUtils.ts` que aceite um papel autenticado ou sua ausência e resolva o destino da marca. Header e Sidebar usarão esse helper em links internos semânticos do React Router; a Sidebar também reutilizará seu fechamento de drawer no clique mobile.

**Tech Stack:** React 19, TypeScript 5.8, React Router 7, Zustand, Vitest 4, Testing Library e Tailwind CSS 4.

## Global Constraints

- Visitantes devem ir para `/catalog/cars`.
- `CUSTOMER`, `CONSULTANT`, `SPECIALIST`, `ADMIN` e `OFFICE` devem ir para suas páginas iniciais já existentes.
- A mesma regra vale para a logo padrão e a logo white-label.
- Não criar rotas, chamadas de API, estado persistente ou componentes de marca adicionais.
- Não tornar clicável a marca dos painéis de autenticação nem renderizar nova logo na Sidebar desktop recolhida.
- Preservar o arquivo não rastreado `PROJECT-OVERVIEW.md` e qualquer outra mudança preexistente do usuário.
- Executar Vitest com no máximo dois forks por causa do limite global de memória da máquina.

---

## File Structure

- `frontend/src/utils/roleUtils.ts`: mantém as rotas iniciais por papel e passa a expor o destino único da marca.
- `frontend/src/utils/roleUtils.test.ts`: cobre visitante, ausência explícita de papel e todos os papéis autenticados.
- `frontend/src/layouts/Header.tsx`: troca o botão imperativo da logo por um link interno para o destino centralizado.
- `frontend/src/layouts/Header.test.tsx`: comprova os destinos público e autenticado da marca no Header.
- `frontend/src/layouts/Sidebar.tsx`: transforma a logo visível em link e fecha o drawer após o clique mobile.
- `frontend/src/layouts/Sidebar.test.tsx`: comprova que a marca da Sidebar expõe o destino correto para visitante e escritório.
- `frontend/src/layouts/Sidebar.interaction.test.tsx`: comprova navegação real no `MemoryRouter`, preservação visual white-label e fechamento do drawer.

### Task 1: Centralizar o destino da marca

**Files:**

- Create: `frontend/src/utils/roleUtils.test.ts`
- Modify: `frontend/src/utils/roleUtils.ts:1-21`

**Interfaces:**

- Consumes: `UserRole` de `frontend/src/types/types.ts` e `getRoleBasedRoute(role: UserRole): string` já existente.
- Produces: `getBrandHomeRoute(role: UserRole | null | undefined): string`, usado pelo Header e pela Sidebar.

- [ ] **Step 1: Escrever o teste falhando do helper público e autenticado**

Criar `frontend/src/utils/roleUtils.test.ts` com:

```ts
import { describe, expect, it } from "vitest";
import { getBrandHomeRoute } from "./roleUtils";

describe("getBrandHomeRoute", () => {
  it("envia visitantes para o catálogo de carros", () => {
    expect(getBrandHomeRoute(undefined)).toBe("/catalog/cars");
    expect(getBrandHomeRoute(null)).toBe("/catalog/cars");
  });

  it("envia cada papel autenticado para sua página inicial", () => {
    expect(getBrandHomeRoute("CUSTOMER")).toBe("/customer/home");
    expect(getBrandHomeRoute("CONSULTANT")).toBe("/consultant/dashboard");
    expect(getBrandHomeRoute("SPECIALIST")).toBe("/specialist/dashboard");
    expect(getBrandHomeRoute("ADMIN")).toBe("/admin/dashboard");
    expect(getBrandHomeRoute("OFFICE")).toBe("/office/dashboard");
  });
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha esperada**

Run:

```bash
cd frontend
rtk npm test -- src/utils/roleUtils.test.ts --pool=forks --poolOptions.forks.maxForks=2
```

Expected: FAIL porque `getBrandHomeRoute` ainda não é exportado por `roleUtils.ts`.

- [ ] **Step 3: Implementar o helper mínimo**

Adicionar após `getRoleBasedRoute` em `frontend/src/utils/roleUtils.ts`:

```ts
/**
 * Returns the destination used when the platform or white-label logo is selected.
 */
export function getBrandHomeRoute(
  role: UserRole | null | undefined,
): string {
  return role == null ? "/catalog/cars" : getRoleBasedRoute(role);
}
```

- [ ] **Step 4: Executar o teste e confirmar que passa**

Run:

```bash
cd frontend
rtk npm test -- src/utils/roleUtils.test.ts --pool=forks --poolOptions.forks.maxForks=2
```

Expected: 1 arquivo e 2 testes passando.

- [ ] **Step 5: Commitar o helper e seu teste**

```bash
rtk git add frontend/src/utils/roleUtils.ts frontend/src/utils/roleUtils.test.ts
rtk git commit -m "feat(nav): centraliza destino da marca"
```

### Task 2: Aplicar o destino semântico no Header

**Files:**

- Modify: `frontend/src/layouts/Header.test.tsx:1-50`
- Modify: `frontend/src/layouts/Header.tsx:1-130`

**Interfaces:**

- Consumes: `getBrandHomeRoute(role: UserRole | null | undefined): string` da Task 1 e `Link` do React Router.
- Produces: um link de marca acessível no Header, com destino público ou autenticado.

- [ ] **Step 1: Tornar o estado de autenticação do teste configurável**

Em `frontend/src/layouts/Header.test.tsx`, importar `UserProps`, adicionar `user` ao estado içado e fazer o mock retornar esse valor:

```ts
import type { CompanyBranding, UserProps } from "../types/types";

const state = vi.hoisted(() => ({
  user: null as UserProps | null,
  whitelabelCompany: {
    id: "company-1",
    name: "AXBR Investimentos",
    logoUrl: "https://cdn.example.com/axbr.png",
  } as CompanyBranding,
}));

vi.mock("../store/authStateManager", () => ({
  useAuth: () => ({ user: state.user }),
}));
```

Adicionar limpeza antes de cada teste:

```ts
beforeEach(() => {
  state.user = null;
  vi.clearAllMocks();
});
```

Atualizar o import do Vitest para:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
```

- [ ] **Step 2: Escrever os testes falhando dos destinos do Header**

Adicionar ao bloco `describe("Header mobile")`:

```ts
it("leva a marca white-label do visitante ao catálogo de carros", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <AppContext.Provider value={appContext}>
        <Header />
      </AppContext.Provider>
    </MemoryRouter>,
  );

  expect(html).toContain('aria-label="Ir para o catálogo de carros"');
  expect(html).toMatch(
    /aria-label="Ir para o catálogo de carros"[^>]*href="\/catalog\/cars"/,
  );
  expect(html).toContain('alt="AXBR Investimentos"');
});

it("leva a marca de um escritório autenticado ao dashboard", () => {
  state.user = {
    id: "office-1",
    name: "Gerente",
    surname: "Teste",
    email: "office@example.com",
    cpf: "00000000000",
    rg: "000000000",
    role: "OFFICE",
    company: { id: "company-1", name: "AXBR Investimentos" },
  };

  const html = renderToStaticMarkup(
    <MemoryRouter>
      <AppContext.Provider value={appContext}>
        <Header />
      </AppContext.Provider>
    </MemoryRouter>,
  );

  expect(html).toContain('aria-label="Ir para o início"');
  expect(html).toMatch(
    /aria-label="Ir para o início"[^>]*href="\/office\/dashboard"/,
  );
});
```

- [ ] **Step 3: Executar o teste e confirmar a falha esperada**

Run:

```bash
cd frontend
rtk npm test -- src/layouts/Header.test.tsx --pool=forks --poolOptions.forks.maxForks=2
```

Expected: FAIL porque a marca ainda é um `button` e o visitante ainda navega para `/`.

- [ ] **Step 4: Trocar a navegação imperativa da marca por `Link`**

Em `frontend/src/layouts/Header.tsx`, manter `useNavigate` para os outros controles e alterar os imports relevantes:

```ts
import { Link, useNavigate } from "react-router-dom";
import { getBrandHomeRoute } from "../utils/roleUtils";
```

Substituir `handleLogoClick` pelo destino calculado:

```ts
const brandHomeRoute = getBrandHomeRoute(user?.role);
```

Substituir a marca autenticada por:

```tsx
<Link
  to={brandHomeRoute}
  className="cursor-pointer"
  aria-label="Ir para o início"
>
  <img
    src={brandLogo}
    alt={company?.name ?? "BMF Lux Brokerage"}
    className="max-h-14 w-auto max-w-36 object-contain"
  />
</Link>
```

Substituir a marca do visitante por:

```tsx
<Link
  to={brandHomeRoute}
  className="cursor-pointer"
  aria-label="Ir para o catálogo de carros"
>
  <img
    src={brandLogo}
    alt={company?.name ?? "BMF Lux Brokerage"}
    className="w-25 sm:w-35 h-auto"
  />
</Link>
```

- [ ] **Step 5: Executar o teste focado do Header**

Run:

```bash
cd frontend
rtk npm test -- src/layouts/Header.test.tsx --pool=forks --poolOptions.forks.maxForks=2
```

Expected: todos os testes de `Header.test.tsx` passando.

- [ ] **Step 6: Commitar o Header e seus testes**

```bash
rtk git add frontend/src/layouts/Header.tsx frontend/src/layouts/Header.test.tsx
rtk git commit -m "feat(header): navega pela marca"
```

### Task 3: Tornar a marca da Sidebar navegável

**Files:**

- Modify: `frontend/src/layouts/Sidebar.test.tsx:43-87`
- Modify: `frontend/src/layouts/Sidebar.interaction.test.tsx:1-108`
- Modify: `frontend/src/layouts/Sidebar.tsx:23-249`

**Interfaces:**

- Consumes: `getBrandHomeRoute(role: UserRole | null | undefined): string` da Task 1, `Link` já usado pela Sidebar e `setSidebarCollapsed(false)` já usado pelos demais links.
- Produces: uma logo navegável na Sidebar visível e fechamento do drawer após seleção mobile.

- [ ] **Step 1: Escrever as asserções estáticas falhando da marca da Sidebar**

Em `frontend/src/layouts/Sidebar.test.tsx`, adicionar ao teste do visitante white-label:

```ts
expect(html).toContain('aria-label="Ir para o catálogo de carros"');
expect(html).toMatch(
  /aria-label="Ir para o catálogo de carros"[^>]*href="\/catalog\/cars"/,
);
```

Adicionar ao teste do usuário `OFFICE`:

```ts
expect(html).toContain('aria-label="Ir para o início"');
expect(html).toMatch(
  /aria-label="Ir para o início"[^>]*href="\/office\/dashboard"/,
);
```

- [ ] **Step 2: Preparar a observação de rota no teste interativo**

Em `frontend/src/layouts/Sidebar.interaction.test.tsx`, importar `useLocation`:

```ts
import { MemoryRouter, useLocation } from "react-router-dom";
```

Adicionar antes de `MobileNavigationHarness`:

```tsx
function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Rota atual">{location.pathname}</output>;
}
```

Mudar a entrada inicial do harness para outra categoria e renderizar a sonda:

```tsx
<MemoryRouter initialEntries={["/catalog/boats"]}>
  <AppContext.Provider value={appContext}>
    <Header />
    <Sidebar />
    <LocationProbe />
  </AppContext.Provider>
</MemoryRouter>
```

- [ ] **Step 3: Escrever o teste interativo falhando do clique mobile**

Adicionar ao bloco `describe("Sidebar mobile interactions")`:

```ts
it("navega pela logo white-label e fecha o drawer", async () => {
  const user = userEvent.setup();
  render(<MobileNavigationHarness />);

  await user.click(screen.getByRole("button", { name: "Abrir menu" }));

  const dialog = screen.getByRole("dialog", { name: "Menu principal" });
  const brandLink = within(dialog).getByRole("link", {
    name: "Ir para o catálogo de carros",
  });

  expect(brandLink.getAttribute("href")).toBe("/catalog/cars");
  expect(within(dialog).getByAltText("AXBR Investimentos")).not.toBeNull();

  await user.click(brandLink);

  await waitFor(() => {
    expect(dialog.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByLabelText("Rota atual").textContent).toBe(
      "/catalog/cars",
    );
  });
});
```

- [ ] **Step 4: Executar os testes e confirmar as falhas esperadas**

Run:

```bash
cd frontend
rtk npm test -- src/layouts/Sidebar.test.tsx src/layouts/Sidebar.interaction.test.tsx --pool=forks --poolOptions.forks.maxForks=2
```

Expected: FAIL porque a logo da Sidebar ainda é uma imagem sem link.

- [ ] **Step 5: Implementar o link da marca na Sidebar**

Em `frontend/src/layouts/Sidebar.tsx`, importar o helper:

```ts
import { getBrandHomeRoute } from "../utils/roleUtils";
```

Calcular o destino junto dos demais dados derivados:

```ts
const brandHomeRoute = getBrandHomeRoute(user?.role);
```

Substituir o contêiner da logo visível por:

```tsx
{!isDesktopCollapsed && (
  <Link
    to={brandHomeRoute}
    aria-label={user ? "Ir para o início" : "Ir para o catálogo de carros"}
    onClick={() => {
      if (isMobile) setSidebarCollapsed(false);
    }}
    className="w-2/3 flex justify-center items-center mx-auto"
  >
    <img
      src={brandLogo}
      alt={company?.name ?? "BMF Lux Brokerage"}
      className="max-h-24 w-auto object-contain"
    />
  </Link>
)}
```

- [ ] **Step 6: Executar os testes focados da Sidebar**

Run:

```bash
cd frontend
rtk npm test -- src/layouts/Sidebar.test.tsx src/layouts/Sidebar.interaction.test.tsx --pool=forks --poolOptions.forks.maxForks=2
```

Expected: todos os testes dos dois arquivos passando, incluindo navegação, fechamento, foco e estado inerte.

- [ ] **Step 7: Commitar a Sidebar e seus testes**

```bash
rtk git add frontend/src/layouts/Sidebar.tsx frontend/src/layouts/Sidebar.test.tsx frontend/src/layouts/Sidebar.interaction.test.tsx
rtk git commit -m "feat(sidebar): navega pela marca"
```

### Task 4: Verificação integrada do frontend

**Files:**

- Verify: `frontend/src/utils/roleUtils.ts`
- Verify: `frontend/src/layouts/Header.tsx`
- Verify: `frontend/src/layouts/Sidebar.tsx`
- Verify: testes relacionados em `frontend/src/utils` e `frontend/src/layouts`

**Interfaces:**

- Consumes: os três incrementos das Tasks 1–3.
- Produces: evidência de que a navegação, a tipagem e o bundle de produção permanecem válidos.

- [ ] **Step 1: Executar todos os testes diretamente relacionados**

Run:

```bash
cd frontend
rtk npm test -- src/utils/roleUtils.test.ts src/layouts/Header.test.tsx src/layouts/Sidebar.test.tsx src/layouts/Sidebar.interaction.test.tsx --pool=forks --poolOptions.forks.maxForks=2
```

Expected: quatro arquivos passando, sem testes falhos.

- [ ] **Step 2: Executar a suíte completa com memória limitada**

Run:

```bash
cd frontend
rtk npm test -- --pool=forks --poolOptions.forks.maxForks=2
```

Expected: todos os testes do frontend passando e processo encerrado com código zero.

- [ ] **Step 3: Executar o build de produção sem concorrer com os testes**

Run:

```bash
cd frontend
rtk npm run build
```

Expected: `tsc -b` e `vite build` concluídos com código zero.

- [ ] **Step 4: Confirmar que somente os arquivos previstos foram alterados**

Run:

```bash
rtk git status --short
rtk git log -4 --oneline
```

Expected: nenhum arquivo da implementação pendente; `PROJECT-OVERVIEW.md` pode continuar aparecendo como não rastreado por ser preexistente. Os commits da especificação, do plano e das três tarefas devem aparecer no histórico recente.
