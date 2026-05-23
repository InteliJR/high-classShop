# ADR-0003: Migrar PKs `Car`, `Boat`, `Aircraft` e dependentes para UUID

**Data:** 2026-05-18
**Autor:** @Messias-Olivindo (Messias Olivindo)
**Status:** Proposto

## Contexto

O schema Prisma (`backend/prisma/schema.prisma`) tem 9 tabelas com PK `Int @autoincrement()` e FKs `Int?` referenciando-as:

- PKs Int: `Car`, `Boat`, `Aircraft`, `Car_image`, `Boat_image`, `Aircraft_image`, `Car_interest`, `Boat_interest`, `Aircraft_interest`
- FKs Int dependentes: `Process.car_id/boat_id/aircraft_id`, `Product.car_id/boat_id/aircraft_id`, `Appointment.product_id`, `ProductImportJobItem.product_id`, `<X>_image.<x>_id`

O resto do sistema já usa UUID (`User`, `Process`, `Contract`, `Appointment.id`, etc). A inconsistência:

- Quebra a expectativa de tipo no frontend (`id: string` no Zustand, `useParams<{id: string}>()`, mas axios às vezes envia `number`).
- Impede URLs/IDs estáveis entre ambientes (autoincrement reseta com restore de banco).
- Vaza ordem/contagem de produtos para qualquer pessoa que consiga ler um ID (`/catalog/cars/42` revela aproximadamente 42 carros).
- Existe TODO antigo no próprio schema sugerindo a migração.

A migração foi avaliada como **fora do escopo** da sprint deadline 29/05 (ver `ai/_private/plan/2026-05-18-deadline-29.md` seção "Itens fora do escopo"). Este ADR captura a decisão e o cronograma proposto.

## Alternativas avaliadas

### Opção A — Manter Int autoincrement
- Prós: zero trabalho.
- Contras: dívida técnica continua, inconsistência com o resto do schema, vazamento de cardinalidade.

### Opção B — Migrar tudo para UUIDv4 (`gen_random_uuid()` no Postgres + `@default(uuid())` no Prisma)
- Prós: padrão universal, suportado nativamente pelo Postgres e Prisma, alinha com o resto do schema.
- Contras: UUIDv4 é random, prejudica locality de índices B-tree (inserts dispersos no índice).

### Opção C — Migrar para UUIDv7 (timestamp-ordered)
- Prós: ordenável por tempo, índices mais felizes, padrão emergente (RFC 9562).
- Contras: Postgres ainda não tem `gen_random_uuidv7()` builtin (até 2026); precisa de extensão ou geração no app. Mais complexidade.

### Opção D — Migrar para CUID/CUID2
- Prós: ordenável, mais curto, colision-resistant.
- Contras: dependência adicional, foge do padrão do resto do schema (que usa UUIDv4).

## Decisão

**Opção B — Migrar para UUIDv4 (`@default(uuid()) @db.Uuid`)** com estratégia **dual-column** (adicionar coluna UUID, popular, swap, drop Int) executada na janela 08–19/06/2026, conforme `ai/_private/plan/2026-06-pos-deadline-uuid-migration.md`.

**Não escolhemos UUIDv7** porque:
- Postgres builtin para v7 só ficou disponível em versões muito recentes (Postgres 17+) e nem sempre o Supabase está nessa versão.
- O ganho de locality é relevante em escala (milhões de rows). Em nosso volume (centenas/milhares por tabela), não justifica a complexidade extra.
- Decisão pode ser revisitada via ADR posterior (substituir este por ADR-XXXX) se o volume crescer.

## Consequências

### Positivas
- Schema 100% consistente (todas as PKs UUID).
- Frontend e backend conversam só em `string` para IDs.
- Permite restore parcial / merge de bancos sem conflito de PK.
- IDs não vazam cardinalidade.

### Negativas / Riscos
- Migration custom (não `prisma migrate dev`) para evitar drift no Supabase prod (CLAUDE.md alerta).
- Janela de manutenção de ~1h em prod com app fora do ar.
- Possibilidade de bug sutil em código que faz `parseInt(id)` em handler oculto. Mitigação: TASK U1.7 e U2.1 do plano UUID.
- UUIDv4 é random — pequeno hit de performance em índices B-tree. Aceito dado o volume atual.

### Tarefas afetadas
- Plano inteiro `ai/_private/plan/2026-06-pos-deadline-uuid-migration.md` — Sprint U1 (08–12/06) backend + Sprint U2 (15–19/06) frontend e deploy.
- TASK U1.1: criar este ADR (concluída ao escrever este arquivo, status passa de `Proposto` → `Aceito` quando o plano for aprovado pelo cliente).

## Referências
- Plano detalhado: `ai/_private/plan/2026-06-pos-deadline-uuid-migration.md`
- Plano corrente que adia esta decisão: `ai/_private/plan/2026-05-18-deadline-29.md` (seção "Itens fora do escopo")
- Schema com TODO: `backend/prisma/schema.prisma` (notas finais)
- CLAUDE.md alerta sobre schema drift em Supabase prod
