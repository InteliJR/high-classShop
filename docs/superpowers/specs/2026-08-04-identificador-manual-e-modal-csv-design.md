# Identificador no formulário manual e no modal de import CSV

**Data:** 2026-08-04
**Status:** Aprovado para planejamento
**Autor:** Messias-Olivindo (com Claude)

## Problema

O spec anterior ([2026-08-03-identificador-produto-e-uuid-design.md](2026-08-03-identificador-produto-e-uuid-design.md))
introduziu o campo `identificador` (string única por especialista, chave de
dedup) **só no fluxo de import CSV/XLSX**. O formulário manual de criação de
produto e o modal que explica a estrutura do CSV nunca entraram no escopo
daquele spec — não foi bug de implementação, é lacuna do spec original.

Isso quebrou duas coisas hoje:

1. **Criação manual está impossível.** `CreateCarDto`/`CreateBoatDto`/
   `CreateAircraftDto` exigem `identificador` (`@IsString()`, sem
   `@IsOptional()`), e o `ValidationPipe` global (`main.ts:60`) valida toda
   requisição. `ProductForm.tsx` nunca coleta nem envia esse campo — toda
   tentativa de criar um produto pela tela (não via CSV) recebe 400.
2. **O modal de import mostra informação errada.** `XlsxImporter.tsx:53-95`
   mantém uma cópia própria, hardcoded, das colunas obrigatórias/opcionais —
   `identificador` não aparece em nenhuma das duas listas, para nenhum dos 3
   tipos de produto. O texto de dica (`XlsxImporter.tsx:338-342`) afirma que
   "produtos com mesma marca + modelo serão atualizados ao invés de
   duplicados" — isso descreve o comportamento **anterior** ao spec de
   2026-08-03; hoje o dedup é por `identificador`, e marca+modelo são só
   dados descritivos.

## Decisões (do brainstorming)

- **`identificador` no formulário manual é digitado pelo especialista**, campo
  de texto livre — mesmo padrão de preenchimento do CSV, sem geração
  automática. Consistência entre os dois fluxos de criação.
- **Validação de unicidade só no submit.** Sem endpoint novo de checagem em
  tempo real — o `PrismaExceptionFilter` já trata `P2002` globalmente
  (`prisma-exception.filter.ts:60`) e devolve 409 com mensagem amigável; o
  form só precisa exibir esse erro como já faz para outros campos únicos
  (ex.: `identification_number`).
- **Fix pontual, não fonte única compartilhada.** `XlsxImporter.tsx` mantém
  sua própria cópia hardcoded das colunas (já duplicada do backend hoje) —
  só corrigi-la para bater com a realidade atual. Unificar backend+frontend
  numa fonte única de verdade é melhoria futura, não necessária para resolver
  o bug relatado (o próprio spec anterior já registrou duplicação equivalente
  no backend como "dívida a resolver depois", não bloqueante).
- **Sem testes de componente novos.** Não existe infraestrutura de teste de
  componente React neste frontend (só testes de função pura em `lib/*.test.ts`
  via vitest). Criar essa infraestrutura do zero para cobrir um input de
  formulário é desproporcional ao tamanho do bug. Verificação é manual (ver
  Critérios de aceitação).

## Design

### 1. Formulário manual — `frontend/src/components/specialist/CommonProductFields.tsx`

Campo compartilhado pelos 3 tipos de produto (carro/barco/aeronave), no mesmo
padrão `react-hook-form` já usado por `marca`/`modelo` (linhas 37-65):

- Novo `<input id="identificador" {...register("identificador", { required: "Identificador é obrigatório" })} />`
  com label "Identificador" e placeholder de exemplo (ex.: `"Ex: BMW-X5-1"`).
- Renderizar logo após o campo `modelo`, antes de `ano`.
- Exibir erro de validação client-side igual aos campos vizinhos
  (`errors.identificador && <span>...`).

### 2. Payload — `frontend/src/pages/specialist/ProductFormPage.tsx` ou `frontend/src/components/specialist/ProductForm.tsx`

Em `formattedData` (`ProductForm.tsx:205-207`, onde `marca`/`modelo` já são
copiados de `data`), adicionar `formattedData.identificador = data.identificador`.
Vale para os 3 ramos (`CAR`/`BOAT`/`AIRCRAFT`) — o campo é comum, então entra
uma vez só, junto com `marca`/`modelo`, não dentro dos `if` por tipo.

### 3. Modal de import — `frontend/src/components/shared/XlsxImporter.tsx`

- `COLUMN_DEFINITIONS` (linhas 53-95): adicionar `"identificador"` no array
  `required` de `CAR`, `BOAT` e `AIRCRAFT`.
- Texto de dica (linhas 338-342): substituir a afirmação de dedup por
  marca+modelo por uma frase correta — dedup é por `identificador` (único por
  especialista); marca+modelo são só descritivos e podem se repetir entre
  produtos diferentes.

### Fluxo de erro (sem mudança de backend)

- Requisição sem `identificador` → `ValidationPipe` global rejeita com 400
  antes de chegar no service (comportamento já existente, hoje inatingível
  pela UI porque o campo nunca era enviado).
- `identificador` duplicado para o mesmo especialista → `P2002` →
  `PrismaExceptionFilter` → 409 "Já existe um registro com specialist_id,
  identificador informado(s)" (ordem dos campos segue a declaração
  `@@unique([specialist_id, identificador])` no schema). O formulário precisa
  capturar e exibir essa mensagem de erro (mesmo tratamento de erro genérico
  que outros campos únicos já usam no componente).

## Fora de escopo

- Fonte única de colunas compartilhada entre backend e frontend (Abordagem
  B/C consideradas e descartadas por desproporcionais ao bug — ver Decisões).
- Geração automática/sugestão de `identificador` no formulário manual.
- Checagem de unicidade em tempo real (endpoint novo).
- Qualquer mudança no comportamento de dedup do import CSV (já correto desde
  o spec de 2026-08-03; aqui só a *comunicação* sobre ele está sendo
  corrigida).
- Melhorar a mensagem de erro do `PrismaExceptionFilter` para P2002 (hoje
  mostra nomes de campos técnicos tipo `specialist_id, identificador`) — não
  bloqueia a funcionalidade, fica como possível polish futuro.

## Riscos

- **Campos por tipo de produto podem ter nomes de placeholder diferentes.**
  `CommonProductFields.tsx` já usa `placeholders.marca[productType]` /
  `placeholders.modelo[productType]` por tipo — confirmar no plano se
  `identificador` precisa de exemplo específico por tipo (carro vs. barco vs.
  aeronave) ou se um placeholder genérico serve.
- **Edição de produto existente.** O formulário também é usado em modo
  "editar" (`mode="create" | "edit"` mencionado em `ProductForm.tsx:191`).
  Produtos criados antes desta mudança (se houver) não têm `identificador`
  no banco atual — como o banco é dev/demo e foi recém resetado (ver
  contexto da conversa), não há dado legado a migrar, mas o plano deve
  confirmar que o modo edição também envia/exibe `identificador` do produto
  carregado.

## Critérios de aceitação

1. Criar um carro/barco/aeronave pelo formulário manual, preenchendo
   `identificador`, salva com sucesso (sem 400).
2. Tentar criar um segundo produto do mesmo especialista com o mesmo
   `identificador` mostra mensagem de erro amigável na tela (não crasha, não
   mostra erro técnico cru).
3. Modal de import CSV mostra `identificador` na lista de colunas
   obrigatórias, para os 3 tipos de produto.
4. Texto de dica do modal não afirma mais que dedup é por marca+modelo;
   descreve corretamente o dedup por `identificador`.
