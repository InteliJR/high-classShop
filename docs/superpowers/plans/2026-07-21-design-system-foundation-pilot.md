# Design System — Fundação + Piloto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a fundação do novo design system (tokens, componentes `ui/` e `patterns/`) descrita em `DESIGN.md`, e aplicá-la a um piloto real: a página "Meus Clientes" do Consultor + os 3 becos sem saída críticos mapeados na auditoria (callback do DocuSign, modal de convite em lote, `/advisor/dashboard` órfão).

**Architecture:** Tokens novos são **aditivos** em `frontend/src/index.css` (nenhum token existente é removido ou renomeado — o resto da plataforma, fora do piloto, continua usando os tokens antigos até seu próprio ciclo de migração). Componentes novos vivem em `frontend/src/components/ui/` (primitivos sobre Radix + CVA) e `frontend/src/components/patterns/` (composições próprias: `BackButton`, `PageHeader`, `EmptyState`, `StatusBadge`). O `Button` existente (`components/ui/button.tsx`) é reescrito com CVA por dentro, mas mantém exatamente as mesmas variantes e o mesmo import (`import Button from ".../ui/button"`) usados hoje pelos ~18 arquivos que já o consomem — zero mudança visual fora do piloto.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind CSS v4 (tokens via `@theme` em CSS, sem `tailwind.config.js`) + Radix UI (`@radix-ui/react-dialog`) + `class-variance-authority` (CVA) + `clsx` + `tailwind-merge` + `lucide-react` (já instalado).

## Global Constraints

- Nenhum token existente em `frontend/src/index.css` é removido, renomeado ou tem seu valor alterado — só adição de tokens novos.
- Todo componente novo usa import relativo (`../../lib/utils`, etc.) — o projeto não usa alias `@/`, não introduzir um agora (fora de escopo).
- `Button` (`components/ui/button.tsx`) mantém export default, mesma prop `variant` com os mesmos 4 valores existentes (`solid`, `light`, `muted`, `brand`) rendendo pixel-idênticos ao que renderizam hoje — variantes novas (`ghost`, `danger`) são só adição.
- O frontend **não tem test runner configurado** (sem Jest/Vitest/RTL) — não instalar um agora, isso é fora de escopo desta spec. Verificação de cada tarefa é: `npx tsc -b` (type-check) limpo + checklist manual no navegador (`npm run dev`), conforme convenção já usada neste projeto para mudanças de frontend.
- `Tabs` e `Dropdown menu` (listados no inventário de componentes do `DESIGN.md`) **não** entram neste plano — nenhuma tela tocada aqui precisa deles; ficam para quando uma tela real os consumir, na fase de rollout do restante.
- Consolidar os dois `Modal` concorrentes (`components/ui/Modal.tsx` e `components/shared/Modal.tsx`) nas ~14 outras telas que ainda os usam é trabalho da fase de rollout do restante, não desta spec — aqui só o piloto migra para o `Dialog` novo.
- Sempre rodar os comandos a partir de `frontend/` (`cd frontend` primeiro, ou usar `npm --prefix frontend run ...` a partir da raiz).

---

### Task 1: Instalar dependências novas + criar `cn()`

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/lib/utils.ts`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` — usado por toda tarefa seguinte que cria/edita um componente.

- [ ] **Step 1: Instalar as dependências**

Rodar a partir de `frontend/`:

```bash
cd frontend
npm install class-variance-authority clsx tailwind-merge @radix-ui/react-dialog
```

Expected: `package.json` ganha as 4 entradas em `dependencies`; `package-lock.json` atualizado; sem erro.

- [ ] **Step 2: Criar `frontend/src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Verificar**

```bash
npx tsc -b
```

Expected: nenhum erro (arquivo novo não é importado por ninguém ainda, só precisa compilar).

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/utils.ts
git commit -m "feat(design-system): instalar CVA/Radix Dialog e criar utilitário cn()"
```

---

### Task 2: Adicionar tokens novos em `index.css`

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:**
- Produces: classes utilitárias Tailwind novas — `bg-ink`, `text-ink`, `bg-ink-soft`, `text-ink-soft`, `bg-action`, `bg-action-hover`, `text-muted`, `text-subtle`, `border-border`, `bg-border-soft`, `border-border-soft`, `bg-surface`, `text-surface`, `ring-focus-ring`, `bg-status-{sched,neg,proc,doc,ok,bad}`, `bg-status-{...}-wash`, `border-status-{...}-line`, `text-status-{...}`, `bg-status-bad-hover`, `shadow-ds-card`, `shadow-ds-floating`, `shadow-ds-modal`, `text-h1`, `text-h2`. Usadas por toda tarefa seguinte.

- [ ] **Step 1: Adicionar o bloco de tokens novos ao final do `@theme` existente**

Editar `frontend/src/index.css` — dentro do bloco `@theme { ... }` já existente (não remover nada do que já está lá), adicionar logo antes do `}` de fechamento (depois da linha `--color-brand-secondary-fg: var(--brand-secondary-fg, #FFFFFF);`):

```css
  /* Design system v2 (ver DESIGN.md) — tokens novos, aditivos.
     Os tokens acima continuam intactos até a migração das telas
     existentes (rollout fatiado por área, fora desta spec). */
  --color-ink: #1c1c1c;
  --color-ink-soft: #3c3c3c;
  --color-action: #2c2c2c;
  --color-action-hover: #1c1c1c;
  --color-muted: #6b6b6b;
  --color-subtle: #9a9a9a;
  --color-border: #d9d9d9;
  --color-border-soft: #e9e9e9;
  --color-surface: #ffffff;
  --color-focus-ring: #1c1c1c;

  --color-status-sched: #1d4ed8;
  --color-status-sched-wash: #eff6ff;
  --color-status-sched-line: #bfdbfe;

  --color-status-neg: #b45309;
  --color-status-neg-wash: #fffbeb;
  --color-status-neg-line: #fde68a;

  --color-status-proc: #c2410c;
  --color-status-proc-wash: #fff7ed;
  --color-status-proc-line: #fed7aa;

  --color-status-doc: #7e22ce;
  --color-status-doc-wash: #faf5ff;
  --color-status-doc-line: #e9d5ff;

  --color-status-ok: #15803d;
  --color-status-ok-wash: #f0fdf4;
  --color-status-ok-line: #bbf7d0;

  --color-status-bad: #b91c1c;
  --color-status-bad-wash: #fef2f2;
  --color-status-bad-line: #fecaca;
  --color-status-bad-hover: #941414;

  --shadow-ds-card: 0 1px 2px rgba(28,28,28,.06), 0 1px 3px rgba(28,28,28,.08);
  --shadow-ds-floating: 0 4px 12px rgba(28,28,28,.12);
  --shadow-ds-modal: 0 10px 30px rgba(0,0,0,.25);

  /* Tipografia (DESIGN.md § Tipografia) — só os 2 papéis usados no piloto
     (h1/h2); os demais papéis da tabela (display/h3/body/small/label) ficam
     para quando uma tela real os consumir, na fase de rollout do restante. */
  --text-h1: 1.625rem;
  --text-h1--line-height: 1.25;
  --text-h2: 1.25rem;
  --text-h2--line-height: 1.3;
```

- [ ] **Step 2: Verificar que o dev server sobe sem erro de CSS**

```bash
npm run dev
```

Expected: Vite compila sem erro. Abrir `http://localhost:5173`, confirmar visualmente que nada mudou (esses tokens ainda não são usados em lugar nenhum).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(design-system): adicionar tokens de cor e sombra do design system (aditivo)"
```

---

### Task 3: Reescrever `components/ui/button.tsx` com CVA

**Files:**
- Modify: `frontend/src/components/ui/button.tsx`

**Interfaces:**
- Consumes: `cn` de `../../lib/utils` (Task 1).
- Produces: `export default function Button(props: ButtonProps)` — `ButtonProps` estende `React.ButtonHTMLAttributes<HTMLButtonElement>` com `variant?: "solid" | "light" | "muted" | "brand" | "ghost" | "danger"` (default `"solid"`). Mesma assinatura de antes + 2 variantes novas.

- [ ] **Step 1: Substituir o conteúdo do arquivo**

Conteúdo atual (referência, para conferir que nada de comportamento muda para as 4 variantes antigas):

```tsx
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'light' | 'muted' | 'brand';
}

export default function Button({
  children,
  className,
  variant = 'solid',
  ...props
}: ButtonProps) {

  const buttonStyles = `
    font-semibold py-2 px-4 rounded-lg
    cursor-pointer transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    active:scale-95
  `;

  const variantStyles = {
    solid: `
      bg-button-solid text-white
      hover:bg-[--color-button-solid-hover]
      focus:ring-[--color-button-solid]`,
    light: `
      bg-white text-gray-900 border border-gray-300
      hover:bg-gray-100
      focus:ring-gray-400`,
    muted: `
      bg-gray-300 text-gray-900
      hover:bg-gray-400
      focus:ring-gray-300`,
    brand: `
      bg-brand-primary text-brand-primary-fg
      hover:opacity-90
      focus:ring-brand-primary`,
  };

  return (
    <button
      className={`${buttonStyles} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

Substituir por (variantes `solid`/`light`/`muted`/`brand` levam exatamente as mesmas classes Tailwind de antes — só `ghost` e `danger` são novas, usando os tokens da Task 2):

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'font-semibold py-2 px-4 rounded-lg cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95',
  {
    variants: {
      variant: {
        solid: 'bg-button-solid text-white hover:bg-[--color-button-solid-hover] focus:ring-[--color-button-solid]',
        light: 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-100 focus:ring-gray-400',
        muted: 'bg-gray-300 text-gray-900 hover:bg-gray-400 focus:ring-gray-300',
        brand: 'bg-brand-primary text-brand-primary-fg hover:opacity-90 focus:ring-brand-primary',
        ghost: 'bg-transparent text-ink-soft hover:bg-border-soft focus:ring-focus-ring',
        danger: 'bg-status-bad text-white hover:bg-status-bad-hover focus:ring-status-bad',
      },
    },
    defaultVariants: {
      variant: 'solid',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export default function Button({ children, className, variant, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant }), className)} {...props}>
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc -b
```

Expected: sem erro (os ~18 arquivos que importam `Button` continuam passando `variant="solid" | "light" | "muted" | "brand"`, todos ainda válidos).

- [ ] **Step 3: Verificar visualmente que nada mudou fora do piloto**

```bash
npm run dev
```

Abrir qualquer tela que já usa `Button` hoje (ex: `/login`) e confirmar que o botão está visualmente idêntico a antes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/button.tsx
git commit -m "refactor(design-system): reescrever Button com CVA, adicionar variantes ghost e danger"
```

---

### Task 4: Corrigir beco sem saída — callback do DocuSign

**Files:**
- Modify: `frontend/src/pages/specialist/ContractPreviewCallback.tsx`

**Interfaces:**
- Consumes: `Button` de `../../components/ui/button` (Task 3).

- [ ] **Step 1: Adicionar imports**

No topo do arquivo, junto aos imports existentes:

```tsx
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/button";
```

(o import de `useSearchParams` já existe na linha 2 — adicionar `useNavigate` ao mesmo `import { ... } from "react-router-dom"`, ficando `import { useSearchParams, useNavigate } from "react-router-dom";`)

- [ ] **Step 2: Declarar `navigate` e corrigir `handleClose` para ter um fallback**

Substituir:

```tsx
  // Tentar fechar a janela/tab se aberta em popup
  const handleClose = () => {
    if (window.opener) {
      window.close();
    }
  };
```

por:

```tsx
  const navigate = useNavigate();

  // Tentar fechar a janela/tab se aberta em popup; se não for popup
  // (acesso direto à URL, ou postMessage/iframe falhou), navega de volta
  // em vez de deixar a tela sem nenhuma saída.
  const handleClose = () => {
    if (window.opener) {
      window.close();
    } else {
      navigate("/specialist/processes");
    }
  };
```

- [ ] **Step 3: Trocar os botões `cancelled`/`error` (raw `<button>`) pelo `Button` novo**

Substituir (bloco `status === "cancelled"`):

```tsx
            <button
              onClick={handleClose}
              className="px-6 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition"
            >
              Fechar
            </button>
```

por:

```tsx
            <Button onClick={handleClose}>Fechar</Button>
```

Substituir o bloco equivalente em `status === "error"` (mesmo trecho, mais abaixo) da mesma forma.

- [ ] **Step 4: Adicionar o botão que faltava no estado de sucesso**

Substituir:

```tsx
        {status === "success" && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-slate-800 mb-2">
              Sucesso!
            </h1>
            <p className="text-slate-600 mb-6">{message}</p>
            <p className="text-sm text-slate-500">
              Esta janela será fechada automaticamente...
            </p>
          </>
        )}
```

por:

```tsx
        {status === "success" && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-slate-800 mb-2">
              Sucesso!
            </h1>
            <p className="text-slate-600 mb-6">{message}</p>
            <p className="text-sm text-slate-500 mb-4">
              Esta janela será fechada automaticamente...
            </p>
            <Button variant="light" onClick={() => navigate("/specialist/processes")}>
              Voltar para processos
            </Button>
          </>
        )}
```

- [ ] **Step 5: Verificar**

```bash
npx tsc -b
npm run dev
```

Manual: navegar direto (sem popup) para `http://localhost:5173/specialist/contracts/preview-callback?event=send&envelopeId=teste` logado como `SPECIALIST`. Confirmar que aparece o botão "Voltar para processos" e que clicar nele navega para `/specialist/processes` (em vez de travar a tela). Repetir com `?event=cancel` e `?event=error` e confirmar que "Fechar" também navega (não só tenta `window.close()`).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/specialist/ContractPreviewCallback.tsx
git commit -m "fix(navegacao): callback do DocuSign nao fica mais sem saida quando aberto fora de popup"
```

---

### Task 5: Corrigir navegação órfã do `/advisor/dashboard`

**Files:**
- Modify: `frontend/src/layouts/Sidebar.tsx`

- [ ] **Step 1: Adicionar `UserCheck` ao import de ícones**

Substituir a linha do import (linhas 1-16):

```tsx
import {
  TextAlignJustifyIcon,
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  Car,
  Ship,
  Plane,
  Package,
  Home,
  FilePen,
  Settings,
  Percent,
  Database,
} from "lucide-react";
```

por:

```tsx
import {
  TextAlignJustifyIcon,
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  Car,
  Ship,
  Plane,
  Package,
  Home,
  FilePen,
  Settings,
  Percent,
  Database,
  UserCheck,
} from "lucide-react";
```

- [ ] **Step 2: Adicionar o link comum depois do `switch`, antes do `}` que fecha `if (user) {`**

O bloco hoje termina assim (linhas ~163-189):

```tsx
      case "OFFICE":
        links.push(
          {
            to: "/office/dashboard",
            label: "Dashboard",
            icon: <LayoutDashboard size={20} />,
          },
          {
            to: "/office/consultants",
            label: "Consultores",
            icon: <Users size={20} />,
          },
          {
            to: "/office/clients",
            label: "Clientes",
            icon: <UserCog size={20} />,
          },
          {
            to: "/office/company",
            label: "Minha Empresa",
            icon: <Building2 size={20} />,
          },
        );
        break;
    }
  }
```

Substituir por (adiciona o link comum logo após o `switch`, só para quem não é `OFFICE` — rota `/advisor/dashboard` só permite `CUSTOMER`/`CONSULTANT`/`SPECIALIST`/`ADMIN`, conferido em `routes.tsx`):

```tsx
      case "OFFICE":
        links.push(
          {
            to: "/office/dashboard",
            label: "Dashboard",
            icon: <LayoutDashboard size={20} />,
          },
          {
            to: "/office/consultants",
            label: "Consultores",
            icon: <Users size={20} />,
          },
          {
            to: "/office/clients",
            label: "Clientes",
            icon: <UserCog size={20} />,
          },
          {
            to: "/office/company",
            label: "Minha Empresa",
            icon: <Building2 size={20} />,
          },
        );
        break;
    }

    if (user.role !== "OFFICE") {
      links.push({
        to: "/advisor/dashboard",
        label: "Meus Assessorados",
        icon: <UserCheck size={20} />,
      });
    }
  }
```

- [ ] **Step 3: Verificar**

```bash
npx tsc -b
npm run dev
```

Manual: logar como `CUSTOMER` (ou qualquer papel que não seja `OFFICE`), confirmar que "Meus Assessorados" aparece na Sidebar e leva para `/advisor/dashboard`. Logar como usuário com role `OFFICE` (se houver conta de teste) e confirmar que o link **não** aparece (rota não permite esse papel).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/layouts/Sidebar.tsx
git commit -m "fix(navegacao): adicionar /advisor/dashboard na Sidebar (estava orfao de qualquer nav persistente)"
```

---

### Task 6: Criar `components/ui/input.tsx`

**Files:**
- Create: `frontend/src/components/ui/input.tsx`

**Interfaces:**
- Consumes: `cn` de `../../lib/utils`.
- Produces: `export const Input` — `forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>`.

- [ ] **Step 1: Criar o arquivo**

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-focus-ring",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";
```

- [ ] **Step 2: Verificar**

```bash
npx tsc -b
```

Expected: sem erro. (Uso visual é verificado holisticamente na Task 12 — piloto.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/input.tsx
git commit -m "feat(design-system): criar componente Input"
```

---

### Task 7: Criar `components/ui/card.tsx`

**Files:**
- Create: `frontend/src/components/ui/card.tsx`

**Interfaces:**
- Consumes: `cn` de `../../lib/utils`.
- Produces: `export function Card(props: React.HTMLAttributes<HTMLDivElement>)`.

- [ ] **Step 1: Criar o arquivo**

```tsx
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-lg shadow-ds-card p-6",
        className
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Verificar**

```bash
npx tsc -b
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/card.tsx
git commit -m "feat(design-system): criar componente Card"
```

---

### Task 8: Criar `components/ui/alert.tsx`

**Files:**
- Create: `frontend/src/components/ui/alert.tsx`

**Interfaces:**
- Consumes: `cn` de `../../lib/utils`.
- Produces: `export function Alert(props: AlertProps)` — `variant?: "success" | "warning" | "danger" | "info"` (default `"info"`).

- [ ] **Step 1: Criar o arquivo**

```tsx
import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const alertVariants = cva("flex gap-3 items-start rounded-md border px-4 py-3 text-sm", {
  variants: {
    variant: {
      success: "bg-status-ok-wash border-status-ok-line text-status-ok",
      warning: "bg-status-neg-wash border-status-neg-line text-status-neg",
      danger: "bg-status-bad-wash border-status-bad-line text-status-bad",
      info: "bg-status-sched-wash border-status-sched-line text-status-sched",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}
```

- [ ] **Step 2: Verificar**

```bash
npx tsc -b
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/alert.tsx
git commit -m "feat(design-system): criar componente Alert"
```

---

### Task 9: Criar `components/ui/dialog.tsx` (Radix Dialog)

**Files:**
- Create: `frontend/src/components/ui/dialog.tsx`

**Interfaces:**
- Consumes: `cn` de `../../lib/utils`; `@radix-ui/react-dialog` (Task 1).
- Produces: `export const Dialog` (= `DialogPrimitive.Root`, props `open: boolean`, `onOpenChange: (open: boolean) => void`); `export function DialogContent({ title, children, className }: { title: string; children: ReactNode; className?: string })`.

- [ ] **Step 1: Criar o arquivo**

```tsx
import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export const Dialog = DialogPrimitive.Root;

export function DialogContent({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[min(560px,90vw)] max-h-[85vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-ds-modal",
          className
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <DialogPrimitive.Title className="text-base font-semibold text-ink">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            className="text-muted hover:text-ink"
            aria-label="Fechar"
          >
            <X size={18} />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
```

- [ ] **Step 2: Verificar**

```bash
npx tsc -b
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/dialog.tsx
git commit -m "feat(design-system): criar componente Dialog sobre Radix (titulo, X, ESC, overlay-click de graca)"
```

---

### Task 10: Criar `components/patterns/StatusBadge.tsx`

**Files:**
- Create: `frontend/src/components/patterns/StatusBadge.tsx`

**Interfaces:**
- Consumes: `cn` de `../../lib/utils`.
- Produces: `export function StatusBadge({ status, className }: { status: string; className?: string })`.

- [ ] **Step 1: Criar o arquivo**

```tsx
import { cn } from "../../lib/utils";

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  SCHEDULING: { label: "Agendamento", dot: "bg-status-sched" },
  NEGOTIATION: { label: "Negociação", dot: "bg-status-neg" },
  PROCESSING_CONTRACT: { label: "Contrato", dot: "bg-status-proc" },
  DOCUMENTATION: { label: "Documentação", dot: "bg-status-doc" },
  COMPLETED: { label: "Concluído", dot: "bg-status-ok" },
  REJECTED: { label: "Rejeitado", dot: "bg-status-bad" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-border-soft px-2.5 py-1 text-xs font-semibold text-ink-soft",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config?.dot ?? "bg-subtle")} />
      {config?.label ?? status}
    </span>
  );
}
```

- [ ] **Step 2: Verificar**

```bash
npx tsc -b
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/patterns/StatusBadge.tsx
git commit -m "feat(design-system): criar StatusBadge (pilula neutra + ponto de cor, uma so receita)"
```

---

### Task 11: Criar `components/patterns/EmptyState.tsx`

**Files:**
- Create: `frontend/src/components/patterns/EmptyState.tsx`

**Interfaces:**
- Consumes: `cn` de `../../lib/utils`; `LucideIcon` de `lucide-react`.
- Produces: `export function EmptyState({ icon, title, description, action, className }: EmptyStateProps)`.

- [ ] **Step 1: Criar o arquivo**

```tsx
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "text-center py-12 px-4 border border-dashed border-border rounded-lg",
        className
      )}
    >
      <Icon className="mx-auto mb-3 h-8 w-8 text-subtle" />
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="text-sm text-muted mt-1 mb-4">{description}</p>}
      {action}
    </div>
  );
}
```

- [ ] **Step 2: Verificar**

```bash
npx tsc -b
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/patterns/EmptyState.tsx
git commit -m "feat(design-system): criar EmptyState (icone + frase + acao)"
```

---

### Task 12: Criar `components/patterns/BackButton.tsx` e `PageHeader.tsx`

**Files:**
- Create: `frontend/src/components/patterns/BackButton.tsx`
- Create: `frontend/src/components/patterns/PageHeader.tsx`

**Interfaces:**
- Consumes: `cn` de `../../lib/utils`; `react-router-dom` (`Link`, `useNavigate`).
- Produces: `export function BackButton({ to, label, className }: { to?: string; label?: string; className?: string })`; `export function PageHeader({ title, showBack, backTo, actions }: PageHeaderProps)`.

Nota de escopo: o piloto (Task 13) usa `PageHeader` com `showBack` omitido (`false`) — "Meus Clientes" é reachável direto pela Sidebar, então não precisa de volta (regra do template de layout em `DESIGN.md`: "BackButton só se aninhada"). O branch `showBack=true`/`BackButton` é validado quando uma página aninhada (ex: detalhe de processo) migrar, na fase de rollout do restante — aqui a verificação é só `tsc -b` limpo.

- [ ] **Step 1: Criar `BackButton.tsx`**

```tsx
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";

export function BackButton({
  to,
  label = "Voltar",
  className,
}: {
  to?: string;
  label?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const classes = cn(
    "inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink w-fit",
    className
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        <ArrowLeft size={16} />
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => navigate(-1)} className={classes}>
      <ArrowLeft size={16} />
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Criar `PageHeader.tsx`**

```tsx
import type { ReactNode } from "react";
import { BackButton } from "./BackButton";

export interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  backTo?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, showBack = false, backTo, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div className="flex flex-col gap-1">
        {showBack && <BackButton to={backTo} />}
        <h1 className="text-h1 font-bold text-ink">{title}</h1>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Verificar**

```bash
npx tsc -b
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/patterns/BackButton.tsx frontend/src/components/patterns/PageHeader.tsx
git commit -m "feat(design-system): criar BackButton e PageHeader (substitui os 4 padroes de voltar espalhados)"
```

---

### Task 13: Piloto — reescrever `ConsultantClientsPage.tsx`

**Files:**
- Modify: `frontend/src/pages/consultant/ConsultantClientsPage.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 12), `StatusBadge` (Task 10), `EmptyState` (Task 11), `Dialog`/`DialogContent` (Task 9), `Alert` (Task 8), `Card` (Task 7), `Button` (Task 3).

- [ ] **Step 1: Trocar os imports**

Substituir:

```tsx
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getClients,
  getClientProcesses,
  removeClient,
  type Client,
} from "../../services/consultant.service";
import Button from "../../components/ui/button";
import Modal from "../../components/ui/Modal";
import InviteClientForm from "./InviteClientForm";
import BatchInviteClients from "./BatchInviteClients";
import EditClientForm from "./EditClientForm";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import TrashIcon from "../../assets/icons/trash.svg";
import EditIcon from "../../assets/icons/edit.svg";
```

por:

```tsx
import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getClients,
  getClientProcesses,
  removeClient,
  type Client,
} from "../../services/consultant.service";
import Button from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { Card } from "../../components/ui/card";
import { Dialog, DialogContent } from "../../components/ui/dialog";
import { PageHeader } from "../../components/patterns/PageHeader";
import { StatusBadge } from "../../components/patterns/StatusBadge";
import { EmptyState } from "../../components/patterns/EmptyState";
import InviteClientForm from "./InviteClientForm";
import BatchInviteClients from "./BatchInviteClients";
import EditClientForm from "./EditClientForm";
import { ChevronDown, ChevronUp, Loader2, Pencil, Trash2, Plus, Users } from "lucide-react";
```

- [ ] **Step 2: Remover os mapas `STATUS_LABELS`/`STATUS_COLORS` locais**

Remover (linhas 26-42 do arquivo original):

```tsx
const STATUS_LABELS: Record<string, string> = {
  SCHEDULING: "Agendamento",
  NEGOTIATION: "Negociação",
  PROCESSING_CONTRACT: "Contrato",
  DOCUMENTATION: "Documentação",
  COMPLETED: "Concluído",
  REJECTED: "Rejeitado",
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULING: "bg-blue-100 text-blue-700",
  NEGOTIATION: "bg-yellow-100 text-yellow-700",
  PROCESSING_CONTRACT: "bg-orange-100 text-orange-700",
  DOCUMENTATION: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};
```

(o `StatusBadge` importado na Task 10 já cobre o mesmo mapeamento — não precisa mais existir duplicado nesta página.)

- [ ] **Step 3: Trocar o cabeçalho da página pelo `PageHeader`**

Substituir:

```tsx
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="text-text-main w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="h1-style">Meus Clientes</h1>
        <div className="flex gap-2">
          <Button type="button" onClick={() => setIsBatchModalOpen(true)}>
            Convite em lote
          </Button>
          <Button type="button" onClick={() => setIsInviteModalOpen(true)}>
            + Convidar Cliente
          </Button>
        </div>
      </div>

      <div className="p-6 rounded-lg shadow bg-white">
        <h2 className="h2-style">Clientes</h2>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Expanda um cliente para ver seus processos. Para criar processo, abra o catálogo e clique em "Iniciar processo para cliente" no produto.
        </p>

        {clients.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Nenhum cliente ainda. Clique em "+ Convidar Cliente" para começar.
          </div>
        ) : (
```

por:

```tsx
  return (
    <div className="text-text-main w-full">
      <PageHeader
        title="Meus Clientes"
        actions={
          <>
            <Button type="button" variant="light" onClick={() => setIsBatchModalOpen(true)}>
              Convite em lote
            </Button>
            <Button type="button" onClick={() => setIsInviteModalOpen(true)}>
              <Plus size={16} />
              Convidar cliente
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <Card>
        <h2 className="text-h2 font-semibold text-ink mb-1">Clientes</h2>
        <p className="text-sm text-muted mb-6">
          Expanda um cliente para ver seus processos. Para criar processo, abra o catálogo e clique em "Iniciar processo para cliente" no produto.
        </p>

        {clients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum cliente ainda"
            description='Clique em "Convidar cliente" para começar.'
            action={
              <Button type="button" onClick={() => setIsInviteModalOpen(true)}>
                <Plus size={16} />
                Convidar cliente
              </Button>
            }
          />
        ) : (
```

Note: o `if (error) return <p className="text-red-500">{error}</p>;` que existia antes do `return (` principal foi removido nesta troca — o erro agora renderiza como `Alert` acima do `Card`, sem bloquear o resto da página.

- [ ] **Step 4: Trocar a lista de clientes (grid rígido) por tabela responsiva**

Substituir o bloco (do `<div className="flex flex-col gap-3">` até o `)}` que fecha o `clients.map`):

```tsx
          <div className="flex flex-col gap-3">
            {clients.map((client) => {
              const isExpanded = expandedClient === client.id;
              const processes = clientProcesses[client.id] ?? [];
              const isLoadingProc = loadingProcesses === client.id;

              return (
                <div key={client.id} className="rounded-lg border border-gray-200 overflow-hidden">
                  {/* Client row */}
                  <div className="grid grid-cols-[auto_2fr_1.5fr_1fr_auto] gap-4 items-center px-4 py-4 bg-white">
                    <button
                      onClick={() => toggleExpand(client.id)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {isExpanded
                        ? <ChevronUp className="w-5 h-5 text-gray-500" />
                        : <ChevronDown className="w-5 h-5 text-gray-500" />
                      }
                    </button>

                    <div>
                      <p className="font-medium text-gray-900">{client.name} {client.surname}</p>
                      <p className="text-xs text-gray-400">{formatCPF(client.cpf)}</p>
                    </div>

                    <p className="text-sm text-gray-600 truncate">{client.email}</p>

                    <p className="text-xs text-gray-400">
                      {client.created_at ? new Date(client.created_at).toLocaleDateString("pt-BR") : "-"}
                    </p>

                    <div className="flex items-center gap-2">
                      <button onClick={() => setClientToEdit(client)} className="p-1.5 hover:bg-gray-100 rounded">
                        <img src={EditIcon} alt="Editar" className="h-4 w-4" />
                      </button>
                      <button onClick={() => setClientToDelete(client)} className="p-1.5 hover:bg-red-50 rounded">
                        <img src={TrashIcon} alt="Remover" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded: processes */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
                      {isLoadingProc ? (
                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Carregando processos...
                        </div>
                      ) : processes.length === 0 ? (
                        <p className="text-sm text-gray-500">Nenhum processo ainda.</p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Processos ({processes.length})
                          </p>
                          {processes.map((proc) => (
                            <div
                              key={proc.id}
                              onClick={() => navigate(`/consultant/processes/${proc.id}`)}
                              className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-gray-100 hover:border-gray-300 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[proc.status] ?? "bg-gray-100 text-gray-600"}`}>
                                  {STATUS_LABELS[proc.status] ?? proc.status}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {proc.product_type ?? "Consultoria"} •{" "}
                                  {proc.specialist ? `${proc.specialist.name} ${proc.specialist.surname}` : "—"}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400">
                                {new Date(proc.created_at).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
```

por (tabela dentro de contêiner com rolagem horizontal própria — a página hoje tem zero classes responsivas, mapeado na auditoria):

```tsx
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs uppercase tracking-wide text-muted font-semibold px-4 py-3">
                    Cliente
                  </th>
                  <th className="text-left text-xs uppercase tracking-wide text-muted font-semibold px-4 py-3">
                    E-mail
                  </th>
                  <th className="text-left text-xs uppercase tracking-wide text-muted font-semibold px-4 py-3">
                    Cadastro
                  </th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const isExpanded = expandedClient === client.id;
                  const processes = clientProcesses[client.id] ?? [];
                  const isLoadingProc = loadingProcesses === client.id;

                  return (
                    <Fragment key={client.id}>
                      <tr className="border-b border-border-soft hover:bg-border-soft/50">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleExpand(client.id)}
                            className="inline-flex items-center gap-2 font-medium text-ink"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            {client.name} {client.surname}
                          </button>
                          <p className="text-xs text-subtle mt-0.5 pl-6">{formatCPF(client.cpf)}</p>
                        </td>
                        <td className="px-4 py-3 text-muted truncate">{client.email}</td>
                        <td className="px-4 py-3 text-muted">
                          {client.created_at ? new Date(client.created_at).toLocaleDateString("pt-BR") : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => setClientToEdit(client)}
                              className="p-1.5 rounded hover:bg-border-soft text-ink-soft"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => setClientToDelete(client)}
                              className="p-1.5 rounded hover:bg-status-bad-wash text-status-bad"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={4} className="bg-border-soft/40 px-6 py-4">
                            {isLoadingProc ? (
                              <div className="flex items-center gap-2 text-subtle text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Carregando processos...
                              </div>
                            ) : processes.length === 0 ? (
                              <p className="text-sm text-muted">Nenhum processo ainda.</p>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                                  Processos ({processes.length})
                                </p>
                                {processes.map((proc) => (
                                  <div
                                    key={proc.id}
                                    onClick={() => navigate(`/consultant/processes/${proc.id}`)}
                                    className="flex items-center justify-between bg-surface rounded-lg px-4 py-3 border border-border-soft hover:border-border cursor-pointer transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <StatusBadge status={proc.status} />
                                      <span className="text-sm text-muted">
                                        {proc.product_type ?? "Consultoria"} •{" "}
                                        {proc.specialist ? `${proc.specialist.name} ${proc.specialist.surname}` : "—"}
                                      </span>
                                    </div>
                                    <span className="text-xs text-subtle">
                                      {new Date(proc.created_at).toLocaleDateString("pt-BR")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
```

- [ ] **Step 5: Trocar os 4 `Modal` pelo `Dialog`/`DialogContent` novo**

Substituir:

```tsx
      {/* Modais */}
      <Modal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)}>
        <InviteClientForm onSuccess={() => { setIsInviteModalOpen(false); fetchClients(); }} />
      </Modal>

      <Modal isOpen={isBatchModalOpen} onClose={() => setIsBatchModalOpen(false)}>
        <BatchInviteClients onClose={() => setIsBatchModalOpen(false)} />
      </Modal>

      <Modal isOpen={!!clientToEdit} onClose={() => setClientToEdit(null)}>
        {clientToEdit && (
          <EditClientForm client={clientToEdit} onSuccess={() => { setClientToEdit(null); fetchClients(); }} />
        )}
      </Modal>

      <Modal isOpen={!!clientToDelete} onClose={() => setClientToDelete(null)}>
        <div className="text-center">
          <h2 className="h2-style mb-4">Confirmar Remoção</h2>
          <p className="text-text-secondary mb-8">
            Remover <strong>{clientToDelete?.name} {clientToDelete?.surname}</strong>? O cliente não será apagado, apenas desvinculado.
          </p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => setClientToDelete(null)}>Cancelar</Button>
            <Button onClick={handleDelete}>Confirmar</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
```

por:

```tsx
      {/* Modais */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent title="Convidar cliente">
          <InviteClientForm onSuccess={() => { setIsInviteModalOpen(false); fetchClients(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
        <DialogContent title="Convite de clientes em lote">
          <BatchInviteClients onClose={() => setIsBatchModalOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!clientToEdit} onOpenChange={(open) => !open && setClientToEdit(null)}>
        <DialogContent title="Editar cliente">
          {clientToEdit && (
            <EditClientForm client={clientToEdit} onSuccess={() => { setClientToEdit(null); fetchClients(); }} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
        <DialogContent title="Confirmar remoção">
          <div>
            <p className="text-muted mb-6">
              Remover <strong className="text-ink">{clientToDelete?.name} {clientToDelete?.surname}</strong>? O cliente não será apagado, apenas desvinculado.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="light" onClick={() => setClientToDelete(null)}>Cancelar</Button>
              <Button variant="danger" onClick={handleDelete}>Confirmar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
```

- [ ] **Step 6: Verificar tipos**

```bash
npx tsc -b
```

Expected: sem erro.

- [ ] **Step 7: Verificar visualmente**

```bash
npm run dev
```

Logar como `CONSULTANT`, ir em "Meus Clientes":
- Confirmar que a tabela aparece com Cliente/E-mail/Cadastro/ações.
- Redimensionar a janela do navegador para largura de celular (ou abrir DevTools em modo responsivo) e confirmar que a tabela rola horizontalmente dentro da própria caixa, sem quebrar o layout da página.
- Expandir um cliente com processos e confirmar que o `StatusBadge` aparece (pílula cinza + ponto colorido) em vez do badge saturado antigo.
- Abrir os 4 modais (Convidar cliente, Convite em lote, Editar, Excluir) e confirmar: título aparece, X fecha, ESC fecha, clique fora fecha, e o modal de exclusão tem Cancelar (light) + Confirmar (danger, vermelho).
- Confirmar que uma lista vazia de clientes (se houver conta de teste sem clientes) mostra o `EmptyState` com ícone, texto e botão de ação.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/consultant/ConsultantClientsPage.tsx
git commit -m "feat(piloto): reescrever Meus Clientes com PageHeader, StatusBadge, Dialog, EmptyState e tabela responsiva"
```

---

### Task 14: Piloto — corrigir beco sem saída do `BatchInviteClients.tsx`

**Files:**
- Modify: `frontend/src/pages/consultant/BatchInviteClients.tsx`

**Interfaces:**
- Consumes: `Button` (Task 3).

- [ ] **Step 1: Trocar o import do ícone de upload e adicionar ícones de status**

Substituir:

```tsx
import { Loader2, Upload } from "lucide-react";
```

por:

```tsx
import { Loader2, Upload, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
```

- [ ] **Step 2: Trocar o botão "Cancelar" bruto pelo `Button` novo, e tokenizar o input de arquivo**

Substituir:

```tsx
      <input
        type="file"
        accept=".csv"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setJob(null);
          setError(null);
        }}
        className="block w-full text-sm mb-4 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-gray-300 file:bg-gray-50 file:text-sm"
      />

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {!job && (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <Button type="button" onClick={upload} disabled={!file || uploading}>
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Enviar
          </Button>
        </div>
      )}
```

por:

```tsx
      <input
        type="file"
        accept=".csv"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setJob(null);
          setError(null);
        }}
        className="block w-full text-sm mb-4 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:bg-border-soft file:text-sm"
      />

      {error && (
        <p className="text-sm text-status-bad mb-3">{error}</p>
      )}

      {!job && (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="light" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={upload} disabled={!file || uploading}>
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Enviar
          </Button>
        </div>
      )}
```

- [ ] **Step 3: Corrigir o beco sem saída — adicionar botão "Fechar" visível durante o processamento**

Este é o achado da auditoria: hoje, entre o momento em que `job` existe e o momento em que `job.done` vira verdadeiro, **nenhum botão é renderizado** — a única saída é clicar na área escura do modal, sem nenhuma pista visual. Substituir:

```tsx
      {job && (
        <div>
          <div className="flex flex-wrap gap-4 text-sm mb-3">
            <span className="text-green-700">✓ {job.successItems} enviados</span>
            <span className="text-red-600">✗ {job.failedItems} falhas</span>
            <span className="text-gray-500">
              ↻ {job.duplicateItems} duplicados
            </span>
            {!job.done && (
              <span className="flex items-center gap-1 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" /> processando…
              </span>
            )}
          </div>
```

por:

```tsx
      {job && (
        <div>
          <div className="flex flex-wrap items-center gap-4 text-sm mb-3">
            <span className="flex items-center gap-1 text-status-ok">
              <CheckCircle2 className="w-4 h-4" /> {job.successItems} enviados
            </span>
            <span className="flex items-center gap-1 text-status-bad">
              <XCircle className="w-4 h-4" /> {job.failedItems} falhas
            </span>
            <span className="flex items-center gap-1 text-muted">
              <RefreshCw className="w-4 h-4" /> {job.duplicateItems} duplicados
            </span>
            {!job.done && (
              <span className="flex items-center gap-1 text-muted">
                <Loader2 className="w-4 h-4 animate-spin" /> processando…
              </span>
            )}
            {!job.done && (
              <Button type="button" variant="light" onClick={onClose} className="ml-auto">
                Fechar (continua em segundo plano)
              </Button>
            )}
          </div>
```

- [ ] **Step 4: Tokenizar a cor da mensagem de erro por linha**

Substituir:

```tsx
                    <td className="px-2 py-1 text-xs text-red-500">
                      {it.error_message ?? ""}
                    </td>
```

por:

```tsx
                    <td className="px-2 py-1 text-xs text-status-bad">
                      {it.error_message ?? ""}
                    </td>
```

(o botão "Fechar" de quando `job.done` é verdadeiro já usa `Button` hoje — não precisa mudar.)

- [ ] **Step 5: Verificar**

```bash
npx tsc -b
npm run dev
```

Manual: logar como `CONSULTANT`, abrir "Convite em lote", subir um CSV válido com várias linhas. Durante o intervalo de processamento (antes de `job.done` virar verdadeiro), confirmar que agora existe um botão "Fechar (continua em segundo plano)" visível — antes desse fix, essa janela de tempo não tinha nenhum botão.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/consultant/BatchInviteClients.tsx
git commit -m "fix(navegacao): convite em lote nao fica mais sem botao durante o processamento do CSV"
```

---

### Task 15: Verificação final

**Files:** nenhum (só verificação)

- [ ] **Step 1: Build completo**

```bash
cd frontend
npm run build
```

Expected: `tsc -b` e `vite build` terminam sem erro.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: sem erro (avisos pré-existentes no restante do código, fora do escopo deste plano, podem continuar aparecendo — não introduzir novos).

- [ ] **Step 3: Checklist manual de navegação, com o dev server rodando (`npm run dev`)**

- [ ] `/login` → botão continua com a mesma aparência de antes (Task 3 não deveria ter mudado nada visualmente fora do piloto).
- [ ] Logado como `CONSULTANT` → "Meus Clientes": tabela responsiva, badges com ponto de cor, modais com título/X/ESC/Cancelar, empty state se não houver clientes.
- [ ] Logado como `CONSULTANT` → "Convite em lote" com um CSV grande o bastante para ver o estado intermediário: botão "Fechar (continua em segundo plano)" aparece durante o processamento.
- [ ] Acessar `/specialist/contracts/preview-callback?event=send` direto pela URL (sem popup), logado como `SPECIALIST`: botão "Voltar para processos" aparece e funciona.
- [ ] Logado como qualquer papel não-`OFFICE`: "Meus Assessorados" aparece na Sidebar e leva para `/advisor/dashboard`.
- [ ] Nenhuma outra tela (Admin, Specialist, Customer, Auth) mudou visualmente — são telas fora do piloto e devem continuar exatamente como estavam.

- [ ] **Step 4: Commit final (se sobrar algum ajuste do checklist manual)**

```bash
git add -A
git commit -m "chore(design-system): ajustes finais da verificacao manual da fundacao + piloto"
```

(pular este commit se nada precisou ser ajustado.)
