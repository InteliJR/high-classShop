# Final fix report — calculadora de spread de comissões

Data: 2026-08-03

## Correções aplicadas

1. Os dois calculadores convertem os textos dos campos em um objeto de cálculo
   normalizado: valores não finitos viram `0`, a venda é limitada ao mínimo `0`
   e todas as taxas são limitadas a `0–100`. O estado continua textual para não
   interromper a edição de números decimais.
2. A tabela completa agora mostra `Restante` entre `Especialista` e
   `Escritório`, calculado como `bolo - specialistValue`; a ordem fica
   Bolo → Especialista → Restante → Escritório → Plataforma e a taxa efetiva é
   exibida pela mesma função das demais linhas.
3. A página completa controla o produto selecionado. Ao trocar categoria,
   limpa o id, as opções carregadas e o preço associado, evitando reaproveitar
   visualmente um produto/preço de outra categoria.

## Verificações

- RED: `npm run test -- src/lib/commission-calculator-input.test.ts --maxWorkers=2 --no-file-parallelism` falhou antes da implementação porque o módulo ainda não existia.
- GREEN focado: o mesmo comando passou com 2 testes.
- Suite: `npm run test -- --maxWorkers=2 --no-file-parallelism` — 2 arquivos, 9 testes aprovados.
- Lint: `npm run lint` — exit 0; 122 avisos pré-existentes fora dos arquivos alterados.
- Build: `npm run build` — exit 0.

## Commit

As correções e este relatório estão no commit desta alteração.
