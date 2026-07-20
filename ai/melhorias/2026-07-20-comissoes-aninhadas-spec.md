# Spec — Comissões aninhadas + melhorias (dashboard, consultor, exports)

- **Origem:** anotações da reunião de recap com o cliente ([`comissoes-especialistas.md`](./comissoes-especialistas.md), 2026-07-04).
- **Validado em:** 2026-07-20 (brainstorming ponto a ponto).
- **Status:** requisitos fechados; decisões de implementação marcadas pra fase de plano.

## 1. Contexto e objetivo

A reunião definiu como deve funcionar o fluxo de comissão da plataforma. O código
de hoje usa um modelo **diferente** do acordado — percentuais independentes sobre a
venda, com o especialista recebendo o resíduo. Este spec descreve o modelo acordado
(**aninhado**) e as demais melhorias das anotações, pra servir de base do plano de
implementação.

## 2. Modelo de comissão (núcleo)

### Regras

- Comissão em **percentual**, definida **por processo**.
- Fluxo em 3 passos:
  1. Na venda, o especialista define a **comissão total** = % do valor do produto → isso vira o **"bolo"**.
  2. O **especialista** leva uma **fatia % do bolo** (valor cadastrado por especialista).
  3. O **restante do bolo** é dividido entre **escritório** e **plataforma**; escritório% e
     plataforma% são percentuais **do restante** e somam **100% entre si**.
- As três fatias somam **exatamente 100% do bolo**.
- O **escritório é do consultor** (quem intermedia o cliente). **Sem escritório**, o
  restante vai **100% pra plataforma** → a comissão fica só entre **especialista + plataforma**.
- O **consultor é pago de dentro da fatia do escritório** (repasse interno do escritório
  pro consultor; **não** entra no split da plataforma).

### Fórmula

Dados: valor da venda `V`, comissão total `C%`, fatia do especialista `Fe%`, fatia do
escritório `Fesc%` (sobre o restante).

```
bolo        = V * C / 100
especialista= bolo * Fe / 100
restante    = bolo - especialista
escritorio  = restante * Fesc / 100          (0 se não houver escritório)
plataforma  = restante - escritorio          (derivada → nunca passa de 100%)
```

### Exemplo

`V = R$ 100.000`, `C = 10%`, `Fe = 70%`, `Fesc = 40%`:

| Parte        | Cálculo              | Valor      |
|--------------|----------------------|------------|
| Especialista | 70% do bolo          | R$ 7.000   |
| Restante     | 30% do bolo          | R$ 3.000   |
| Escritório   | 40% do restante      | R$ 1.200   |
| Plataforma   | 60% do restante      | R$ 1.800   |
| **Total**    | **100% do bolo**     | R$ 10.000  |

## 3. Papéis, cadastros e permissões

- **3 cadastros de fatia** (item 8): por especialista, por escritório, e da plataforma
  (default global + override por escritório — este último já existe no código).
- Todas as fatias são **editáveis só pelo ADMIN**, a qualquer momento ("editável a
  qualquer momento" = valor não é congelado, não que o dono da fatia se autoedita).
- Na venda, o especialista digita **apenas a comissão total** — é o único campo editável
  no processo; as fatias vêm do cadastro.
- Validação: comissão total ≤ 100%; escritório + plataforma somam 100% do restante
  (garantido ao derivar a plataforma).

## 4. Produto do processo pós-consultoria (item 1)

Após a **reunião de consultoria** (cliente/consultor conversa com o especialista), o
**especialista define qual produto o processo vai seguir**. O produto do processo não é
fixo no início — é decidido pós-reunião. Amarra no fluxo `meetings`/`appointments` →
`processes`.

## 5. Telas e relatórios (itens 2, 7 + base analítica)

- **Aba de comissões**: mostra o valor de cada escritório **por processo**.
- **"Escadinha"**: visão em degraus do repasse de um processo (especialista → restante →
  escritório/plataforma).
- **Base analítica** estilo planilha, com todos os processos, **filtrada por papel**:
  especialista vê só o dele, escritório só o dele, ADMIN vê tudo.
- **Export CSV e PDF** (comissões e informações da plataforma).

## 6. Demais melhorias (itens 3, 5, 6, 9)

- **3.** Convite em lote **dentro da aba de consultor**.
- **5.** **Dashboard do ADMIN**: visão consolidada (clientes, produtos, processos,
  consultores) + acesso aos produtos.
- **6.** **Aba de escritório** mostra os clientes ligados a cada consultor.
- **9.** Especialista **sempre CNPJ** (já implementado).

## 7. Impacto técnico / decisões pra fase de plano

- **Reamarrar o escritório ao consultor** *(a verificar no código)*: hoje o
  `contracts.service.ts` resolve as taxas de escritório/plataforma a partir da company
  do **especialista**; o escritório é do **consultor**. Precisa ser reamarrado.
- **Trocar o modelo de cálculo**: hoje escritório/plataforma são % **da venda** e o
  especialista é o resíduo (`resolveCommissionFromTotal` / `calculateCommissionSplit`).
  Passa a ser **aninhado** (% do bolo / % do restante). O snapshot no `Contract` precisa
  dos novos campos (fatia do especialista %, fatia do escritório % do restante).
- **Derivar a plataforma** do restante (guardar só a fatia do escritório) pra tornar
  impossível passar de 100% por construção — abordagem sugerida.
- **Sem escritório** → restante 100% plataforma.

## 8. Fora de escopo / a decidir depois

- Forma exata de armazenamento (um campo derivado vs. dois validados).
- Layouts das telas (escadinha, dashboard, base analítica).
- Migração de dados dos contratos já existentes (se aplicável).
