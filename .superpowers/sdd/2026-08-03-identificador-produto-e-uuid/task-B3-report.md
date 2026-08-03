# B3 — Frontend: identificador de produto como UUID

## Escopo implementado

- Os contratos `RawCar`, `RawBoat`, `RawAircraft` e `Product` agora usam `id: string`.
- As operações de produto por identificador (`get`, `update` e `delete`) recebem UUIDs como `string`.
- As telas de catálogo, formulário e gestão de produtos preservam o identificador da rota sem conversão numérica.
- Os contratos que propagam o identificador do produto para processos, agendamentos, seleção de produto e criação de processo pelo consultor agora usam `string`.

## Verificação

- `cd frontend && grep -rnE "Number\\((id|product\\.id|productId)" src` não retornou ocorrências.
- `cd frontend && npm run build` concluiu com sucesso (`tsc -b` e `vite build`).
- O Vite emitiu apenas o aviso preexistente de chunks acima de 500 kB; não houve erro de compilação.

## Limites respeitados

- Nenhuma alteração em comissões.
- Nenhum servidor iniciado.
- Nenhum schema ou reset executado.

## Correção da revisão

- `ConfirmAppointmentModal` e `useCreateAppointment` agora aceitam somente `productId`/`product_id` como `string`.
- Os contratos de listagem e detalhe em `select-options.service.ts` usam identificadores de produto como `string`.
- Os objetos `product` aninhados de processos (`processes.service.ts`, `ProcessCard` e `CustomerProcessesPage`) foram alinhados a UUIDs como `string`.
