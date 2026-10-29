# Evidências da issue #248 — preços dos produtos

## Escopo alinhado

- Preservar o campo numérico atual, a magnitude e a moeda original BRL/USD.
- Cobrir carros, embarcações e aeronaves na lista, no detalhe e no formulário.
- Mostrar “Não informado” para preço ausente/inválido, sem convertê-lo silenciosamente em zero ao editar.
- Conferir registros existentes somente em leitura. Qualquer reparo de dados exige diagnóstico separado do erro de exibição.

## Causa e correção

As listagens já convertiam `Prisma.Decimal` em número; os detalhes dos três tipos retornavam o Decimal diretamente, serializado como string. `ProductDetails` apagava todos os pontos das strings antes de convertê-las em número.

O defeito não depende do limite de um milhão. A string explícita `1500000.00` era interpretada como `150000000`. No backend atual, o Prisma serializa esse inteiro como `"1500000"`, mas valores com centavos não zero mantêm o ponto e reproduzem o defeito de ponta a ponta: `1500000.50` é serializado como `"1500000.5"` e era interpretado como `15000005`.

A correção padroniza o retorno do detalhe como número, assim como a lista, e usa o formatador monetário comum no detalhe. O frontend também aceita strings decimais canônicas, sem remover pontos ou tentar interpretar texto monetário localizado. Os tipos passam a representar números e strings da API. Valores ausentes, vazios, não finitos e entradas incompatíveis retornam “Não informado”.

O formulário normaliza o preço recebido e valida o valor antes de montar o payload. Campos inválidos permanecem vazios e exigem preenchimento; não viram zero. A moeda original e a trava de alteração monetária durante negociação são preservadas.

Na revisão final, foi corrigida uma restrição introduzida pela validação: o campo numérico continua aceitando entradas válidas como `1e6` e `.5`, assim como antes da task. O parser aceita notação decimal exponencial sem interpretar separadores de milhares ou textos monetários localizados. Os testes novos reproduziram a rejeição antes do ajuste e verificam o envio dos valores numéricos corretos.

## Auditoria somente leitura

Executada em **25/10/2026 às 19:18:39 UTC**, no banco remoto configurado por `backend/.env`, usando `DIRECT_URL`. A configuração local informa `NODE_ENV=production`; isso não identifica, por si só, o banco usado pelo deploy publicado.

O script `backend/scripts/audit-product-prices-248.ts` usa transação `READ ONLY`, verificada no PostgreSQL, com isolamento de snapshot e timeouts. A consulta lê apenas tipo, ID, valor exato e moeda, sem acessar dados pessoais. Foram conferidos **157 registros**, sem truncamento:

| Tipo | BRL | USD |
| --- | ---: | ---: |
| Carro | 13 | 0 |
| Embarcação | 134 | 1 |
| Aeronave | 5 | 4 |

Não foram encontrados valores não positivos, moedas incompatíveis, valores com mais de duas casas decimais significativas ou perda de precisão na conversão para `number` entre os registros inspecionados.

Três registros apresentam divergência entre o valor armazenado e a leitura do detalhe antigo:

| Tipo / ID | Valor armazenado (BRL) | Valor interpretado pelo detalhe antigo |
| --- | ---: | ---: |
| BOAT / `408a01d4-ed8f-4881-9eed-107700b7b698` | 829999.99 | 82999999 |
| BOAT / `6bf264a9-d1df-4640-8132-65f913a984c9` | 4799999.99 | 479999999 |
| BOAT / `b2d41174-d468-47a3-99af-d483684cb46b` | 468999.96 | 46899996 |

Esses achados demonstram erro de exibição. Não provam que o preço persistido diverge do valor desejado pelo responsável. Preços altos, isoladamente, não justificam reparo. **Nenhum registro foi alterado.**

Para repetir a auditoria, a partir de `backend`:

```bash
./node_modules/.bin/ts-node scripts/audit-product-prices-248.ts --limit=2000
```

O script prioriza `AUDIT_DATABASE_URL`, depois `DIRECT_URL`, depois `DATABASE_URL`; credenciais não são impressas. A opção `--include-records` inclui os quatro campos de cada registro na saída. O relatório completo desta execução ficou em `/tmp/product-prices-248-audit.json`, fora do versionamento.

## Validação automatizada

- Frontend, após os ajustes da revisão final: `npm test -- --maxWorkers=2` — **55 arquivos e 577 testes aprovados**.
- Backend direcionado: `cars.service.spec.ts`, `product-prices.spec.ts`, `public-catalog-projection.spec.ts`, `product-services-monetary-update.spec.ts` e `product-monetary-lock.spec.ts` — **5 arquivos e 32 testes aprovados**. Após o apontamento de revisão, a fixture do teste existente de busca por UUID foi atualizada para incluir o preço Decimal obrigatório e conferir a resposta numérica com a moeda preservada.
- Revisão final do backend: `env -u POSTGRES_CONCURRENCY_TEST_URL npm test -- --runInBand '--testPathIgnorePatterns=\.postgres\.spec\.ts$'` — **68 arquivos e 1.070 testes unitários aprovados**.
- Builds de frontend e backend aprovados. O frontend mantém o aviso de tamanho do bundle.
- Frontend: `npm run lint -- --quiet` — aprovado.
- Backend: ESLint nos arquivos TypeScript alterados/adicionados, com `--quiet` e sem `--fix` — aprovado. O comando `--help` do script de auditoria também foi validado, sem conexão ao banco.
- Cobertura de lista/detalhe para `950000.00`, `1000000.00`, `1500000.00` e centavos `.01`/`.50`, números e strings, BRL/USD. O backend cobre os três tipos, com e sem imagens.
- O formulário real, com serviços de persistência simulados, foi testado nos três tipos: reabertura, edição sem mudança de magnitude/moeda, cadastro com centavos e bloqueio de valores inválidos. Nenhum teste salvou produtos no banco remoto.
- Simulação de merge dos arquivos compartilhados com a branch da #247 (`dc131281bc8bab028cad00347f8cfce79732f132`): sem conflito textual. Isso se aplica aos conteúdos verificados; alterações futuras podem mudar o resultado.

### Limitação da suíte geral do backend

A execução geral também foi tentada, sem `POSTGRES_CONCURRENCY_TEST_URL`: 69 arquivos passaram, dois foram ignorados e quatro arquivos de integração PostgreSQL falharam durante a inicialização, antes de executar seus testes. Eles instanciam clientes/constroem URLs mesmo dentro de `describe.skip`, usando uma URL de banco de teste inexistente:

- `proposals-concurrency.postgres.spec.ts`
- `processes-dedup-concurrency.postgres.spec.ts`
- `contracts-lock.postgres.spec.ts`
- `product-monetary-lock.postgres.spec.ts`

As mesmas quatro falhas foram reproduzidas em uma cópia limpa de `origin/develop` (`e4b76c4d806083e77f05656700036f1ef4636972`), sem as mudanças da #248. Não são regressões introduzidas pela task. Os testes de integração que exigem PostgreSQL dedicado não foram validados nesta revisão. Nenhum banco remoto foi usado para executar esses testes. Logs da revisão permanecem em `/tmp/task-248-*.log`, fora do versionamento.

## Validação após publicação

Após revisão, integração e deploy, conferir lista e detalhe dos três registros identificados, além de cadastro/edição/reabertura de produtos de teste nos três tipos e nas duas moedas. A validação automatizada local e a auditoria não substituem essa conferência do ambiente publicado. A correção não altera preços já armazenados.
