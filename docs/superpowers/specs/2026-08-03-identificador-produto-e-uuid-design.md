# Identificador de produto no import + PK de produtos em UUID

**Data:** 2026-08-03
**Status:** Aprovado para planejamento
**Autor:** Messias-Olivindo (com Claude)

## Problema

O cliente pediu que um especialista possa cadastrar **mais de um produto do mesmo
tipo** — ex.: duas "Ferrari X" que são carros fisicamente diferentes, cada um com
seu identificador, informados via CSV/XLSX de import.

Hoje isso **não funciona**. O import (assíncrono em `ProductImportJobsService` e
síncrono em `cars/boats/aircrafts.service`) deduplica produtos pela chave
`(marca, modelo, specialist_id)`. Duas linhas "Ferrari / X" do mesmo especialista
colapsam: a segunda linha faz **UPDATE** da primeira em vez de criar um segundo
registro. Resultado: sobra 1 carro só, com os dados da última linha sobrescrevendo
a primeira. Não existe nenhuma coluna de identificador nos templates nem campo
identificador em `Car`/`Boat`/`Aircraft`.

Além disso, o import é **full-sync**: `deactivateMissingProducts` desativa
(`is_active=false`) todo produto ativo do especialista que não apareça no arquivo.
Ou seja, o CSV é tratado como a verdade completa do estoque.

Aproveitando a mudança, migrar a PK dos produtos de `Int autoincrement` para
`UUID` (IDs incrementais são enumeráveis/inseguros; já existe
`// TODO: converter ... para UUID` em `Product` no schema).

## Decisões (do brainstorming)

- **Identificador obrigatório.** Toda linha do import precisa de `identificador`.
  Linha sem identificador → erro de validação (não cria). Isso elimina o caso
  "sem id" e, com ele, o churn de re-upload.
- **Full-sync mantido.** Com uma chave estável (identificador), o full-sync fica
  saudável: re-upload casa por identificador → update; ausência real → desativa.
- **Escopo: os 3 tipos** (carro, barco, aeronave) — o sistema de import trata os
  três igual; manter simétrico evita comportamento divergente por tipo.
- **UUID nos 3 produtos.** Banco é de **dev/demo** → wipe autorizado, sem migração
  de dados de produto. Perda de processos/imagens ligados é aceitável.
- **Entrega: um spec, três fases** (A → B → C).
- **Identificador inicial no CSV exportado:** código gerado legível
  `MARCA-MODELO-seq` (ex.: `FERRARI-X-1`, `FERRARI-X-2`).

## Design

### Fase A — Identificador de produto (chave natural)

**Schema** (`backend/prisma/schema.prisma`), em `Car`, `Boat`, `Aircraft`:

```prisma
identificador String
// ...
@@unique([specialist_id, identificador])
```

O `@@unique` garante que um especialista não tenha dois produtos com o mesmo
identificador e transforma o dedup em uma consulta determinística.

**Templates de import** (colunas em `ProductImportJobsService`
`carColumns`/`boatColumns`/`aircraftColumns`): adicionar
`{ name: 'identificador', required: true, type: 'string' }`. O template gerado
para download (`getCsvTemplate` / `xlsxImportService.generateTemplate`) passa a
incluir a coluna.

**Dedup — mudar a chave em todos os pontos de upsert.** A chave passa de
`(marca, modelo, specialist_id)` para `(specialist_id, identificador)`. Pontos
identificados (9):

- `product-import-jobs.service.ts` → `upsertProductFromRow`: 3 ramos (car/boat/aircraft).
- `cars.service.ts` → `importFromCsv` (linha ~442) e `importFromXlsx` (~556).
- `boats.service.ts` → `importFromCsv` (~478) e `importFromXlsx` (~596).
- `aircrafts.service.ts` → `importFromCsv` (~513) e `importFromXlsx` (~645).

> **Atenção (dívida a resolver na fase):** a mesma lógica de dedup+upsert está
> copiada nesses 9 lugares. Mudar a chave em 9 pontos à mão é frágil. Avaliar
> extrair um helper único de "encontra-ou-cria produto por identificador" que os
> caminhos síncrono e assíncrono compartilhem. Se a extração for grande demais
> para esta fase, no mínimo padronizar a chave e cobrir com teste.

**Validação:** `identificador` obrigatório na definição de coluna já faz
`validateStructure` rejeitar arquivo sem a coluna. Linha com a coluna presente mas
valor vazio → tratar como erro de linha (não cria, entra em `errorRows`).

**Comportamento resultante:**
- Ferrari X `FERRARI-X-1` e Ferrari X `FERRARI-X-2` → 2 registros distintos.
- Re-upload do mesmo arquivo → casa por identificador → UPDATE, nada duplica.
- Produto que sai do CSV → full-sync desativa (comportamento atual preservado).

### Fase B — PK de produtos `Int` → `UUID`

Independente de A. Sem migração de dados (wipe na fase C).

**Schema:** em `Car`, `Boat`, `Aircraft`:
`id  String  @id @default(uuid()) @db.Uuid` (era `Int @default(autoincrement())`).

**FKs para atualizar** (`Int?` → `String? @db.Uuid`):
- `Car_image.car_id`, `Boat_image.boat_id`, `Aircraft_image.aircraft_id`.
- `Process.car_id`, `Process.boat_id`, `Process.aircraft_id`.
- `Product.car_id`, `Product.boat_id`, `Product.aircraft_id` (camada de abstração;
  remover o TODO do schema).

**Backend — remover suposição de id numérico:**
- `processes/dto/create-process.dto.ts` e `assign-product.dto.ts`: `@IsInt` no
  `product_id` → `@IsString`/`@IsUUID`.
- `processes.service.ts`: remover `Number(createProcessDto.product_id)` (linhas
  ~214, 274, 278, 282).
- Controllers de car/boat/aircraft: `ParseIntPipe` em params de id → sem pipe
  (id string).

**Frontend — ~23 pontos** que assumem id numérico (rotas `/catalog/...`,
`Number(id)`/`parseInt`, tipos de props) em `pages/catalog`, `pages/customer`,
`services`. Trocar para string. Levantar a lista exata no plano de implementação.

### Fase C — Wipe + CSV de re-import

1. **Script de export (roda ANTES do wipe).** Script Prisma em
   `backend/prisma/` (ou `scripts/`) que lê `Car`/`Boat`/`Aircraft` atuais e gera
   um CSV por tipo no formato novo (com coluna `identificador` preenchida como
   `MARCA-MODELO-seq`, sequência por especialista+marca+modelo). **O usuário roda**
   no ambiente dele — Claude não conecta no banco.
2. **Wipe.** Migration/script que apaga produtos e dependências (imagens,
   processos órfãos). Perda autorizada (banco dev).
3. **Re-import.** Usuário sobe os CSVs gerados pela própria plataforma → produtos
   recriados já com UUID e identificador.

## Fora de escopo

- Comissão/wallet de consultor (regra de negócio: consultor não recebe comissão).
- Qualquer mudança no full-sync além da troca de chave.
- Backfill preservando processos/contratos antigos (explicitamente descartado —
  banco é dev).

## Riscos

- **Banco Supabase tem drift de schema vs migrations.** As mudanças de schema
  (identificador + UUID) precisam ir por `prisma db push` no ambiente dev, com
  verificação — não `migrate deploy` cego. Confirmar antes de aplicar.
- **UUID toca frontend (~23 pontos).** Levantar a lista exata no plano; risco de
  esquecer um parse numérico e quebrar rota de catálogo.
- **9 pontos de dedup.** Se não centralizar, alto risco de deixar um com a chave
  antiga. Teste cobrindo "dois produtos mesmo marca/modelo, identificadores
  diferentes → 2 registros" é obrigatório.

## Critérios de aceitação

1. Import com 2 linhas mesma marca/modelo e identificadores diferentes → 2 produtos ativos.
2. Re-upload do mesmo arquivo → 0 novos, N atualizados, 0 duplicados.
3. Linha sem identificador → erro na linha, produto não criado.
4. Produto removido do CSV → desativado pelo full-sync.
5. IDs de `Car`/`Boat`/`Aircraft` são UUID; catálogo e fluxo de processo funcionam
   ponta a ponta com id string.
6. Script de export gera CSV re-importável pela plataforma sem erro de estrutura.
