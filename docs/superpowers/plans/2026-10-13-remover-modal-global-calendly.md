# Remove Global Calendly Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover a interrupção global do Calendly e deixar explícito que especialistas podem anunciar produtos sem conectar uma conta.

**Architecture:** `MainLayout` deixa de montar qualquer gate ou lembrete global do Calendly. A oferta de conexão permanece no cadastro concluído e no perfil, enquanto testes de composição protegem o layout e a mensagem opcional.

**Tech Stack:** React 19, TypeScript 5.8, Vitest 4, Testing Library.

## Global Constraints

- Calendly permanece opcional e limitado a perfil e agendamentos.
- Cadastro manual e importação de produtos continuam inalterados.
- Executar Vitest com no máximo dois workers.
- Não alterar o backend.

---

### Task 1: Remover o lembrete global do layout

**Files:**
- Create: `frontend/src/layouts/MainLayout.test.tsx`
- Modify: `frontend/src/layouts/MainLayout.tsx`
- Delete: `frontend/src/components/calendly/RequireCalendlyModal.tsx`
- Delete: `frontend/src/components/calendly/RequireCalendlyModal.test.tsx`

**Interfaces:**
- Consumes: `AuthContext` e `AppContext` já usados por `MainLayout`.
- Produces: layout que renderiza conteúdo de especialista sem consultar `getCalendlyOAuthStatus`.

- [ ] **Step 1: Escrever o teste de regressão**

Criar um teste jsdom que renderiza `MainLayout` com um usuário `SPECIALIST`, aguarda os efeitos React e verifica:

```ts
expect(getCalendlyOAuthStatus).not.toHaveBeenCalled();
expect(screen.queryByRole("dialog", { name: /Conecte seu Calendly/i })).toBeNull();
```

- [ ] **Step 2: Confirmar a falha**

Run: `cd frontend && npm test -- src/layouts/MainLayout.test.tsx --pool=forks --maxWorkers=2`

Expected: FAIL porque o layout atual consulta o status OAuth e monta `RequireCalendlyModal`.

- [ ] **Step 3: Implementar a correção mínima**

Remover de `MainLayout.tsx`:

```ts
import RequireCalendlyModal from "../components/calendly/RequireCalendlyModal";
```

e:

```tsx
{user?.role === "SPECIALIST" && <RequireCalendlyModal />}
```

Apagar o componente e seu teste, pois não restarão consumidores.

- [ ] **Step 4: Confirmar o teste verde**

Run: `cd frontend && npm test -- src/layouts/MainLayout.test.tsx --pool=forks --maxWorkers=2`

Expected: PASS.

### Task 2: Corrigir a mensagem pós-cadastro

**Files:**
- Modify: `frontend/src/pages/auth/RegisterSpecialistPage.test.tsx`
- Modify: `frontend/src/pages/auth/RegisterSpecialistPage.tsx`

**Interfaces:**
- Consumes: retorno bem-sucedido de `registerSpecialist`.
- Produces: confirmação que apresenta o Calendly como opção de automação de agendamentos.

- [ ] **Step 1: Escrever o teste de regressão**

Preencher o formulário válido, concluir o cadastro e verificar:

```ts
expect(await screen.findByText(/Calendly é opcional/i)).toBeTruthy();
expect(screen.queryByText(/para poder anunciar produtos/i)).toBeNull();
```

- [ ] **Step 2: Confirmar a falha**

Run: `cd frontend && npm test -- src/pages/auth/RegisterSpecialistPage.test.tsx --pool=forks --maxWorkers=2`

Expected: FAIL porque a mensagem atual afirma que a conexão é necessária para anunciar.

- [ ] **Step 3: Atualizar somente a mensagem**

Usar o texto:

```tsx
O Calendly é opcional. Conecte sua conta se quiser automatizar o agendamento de reuniões com clientes.
```

- [ ] **Step 4: Confirmar o teste verde**

Run: `cd frontend && npm test -- src/pages/auth/RegisterSpecialistPage.test.tsx --pool=forks --maxWorkers=2`

Expected: PASS.

### Task 3: Verificar e preparar o PR

**Files:**
- Verify: todos os arquivos alterados nas Tasks 1 e 2.

**Interfaces:**
- Consumes: correção completa e testes focados verdes.
- Produces: branch verificável e PR contra `develop`.

- [ ] **Step 1: Executar os testes frontend**

Run: `cd frontend && npm test -- --pool=forks --maxWorkers=2`

Expected: todas as suítes passam.

- [ ] **Step 2: Executar o build**

Run: `cd frontend && npm run build`

Expected: TypeScript e Vite concluem com código 0.

- [ ] **Step 3: Revisar o diff e referências restantes**

Run: `git diff --check && rg -n "RequireCalendlyModal" frontend/src || true`

Expected: nenhum erro de whitespace e nenhuma referência restante.

- [ ] **Step 4: Commit, push e PR**

```bash
git add docs/superpowers frontend/src
git commit -m "fix(frontend): remove Calendly modal from product flow"
git push -u origin codex/fix-calendly-product-modal
gh pr create --base develop --head codex/fix-calendly-product-modal
```
