# Identificador no Formulário Manual e no Modal de CSV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que um especialista crie um produto (carro/barco/aeronave) pelo formulário manual preenchendo `identificador` (hoje impossível — 400 sempre), e corrigir o modal de import CSV para mostrar `identificador` como coluna obrigatória com uma dica de dedup correta.

**Architecture:** Três mudanças isoladas no frontend, sem tocar backend (o contrato — `identificador` obrigatório + `@@unique([specialist_id, identificador])` — já existe e já está em produção via o fluxo de CSV). Task 1 adiciona o input no componente de campos compartilhados. Task 2 propaga o valor do form pro payload da API e atualiza os tipos TS que descrevem a resposta da API. Task 3 corrige as strings estáticas do modal de CSV.

**Tech Stack:** React + Vite + TypeScript, react-hook-form, axios (via `services/*.service.ts`).

## Global Constraints

- **Sem infraestrutura de teste de componente nova.** Este frontend não tem testes de componente React hoje (só testes de função pura em `lib/*.test.ts` via vitest). Verificação de cada task é manual, com passos exatos — não criar `*.test.tsx` novos.
- **Sem mudança de backend.** `CreateCarDto`/`CreateBoatDto`/`CreateAircraftDto`, `PrismaExceptionFilter`, e a constraint `@@unique` já existem e não devem ser tocados.
- **`identificador` é digitado pelo especialista, sem geração automática nem checagem de unicidade em tempo real** (decisão do spec — ver `docs/superpowers/specs/2026-08-04-identificador-manual-e-modal-csv-design.md`).
- Mensagens de commit em português, seguindo o padrão do repo (`feat:`, `fix:`).

---

## File Structure

- `frontend/src/components/specialist/CommonProductFields.tsx` — adiciona o input `identificador`, compartilhado pelos 3 tipos de produto.
- `frontend/src/services/cars.service.ts`, `boats.service.ts`, `aircrafts.service.ts` — adiciona `identificador: string` em `RawCar`/`RawBoat`/`RawAircraft`.
- `frontend/src/components/specialist/ProductForm.tsx` — inclui `identificador` no payload (`formattedData`) enviado pra API.
- `frontend/src/components/shared/XlsxImporter.tsx` — adiciona `identificador` às colunas obrigatórias exibidas e corrige o texto de dica sobre dedup.

---

## Task 1: Campo `identificador` no formulário manual

**Files:**
- Modify: `frontend/src/components/specialist/CommonProductFields.tsx`

**Interfaces:**
- Consumes: nada de outra task (primeira task do plano).
- Produces: input HTML com `name="identificador"` registrado via `register("identificador", { required: ... })` — Task 2 depende do form emitir esse campo em `data.identificador` no submit.

- [ ] **Step 1: Adicionar `identificador` ao objeto `placeholders`**

Em `CommonProductFields.tsx`, dentro do objeto `placeholders` (começa na linha 11), adicionar uma nova entrada logo após `modelo` (que termina na linha 21):

```tsx
    modelo: {
      CAR: "Ex: 488 GTB, 911 Turbo S, Aventador",
      BOAT: "Ex: S6, Flybridge 68, Manhattan 55",
      AIRCRAFT: "Ex: Phenom 300, G650, Citation X",
    },
    identificador: {
      CAR: "Ex: BMW-X5-1",
      BOAT: "Ex: AZIMUT-S6-1",
      AIRCRAFT: "Ex: EMBRAER-PHENOM300-1",
    },
    ano: {
```

- [ ] **Step 2: Adicionar o campo `identificador` no JSX, entre Modelo e Ano**

O bloco de "Modelo" termina no `</div>` da linha 67, e "Ano" começa no comentário `{/* Ano */}` da linha 69. Inserir entre os dois:

```tsx
      {/* Identificador */}
      <div className="flex flex-col gap-2">
        <label htmlFor="identificador" className="text-sm font-medium text-text-primary">
          Identificador *
        </label>
        <input
          id="identificador"
          type="text"
          {...register("identificador", { required: "Identificador é obrigatório" })}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={productType ? placeholders.identificador[productType] : "Ex: BMW-X5-1"}
        />
        {errors.identificador && (
          <span className="text-sm text-red-500">{errors.identificador.message as string}</span>
        )}
      </div>
```

- [ ] **Step 3: Verificar visualmente**

Rodar o frontend: `cd frontend && npm run dev`. Logar como um usuário `SPECIALIST` (ou `ADMIN`) e navegar até `/specialist/products/new`. Confirmar:
1. Um campo "Identificador *" aparece entre "Modelo" e "Ano", para os 3 tipos de produto (trocar o seletor "Tipo de Produto" se logado como ADMIN).
2. Clicar em "Criar Produto" sem preencher o campo mostra o erro "Identificador é obrigatório" abaixo do input, sem enviar a requisição (checar aba Network do devtools — nenhuma chamada a `POST /cars`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/specialist/CommonProductFields.tsx
git commit -m "feat(produtos): adiciona campo identificador no formulario manual"
```

---

## Task 2: Propagar `identificador` pro payload da API e pros tipos

**Files:**
- Modify: `frontend/src/services/cars.service.ts:15-42` (interface `RawCar`)
- Modify: `frontend/src/services/boats.service.ts` (interface `RawBoat`, mesmo padrão de `RawCar`)
- Modify: `frontend/src/services/aircrafts.service.ts` (interface `RawAircraft`, mesmo padrão de `RawCar`)
- Modify: `frontend/src/components/specialist/ProductForm.tsx:205-211`

**Interfaces:**
- Consumes: `data.identificador` do form (produzido pela Task 1 via `register("identificador", ...)`).
- Produces: `formattedData.identificador` no payload enviado a `createCar`/`updateCar`/`createBoat`/`updateBoat`/`createAircraft`/`updateAircraft`. Nenhuma task depende disso depois — é o fim da cadeia (a API já aceita e persiste esse campo).

- [ ] **Step 1: Adicionar `identificador` na interface `RawCar`**

Em `frontend/src/services/cars.service.ts`, na interface `RawCar` (linha 15), adicionar o campo logo após `modelo`:

```ts
export interface RawCar {
  id: string;
  marca: string;
  modelo: string;
  identificador: string;
  valor: number;
```

- [ ] **Step 2: Repetir o Step 1 para `RawBoat` e `RawAircraft`**

Abrir `frontend/src/services/boats.service.ts` e `frontend/src/services/aircrafts.service.ts`. Em cada um, achar a interface (`RawBoat`, `RawAircraft`) e adicionar `identificador: string;` logo após o campo `modelo`, mesmo padrão do Step 1.

- [ ] **Step 3: Rodar o type-check pra confirmar que os 3 arquivos compilam**

```bash
cd frontend && npx tsc -b --noEmit
```

Expected: sem erros novos relacionados a `RawCar`/`RawBoat`/`RawAircraft` ou `identificador`. (Se já havia erros pré-existentes no repo antes desta mudança, ignore-os — não são escopo desta task.)

- [ ] **Step 4: Incluir `identificador` no payload montado em `ProductForm.tsx`**

Em `frontend/src/components/specialist/ProductForm.tsx`, dentro de `onSubmit` (a partir da linha 205), o objeto `formattedData` hoje é:

```ts
      const formattedData: any = {
        marca: data.marca,
        modelo: data.modelo,
        ano: Number(data.ano),
        valor: Number(data.valor),
        estado: data.estado,
      };
```

Adicionar `identificador` (campo comum aos 3 tipos, igual `marca`/`modelo` — não entra nos blocos `if (productType === ...)`):

```ts
      const formattedData: any = {
        marca: data.marca,
        modelo: data.modelo,
        identificador: data.identificador,
        ano: Number(data.ano),
        valor: Number(data.valor),
        estado: data.estado,
      };
```

- [ ] **Step 5: Verificar criação de produto de ponta a ponta**

Com `npm run dev` rodando (frontend) e o backend no ar, logado como `SPECIALIST`:

1. Preencher o formulário em `/specialist/products/new` com um `identificador` novo (ex.: `TESTE-1`) e ao menos uma imagem. Submeter.
   Expected: alerta "Produto criado com sucesso!", sem erro 400.
2. Repetir o cadastro com o **mesmo** `identificador` (`TESTE-1`) pro mesmo especialista.
   Expected: alerta de erro contendo "Já existe um registro" (não um erro técnico cru, não crash da tela) — vem do `PrismaExceptionFilter` (409).
3. Abrir o produto criado no passo 1 em modo edição (`/specialist/products/:id/edit` ou equivalente na navegação da tela de lista).
   Expected: o campo "Identificador" já vem preenchido com `TESTE-1` (herdado de `reset(productData as any)` em `ProductForm.tsx:161`, que já espalha todos os campos de `productData` no form — nenhum código adicional necessário pra isso funcionar).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/cars.service.ts frontend/src/services/boats.service.ts frontend/src/services/aircrafts.service.ts frontend/src/components/specialist/ProductForm.tsx
git commit -m "feat(produtos): envia identificador no payload de criacao/edicao"
```

---

## Task 3: Corrigir modal de import CSV

**Files:**
- Modify: `frontend/src/components/shared/XlsxImporter.tsx:53-95` (`COLUMN_DEFINITIONS`)
- Modify: `frontend/src/components/shared/XlsxImporter.tsx:337-342` (texto de dica)

**Interfaces:**
- Consumes: nada das tasks anteriores — mudança isolada de strings estáticas de UI.
- Produces: nada consumido por outra task — última task do plano.

- [ ] **Step 1: Adicionar `identificador` às colunas obrigatórias dos 3 tipos**

Em `XlsxImporter.tsx`, `COLUMN_DEFINITIONS` (linha 54), trocar `required: ["marca", "modelo", "valor", "estado", "ano"]` por `required: ["marca", "modelo", "identificador", "valor", "estado", "ano"]` nos 3 blocos (`CAR`, `BOAT`, `AIRCRAFT`):

```tsx
const COLUMN_DEFINITIONS: Record<
  ProductType,
  { required: string[]; optional: string[] }
> = {
  CAR: {
    required: ["marca", "modelo", "identificador", "valor", "estado", "ano"],
    optional: [
      "cor",
      "km",
      "cambio",
      "combustivel",
      "tipo_categoria",
      "descricao",
      "folder_url",
    ],
  },
  BOAT: {
    required: ["marca", "modelo", "identificador", "valor", "estado", "ano"],
    optional: [
      "fabricante",
      "tamanho",
      "estilo",
      "combustivel",
      "motor",
      "ano_motor",
      "tipo_embarcacao",
      "descricao_completa",
      "acessorios",
      "folder_url",
    ],
  },
  AIRCRAFT: {
    required: ["marca", "modelo", "identificador", "valor", "estado", "ano"],
    optional: [
      "categoria",
      "assentos",
      "tipo_aeronave",
      "descricao",
      "folder_url",
    ],
  },
};
```

- [ ] **Step 2: Corrigir o texto de dica sobre dedup**

Em `XlsxImporter.tsx`, o último item da lista "Dicas" (linhas 337-342) hoje diz:

```tsx
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 mt-2 bg-gray-400 rounded-full shrink-0"></span>
                Produtos com mesma{" "}
                <strong className="text-gray-900">marca + modelo</strong> serao
                atualizados ao inves de duplicados.
              </li>
```

Substituir por:

```tsx
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 mt-2 bg-gray-400 rounded-full shrink-0"></span>
                Produtos com mesmo{" "}
                <strong className="text-gray-900">identificador</strong> serao
                atualizados ao inves de duplicados (marca e modelo podem se
                repetir entre produtos diferentes).
              </li>
```

- [ ] **Step 3: Verificar visualmente**

Com `npm run dev` rodando, abrir `/specialist/products/new`, clicar em "Upload Planilha" e expandir "Ver estrutura da planilha". Confirmar:
1. `identificador` aparece no grupo "Colunas Obrigatorias" (chip vermelho), pros 3 tipos de produto (trocar o seletor de tipo se aplicável).
2. O último item de "Dicas" menciona `identificador` como chave de dedup, não mais "marca + modelo".
3. Clicar em "Baixar Template" ainda funciona (não foi tocado nesta task — o template já inclui `identificador`, gerado pelo backend).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/shared/XlsxImporter.tsx
git commit -m "fix(produtos): modal de import CSV mostra identificador como obrigatorio e corrige dica de dedup"
```

---

## Critérios de aceitação (do spec)

1. Criar um carro/barco/aeronave pelo formulário manual, preenchendo `identificador`, salva com sucesso (sem 400). → coberto pela verificação da Task 2.
2. Tentar criar um segundo produto do mesmo especialista com o mesmo `identificador` mostra mensagem de erro amigável na tela. → coberto pela verificação da Task 2.
3. Modal de import CSV mostra `identificador` na lista de colunas obrigatórias, para os 3 tipos de produto. → coberto pela verificação da Task 3.
4. Texto de dica do modal não afirma mais que dedup é por marca+modelo; descreve corretamente o dedup por `identificador`. → coberto pela verificação da Task 3.
