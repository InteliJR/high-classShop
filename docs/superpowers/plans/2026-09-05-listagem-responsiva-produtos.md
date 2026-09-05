# Listagem responsiva de produtos — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir produtos como cartões em telas estreitas e tabela compacta em telas amplas, com `Produto BRL/USD` junto ao nome e sem moeda nos nomes dos clientes locais.

**Architecture:** A busca, o filtro e a navegação permanecem em `ProductsPage`. Um novo componente apresentacional recebe produtos e callbacks, renderizando cartões abaixo de 1280 px e tabela a partir de 1280 px; o selo monetário é derivado exclusivamente de `currency`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, Testing Library, PostgreSQL local.

## Global Constraints

- Não alterar a lógica monetária, negociação, valor mínimo, contrato, APIs ou schema.
- Exibir `Produto BRL` ou `Produto USD` depois do nome completo do produto.
- Manter o valor no locale `pt-BR`, com `R$` ou `US$`.
- Não depender de rolagem horizontal abaixo de 1280 px.
- Preservar `PROJECT-OVERVIEW.md` sem edição ou versionamento.
- Executar Vitest com no máximo dois workers.

---

### Task 1: Componente responsivo da listagem

**Files:**
- Create: `frontend/src/components/specialist/ResponsiveProductList.tsx`
- Create: `frontend/src/components/specialist/ResponsiveProductList.test.tsx`
- Modify: `frontend/src/pages/specialist/ProductsPage.tsx`

**Interfaces:**
- Consumes: `ProductCurrency`, `formatCurrency`, callbacks `(id: string) => void`.
- Produces: `ProductListItem` e `ResponsiveProductList({ products, onEdit, onDelete })`.

- [ ] **Step 1: Escrever o teste que falha**

Criar fixtures BRL e USD e verificar:

```tsx
render(
  <ResponsiveProductList
    products={products}
    onEdit={onEdit}
    onDelete={onDelete}
  />,
);

expect(cardList.className).toContain("xl:hidden");
expect(table.className).toContain("hidden xl:block");
expect(screen.getAllByText("Produto BRL")).toHaveLength(2);
expect(screen.getAllByText("Produto USD")).toHaveLength(2);
expect(screen.getAllByText("R$ 120.000,00")).toHaveLength(2);
expect(screen.getAllByText("US$ 120.000,00")).toHaveLength(2);
```

Adicionar um segundo teste que clica nas primeiras ações acessíveis e confirma
`onEdit("brl")` e `onDelete("brl")`.

- [ ] **Step 2: Executar RED**

Run:

```bash
cd frontend
rtk npm test -- --maxWorkers=2 src/components/specialist/ResponsiveProductList.test.tsx
```

Expected: FAIL porque `ResponsiveProductList` ainda não existe.

- [ ] **Step 3: Implementar o componente mínimo**

Definir:

```tsx
export interface ProductListItem {
  id: string;
  marca: string;
  modelo: string;
  ano?: number;
  valor: number;
  currency: ProductCurrency;
  estado?: string;
  imageUrl?: string;
}

interface ResponsiveProductListProps {
  products: ProductListItem[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}
```

Renderizar:

```tsx
<div data-testid="product-card-list" className="grid gap-3 sm:grid-cols-2 xl:hidden">
  {products.map((product) => (
    <article key={product.id}>
      <h3>{product.marca} {product.modelo}</h3>
      <span>Produto {product.currency}</span>
      <dl>
        <dt>Ano</dt><dd>{product.ano || "-"}</dd>
        <dt>Valor</dt><dd>{formatCurrency(product.valor, product.currency)}</dd>
        <dt>Estado</dt><dd>{product.estado || "-"}</dd>
      </dl>
      <button aria-label={`Editar ${product.marca} ${product.modelo}`} onClick={() => onEdit(product.id)}>Editar</button>
      <button aria-label={`Excluir ${product.marca} ${product.modelo}`} onClick={() => onDelete(product.id)}>Excluir</button>
    </article>
  ))}
</div>
<div data-testid="product-table" className="hidden overflow-hidden xl:block">
  <table>
    <thead><tr><th>Produto</th><th>Ano</th><th>Valor</th><th>Estado</th><th>Ações</th></tr></thead>
    <tbody>
      {products.map((product) => (
        <tr key={product.id}>
          <td>{product.marca} {product.modelo} <span>Produto {product.currency}</span></td>
          <td>{product.ano || "-"}</td>
          <td>{formatCurrency(product.valor, product.currency)}</td>
          <td>{product.estado || "-"}</td>
          <td>
            <button aria-label={`Editar ${product.marca} ${product.modelo}`} onClick={() => onEdit(product.id)}>Editar</button>
            <button aria-label={`Excluir ${product.marca} ${product.modelo}`} onClick={() => onDelete(product.id)}>Excluir</button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

O nome visível é `${marca} ${modelo}` e o selo é `Produto ${currency}`. Usar
`formatCurrency(valor, currency)` nas duas superfícies e manter o fallback
`sem foto`.

- [ ] **Step 4: Integrar à página**

Remover a tabela de sete colunas de `ProductsPage` e renderizar:

```tsx
<ResponsiveProductList
  products={filteredProducts}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>
```

Mover o tipo local de produto para `ProductListItem` e remover imports que não
forem mais usados.

- [ ] **Step 5: Executar GREEN**

Run:

```bash
cd frontend
rtk npm test -- --maxWorkers=2 src/components/specialist/ResponsiveProductList.test.tsx
```

Expected: 1 arquivo e 2 testes aprovados.

- [ ] **Step 6: Executar regressão e build**

Run:

```bash
cd frontend
rtk npm test -- --maxWorkers=2
rtk npm run build
```

Expected: todos os testes e o build terminam com código zero; apenas o warning
já conhecido de chunk acima de 500 kB pode permanecer.

- [ ] **Step 7: Commitar a implementação**

```bash
rtk git add frontend/src/components/specialist/ResponsiveProductList.tsx frontend/src/components/specialist/ResponsiveProductList.test.tsx frontend/src/pages/specialist/ProductsPage.tsx
rtk git commit -m "feat: make product listing responsive"
```

### Task 2: Ajustar fixtures locais e entregar o ambiente

**Files:**
- Modify: nenhum arquivo de aplicação; somente dados do database local `highclass_task8`.

**Interfaces:**
- Consumes: usuários `verify8.brl@highclass.local` e `verify8.usd@highclass.local`, carros `83000000-0000-4000-8000-000000000001` e `83000000-0000-4000-8000-000000000002`.
- Produces: nomes de cliente `Bruna` e `Uri`, modelo BRL sem moeda duplicada e selos derivados da moeda na interface.

- [ ] **Step 1: Atualizar somente os fixtures identificados**

No PostgreSQL local, executar uma transação que:

```sql
UPDATE "User" SET surname = ''
WHERE email IN ('verify8.brl@highclass.local', 'verify8.usd@highclass.local');

UPDATE "Car" SET modelo = 'Sedan 120'
WHERE id = '83000000-0000-4000-8000-000000000001';
```

Não alterar e-mail, papel, moeda, valor ou relacionamentos.

- [ ] **Step 2: Verificar dados e serviços**

Consultar os dois usuários e os dois carros. Confirmar backend e frontend com:

```bash
rtk curl -sS http://127.0.0.1:3000/api/health
rtk curl -sS -o /dev/null -w 'frontend_http=%{http_code}\n' http://127.0.0.1:5173/
```

Expected: clientes sem `Cliente BRL/USD`, produtos em `BRL/120000` e
`USD/120000`, backend `status=ok` e frontend HTTP 200.

- [ ] **Step 3: Reiniciar ou confirmar o frontend ativo**

Se o watcher anterior não estiver ativo, iniciar:

```bash
cd frontend
rtk npm run dev -- --host 0.0.0.0
```

Deixar `http://localhost:5173/specialist/products` disponível para validação.
