# Calculadora de comissão (ADMIN) — design

Data: 2026-07-24

## Objetivo

Dar ao ADMIN uma ferramenta de simulação: escolher um escritório e um especialista (de forma independente), informar um valor de venda hipotético e uma % de comissão total, e ver instantaneamente como a comissão se divide entre especialista, escritório e plataforma — sem que isso dependa de uma venda real.

## Onde vive

Nova 3ª aba **"Calculadora"** dentro da página já existente `/admin/commissions` (`frontend/src/pages/admin/CommissionsPage.tsx`), ao lado de "Configurar taxas" e "Por venda".

**Sidebar**: nenhuma mudança necessária. `/admin/commissions` já está no menu ADMIN (`frontend/src/layouts/Sidebar.tsx:142-146`, label "Comissões", ícone `Percent`). Como a calculadora é uma aba dentro dessa mesma página, ela já fica acessível pelo link existente — adicionar uma segunda entrada de sidebar apontando pro mesmo lugar seria redundante.

## O que já existe e será reaproveitado

- **Modelo de dados** (sem alteração): `Company.commission_rate` (taxa do escritório), `User.commission_rate` (taxa do especialista, role `SPECIALIST`). Ambos já são eixos independentes no modelo real — o "escritório da venda" e o "especialista" nunca foram acoplados um ao outro.
- **Fórmula de split**: `computeNestedCommissionSplit()` em `backend/src/features/contracts/commission-split.ts`, já testada (`commission-split.spec.ts`). `bolo = venda × total%`; `especialista = bolo × fatiaEspecialista%`; `restante = bolo − especialista`; `escritório = restante × fatiaEscritório%`; `plataforma = restante − escritório`.
- **Listas já carregadas**: `CommissionsPage` já busca `getCompanies()` e `getSpecialists()` pra aba "Configurar taxas" — a calculadora reaproveita esse mesmo estado, sem novo fetch de listas.
- **Componente visual**: `SplitBar` (função local, não exportada, dentro de `CommissionsPage.tsx`, usada hoje em "Por venda") é reaproveitado tal qual para desenhar as barras do resultado — mesmas cores, mesma terminologia ("Comissão total", "Especialista", "Escritório", "Plataforma", "restante"). Sem usar a palavra "bolo" em nenhum texto de UI (convenção que a tela já segue hoje).

## O que é novo

### Backend

- `GET /commissions/simulate` em `backend/src/features/commissions/` (mesmo módulo do já existente `GET /commissions/sales`, `@Roles(ADMIN)`).
- Novo DTO `GetSimulateCommissionDto` (query params): `companyId?` (uuid), `specialistId?` (uuid), `saleValue` (number, `@Min(0)`), `totalCommissionRate` (number, `@Min(0)` `@Max(100)`) — coerção numérica via `@Type(() => Number)`, no mesmo padrão de `get-processes-filter.dto.ts`.
- Novo método `CommissionsService.simulate(dto)`: busca `Company`/`User` pelos ids opcionais (ausente ou inexistente → taxa 0, sem erro — não é fronteira de confiança, os ids vêm de dropdowns já populados pelo próprio ADMIN autenticado), chama `computeNestedCommissionSplit` (import direto de `../contracts/commission-split`, mesmo padrão de import que `contracts.service.ts` já usa) e retorna:
  ```ts
  { totalCommission, totalCommissionRate, specialistValue, officeValue, platformValue, restante }
  ```
  Não retorna nome de escritório/especialista — o frontend já tem esses nomes no `company`/`specialist` selecionado localmente (do mesmo array `companies`/`specialists` que preenche os dropdowns), então o label da barra (`Escritório (Nome)`) é montado no cliente, sem round-trip.
- Sem tabela nova, sem persistência — puro cálculo a cada chamada.

### Frontend

- `simulateCommission(params)` em `frontend/src/services/commissions.service.ts` — GET com query params, mesmo padrão de `getSalesCommissions()`.
- Aba "Calculadora" em `CommissionsPage.tsx` (ícone `Calculator` do `lucide-react`):
  - Dropdown Escritório (opções: lista de `companies` + "Nenhum").
  - Dropdown Especialista (opções: lista de `specialists` + "Nenhum").
  - Input Valor da venda (R$).
  - Input % Comissão total.
  - Debounce nativo (`setTimeout`/cleanup, sem lib) de ~250ms após qualquer mudança, chamando `simulateCommission()`.
  - Resultado renderizado com `SplitBar` (3 barras: Especialista, Escritório — só se houver escritório selecionado —, Plataforma), igual ao layout de `SaleCard` na aba "Por venda", sem o cabeçalho de produto/cliente (que não existe aqui).
- Sem botão salvar, sem histórico — ferramenta "e se" efêmera, estado perdido ao trocar de aba ou recarregar (nada disso foi pedido).

## Erros / edge cases

- Valor da venda ou % vazios/inválidos → mostra resultado zerado, sem chamar a API.
- Nenhum escritório selecionado → barra "Escritório" some, tudo cai em Plataforma (mesmo comportamento de uma venda real sem escritório, já existente em "Por venda").
- `companyId`/`specialistId` que não existem mais (ex.: registro apagado entre o carregamento da lista e a chamada) → tratado como taxa 0, sem erro 404 — evita complexidade desnecessária numa ferramenta interna de simulação.

## Teste

Nenhum teste novo necessário: a única lógica não trivial (`computeNestedCommissionSplit`) já tem cobertura em `commission-split.spec.ts`; o novo `simulate()` é só busca de taxas + repasse pra função já testada, sem branch de negócio próprio.

## Fora de escopo (YAGNI)

- Múltiplas linhas de simulação lado a lado (grade estilo planilha completa) — o usuário confirmou que uma simulação única com atualização ao vivo já cobre a necessidade.
- Persistência/histórico de simulações.
- Novo endpoint/setting para "% padrão sugerida" — o campo de % de comissão total começa vazio/zero, igual ao fluxo real onde é o especialista quem informa esse valor.
