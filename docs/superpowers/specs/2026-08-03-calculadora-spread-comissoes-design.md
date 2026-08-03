# Calculadora de spread de comissões (admin) + remoção da aba "Meus Assessorados"

**Data:** 2026-08-03
**Escopo:** frontend apenas. Zero mudanças no backend.

## Contexto

Dois ajustes na visão do admin da plataforma:

1. **Calculadora de spread de comissões** — permite ao admin simular como a comissão
   de uma venda se divide entre especialista, escritório (opcional) e plataforma,
   escolhendo produto/especialista/escritório para pré-preencher, mas com todos os
   campos numéricos sempre editáveis (modo livre). Inclui uma versão reduzida no dashboard.
2. **Remover "Meus Assessorados"** da navegação — a aba não faz sentido; só consultores
   têm carteira de clientes e já têm a aba exclusiva "Meus Clientes".

## Modelo de cálculo (fonte de verdade: backend)

A matemática já existe e é pura, em `backend/src/features/contracts/commission-split.ts`
(`computeNestedCommissionSplit`). Split aninhado ("bolo"):

```
bolo         = venda × totalCommissionRate%
especialista = bolo × specialistShareRate%
restante     = bolo − especialista
escritório   = restante × officeShareRate%
plataforma   = restante − escritório        (resíduo — soma sempre bate no bolo)
```

Cada valor é arredondado a 2 casas; a plataforma absorve o resíduo de arredondamento,
então especialista + escritório + plataforma = bolo exatamente.

**Drivers da calculadora** (os únicos inputs que movem o resultado):

| Input | Origem do pré-preenchimento | Semântica |
|-------|------------------------------|-----------|
| Valor de venda (R$) | Produto (`car/boat/aircraft.valor`) ou manual | `proposalValue` |
| Comissão total da venda (%) | Manual (alavanca do especialista); seed 10% | `totalCommissionRate` |
| Fatia do especialista sobre o bolo (%) | `specialist.commission_rate` | `specialistShareRate` |
| Fatia do escritório sobre o restante (%) | `company.commission_rate` (0 se "Nenhum") | `officeShareRate` |

**Plataforma = resíduo.** Não tem campo de taxa de entrada — é fiel ao que o contrato
gera hoje. `PlatformCompany.default_commission_rate` e `Company.platform_commission_rate`
NÃO entram no split aninhado (confirmado em `resolveCommissionFromTotal`, que não usa
`platformRate` no cálculo).

**Modo livre:** todos os 4 campos numéricos são sempre editáveis. Selecionar
produto/especialista/escritório apenas pré-preenche; o admin pode sobrescrever qualquer
valor. Não há toggle de "modo livre" separado — é inerente aos campos editáveis.

## Arquitetura (frontend)

Dados já expostos por serviços existentes — nenhum endpoint novo:

- `getSpecialists()` → `Specialist[]` com `commission_rate`
- `getCompanies()` → `Company[]` com `commission_rate` (`platform_commission_rate` ignorado aqui)
- `getPlatformCompany()` → informativo apenas (não usado no split)
- `getCars()` / `getBoats()` / `getAircrafts()` → `valor` (busca opcional de produto)

### Componentes

1. **`frontend/src/lib/commission-split.ts`** — função pura portada do backend.
   Copia de `computeNestedCommissionSplit` (~8 linhas) + tipos. Comentário `ponytail:`
   apontando `backend/src/features/contracts/commission-split.ts` como fonte de verdade
   ("manter em sync"). Acompanha teste (`commission-split.test.ts`) que trava os mesmos
   números do `commission-split.spec.ts` do backend.

2. **`frontend/src/components/commission/CommissionSplitResult.tsx`** — apresentacional.
   Recebe o `breakdown` pronto (`{ bolo, specialistValue, officeValue, platformValue }`)
   + `saleValue` e renderiza uma tabela estilo planilha: Bolo → Especialista → Restante →
   Escritório → **Plataforma (linha-âncora destacada)**. Cada linha mostra valor R$ e taxa
   efetiva sobre a venda (%). Prop `compact` reduz densidade para o card do dashboard.
   Zero cálculo além da taxa efetiva (`valor / venda × 100`).

3. **`frontend/src/pages/admin/CommissionCalculatorPage.tsx`** — página completa.
   Layout duas colunas: inputs à esquerda, `CommissionSplitResult` sticky à direita.
   Estado local dos 4 drivers; selects de especialista/escritório e busca de produto
   só chamam os setters dos campos. Reusa componentes de UI já existentes do projeto
   (`Card`, `Input`, selects) — segue o padrão do `DashboardPage`/`CommissionsPage`,
   NÃO importa HeroUI (o locpay é referência de UX, não de stack).

4. **`frontend/src/components/commission/CommissionMiniCalculator.tsx`** — card do dashboard.
   Inputs mínimos (valor de venda + comissão total % + especialista) → `CommissionSplitResult`
   em modo `compact` + link "Abrir calculadora completa" → `/admin/calculator`.

### Navegação e rotas

- **Sidebar** (`frontend/src/layouts/Sidebar.tsx`): adicionar item "Calculadora"
  (`/admin/calculator`) ao bloco ADMIN (linhas ~126-168). Ícone: `Calculator` (lucide).
- **Rotas** (`frontend/src/routes/routes.tsx`): nova rota
  `<ProtectedRoute allowedRoles={["ADMIN"]}>` → `CommissionCalculatorPage`.
- **Dashboard** (`frontend/src/pages/admin/DashboardPage.tsx`): encaixar
  `CommissionMiniCalculator` no grid `lg:grid-cols-2` (~linha 176), como card no
  mesmo padrão do card "Comissão por processo".

### Remoção de "Meus Assessorados"

- `Sidebar.tsx:196-202`: deletar o bloco `if (user.role !== "OFFICE") { links.push(...) }`
  que empurra o item "Meus Assessorados" para todos os papéis. Some da navegação de
  **todos** os papéis.
- **Manter intactos:** a rota `/advisor/dashboard`, `AdvisorDashboardPage.tsx`,
  a rota `/advisor/accept` e `advisor.service.ts` — o fluxo de convite/aceite do assessor
  continua funcionando; só o item de menu sai.

## Busca de produto (opcional, cortável)

Dropdown de categoria (Carro/Barco/Aeronave) + select buscável que lazy-carrega a lista
daquela categoria via o service correspondente; selecionar preenche o valor de venda.
É conveniência pura — o valor sempre pode ser digitado à mão. **Se o tempo apertar,
esta é a parte a cortar** (v1 pode entregar só valor manual).

## Testes / verificação

- `commission-split.test.ts` (frontend): assert que a função portada devolve os mesmos
  valores do caso canônico do `commission-split.spec.ts` do backend (mesma soma exata,
  plataforma como resíduo).
- Verificação final: `cd frontend && npm run lint && npm run build`.
- QA visual: frontend isolado + Playwright mockando a API (sem subir o backend nesta máquina).

## Fora de escopo

- Persistir/salvar simulações (locpay salva; aqui não pedido — YAGNI).
- Qualquer mudança no cálculo real do contrato ou no backend.
- Expor taxa de plataforma como driver (confirmado: plataforma é resíduo).
