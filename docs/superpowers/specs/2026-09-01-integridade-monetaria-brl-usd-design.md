# Integridade monetária BRL/USD

## Contexto

A branch `feat/product-currency-brl-usd` permite cadastrar produtos em BRL ou
USD e já formata parte do catálogo e da negociação conforme a moeda escolhida.
A vistoria, porém, encontrou fontes monetárias inconsistentes: alguns campos
continuam fixos em BRL, propostas dependem da moeda atual do produto,
notificações usam `R$` diretamente e a página de contrato não herda a moeda da
negociação.

Esta especificação torna a moeda do processo imutável a partir do início da
negociação e a propaga até a página de preenchimento do contrato e os cálculos
de comissão. Não haverá conversão cambial.

## Objetivos

- Preservar valor original e moeda quando o processo entra em `NEGOTIATION`.
- Manter processos BRL inteiramente em BRL e processos USD inteiramente em USD.
- Impedir que a edição posterior do produto altere uma negociação aberta.
- Respeitar imediatamente a configuração administrativa de valor mínimo.
- Usar formatação monetária única em todas as interfaces e notificações do
  escopo.
- Exibir a moeda correta na página de preenchimento do contrato e nas prévias
  de comissão.

## Fora do escopo

- Conversão entre BRL e USD ou consulta de câmbio.
- Alteração do template/documento final do contrato.
- Correção da migration antiga que adiciona o papel `OFFICE`.
- Redesenho responsivo da tabela de gestão de produtos, que terá especificação
  própria.
- Inserir a moeda no nome, marca, modelo ou identificador do produto.

## Decisões aprovadas

1. O `Process` será a fonte monetária da negociação.
2. Valor e moeda serão congelados quando o processo entrar em `NEGOTIATION`.
3. Se o produto for associado depois de o processo já estar em
   `NEGOTIATION`, o snapshot será criado durante essa associação.
4. Durante `NEGOTIATION`, alterações de valor ou moeda do produto serão
   bloqueadas; os demais campos continuarão editáveis.
5. Depois de o processo sair de `NEGOTIATION`, o produto poderá ser editado se
   não estiver vinculado a outra negociação ativa, pois cada processo manterá
   sua própria cópia imutável.
6. USD será mantido até a página de preenchimento do contrato e a divisão de
   comissão, sem conversão para BRL.
7. A interface usará locale `pt-BR`: `R$ 120.000,00` ou `US$ 120.000,00`.
8. O template/documento final do contrato será tratado futuramente.
9. A configuração administrativa de proposta mínima continuará dinâmica e
   valerá imediatamente para negociações abertas.

## Modelo de dados

O modelo `Process` receberá:

```prisma
negotiation_currency      ProductCurrency?
negotiation_product_value Decimal?         @db.Decimal(15, 2)
```

Os campos são opcionais porque processos de consultoria podem chegar a
`NEGOTIATION` sem produto. Quando existir produto associado, os dois campos
devem estar preenchidos juntos.

`NegotiationProposal` continuará armazenando somente `proposed_value`. A moeda
da proposta será `process.negotiation_currency`, evitando duplicação em cada
rodada da negociação.

### Backfill

A migration preencherá processos existentes que já alcançaram a negociação.
Serão incluídos processos em `NEGOTIATION`, `PROCESSING_CONTRACT`,
`DOCUMENTATION` ou `COMPLETED`, além de processos `REJECTED` que possuam ao
menos uma proposta. O valor e a moeda virão, nessa ordem, do produto associado
pelo tipo do processo:

- `Process.car`;
- `Process.boat`;
- `Process.aircraft`.

Somente processos elegíveis e com produto receberão snapshot. Processos em
`SCHEDULING` não serão antecipadamente congelados. Processos sem produto
continuarão com os dois campos nulos até a associação durante `NEGOTIATION`.

## Criação do snapshot

O snapshot deve ser criado atomicamente em dois caminhos:

1. na transição do processo para `NEGOTIATION`, se já houver produto; e
2. na associação de produto a um processo cujo status já seja `NEGOTIATION`.

O serviço deve ler `valor` e `currency` do produto dentro da operação que
atualiza o processo. Caso apenas um dos campos do snapshot esteja preenchido,
a operação deve falhar como estado inconsistente, sem sobrescrever dados.

Uma vez preenchidos, os campos não podem ser recalculados por operações comuns
do fluxo. Isso preserva o histórico mesmo depois que o produto voltar a ser
editável.

## Bloqueio de edição do produto

Os serviços de carro, barco e aeronave devem detectar mudanças efetivas em
`valor` ou `currency`. Se o produto estiver associado a qualquer processo em
`NEGOTIATION`, a alteração será rejeitada antes da gravação.

O erro terá código de domínio estável:

```json
{
  "code": "PRODUCT_MONETARY_FIELDS_LOCKED",
  "message": "Valor e moeda não podem ser alterados enquanto o produto estiver em negociação."
}
```

Enviar os mesmos valores já persistidos não será considerado alteração. Marca,
modelo, descrição, imagens, estado e demais atributos continuarão editáveis.

## Propostas e valor mínimo

O serviço de propostas deixará de usar `product.valor` e passará a usar:

- `process.negotiation_product_value` para valor original e cálculo do mínimo;
- `process.negotiation_currency` para metadados e formatação.

Se o processo estiver em `NEGOTIATION` com produto, mas sem snapshot, a API
deve retornar erro de consistência em vez de continuar com valor zero ou moeda
implícita.

### Configuração administrativa

Quando `minimum_proposal_enabled` estiver ativada:

```text
minimum_value = negotiation_product_value * minimum_proposal_percentage
```

Quando estiver desativada:

- nenhuma proposta será rejeitada por percentual mínimo;
- a API retornará `minimum_enabled: false`;
- `minimum_value` será `null`;
- a interface esconderá os textos e destaques de valor mínimo.

A configuração será consultada durante cada leitura e envio de proposta.
Alterações feitas pelo admin afetarão imediatamente negociações já abertas.

## Contrato e comissão

A resposta de prefill do contrato incluirá `currency`, derivada do snapshot do
processo. A página de preenchimento usará essa moeda para:

- proposta aceita;
- preço do produto;
- valor líquido do vendedor;
- comissão total;
- parcelas de plataforma, escritório e especialista;
- campos somente leitura e resumos das etapas.

Os cálculos continuam operando sobre números e percentuais, sem conversão. A
moeda afeta a unidade e a apresentação, não a aritmética.

O template, preview documental e arquivo final do contrato não serão alterados
nesta entrega.

## Interface e formatação

Uma única utilidade compartilhada formatará valores monetários:

```ts
formatCurrency(value, "BRL") // R$ 120.000,00
formatCurrency(value, "USD") // US$ 120.000,00
```

Aplicações obrigatórias:

- cabeçalho, histórico, formulário e mensagens de erro da negociação;
- tela equivalente do consultor;
- listagens e detalhes de produtos;
- página de preenchimento do contrato;
- componentes de divisão de comissão usados por essa página;
- notificações de proposta criada, aceita e rejeitada.

O prefixo do campo de proposta deve ser derivado da moeda do processo. Não será
adicionado texto como “Produto BRL” ou “Produto USD” a nomes, títulos ou modelos;
o valor formatado será suficiente para comunicar a unidade.

## Notificações

Os payloads de notificação de proposta receberão `currency`. HTML e texto puro
usarão a mesma função ou regra compartilhada de formatação. Os eventos cobertos
são:

- nova proposta;
- proposta aceita;
- proposta rejeitada.

Uma notificação nunca poderá inferir BRL por ausência silenciosa da moeda. A
moeda deve vir do snapshot do processo.

## Compatibilidade e tratamento de dados ausentes

- Produtos antigos permanecem BRL devido ao default já introduzido no schema.
- Processos antigos com produto serão preenchidos pelo backfill.
- Processo de consultoria sem produto pode permanecer sem snapshot.
- Negociação com produto e snapshot ausente é erro de consistência explícito.
- Não haverá fallback silencioso para BRL dentro do fluxo de negociação ou
  contrato.

## Testes

### Backend

- snapshot BRL ao entrar em `NEGOTIATION`;
- snapshot USD ao entrar em `NEGOTIATION`;
- snapshot na associação tardia de carro, barco e aeronave;
- snapshot imutável após criação;
- bloqueio de mudança de valor;
- bloqueio de mudança de moeda;
- permissão para alterar campos não monetários;
- proposta mínima calculada sobre o valor congelado;
- mínimo desativado sem rejeição e com `minimum_value: null`;
- alteração administrativa aplicada a negociação aberta;
- notificações BRL e USD;
- prefill do contrato com a moeda do processo;
- erro explícito para processo inconsistente.

### Frontend

- formatação BRL e USD em `pt-BR`;
- símbolo correto no campo de proposta;
- mínimo escondido quando desativado;
- histórico e cabeçalho usando a moeda do processo;
- página do contrato e divisão de comissão em BRL e USD;
- mensagem específica para edição monetária bloqueada.

### Verificação integrada

- build do backend;
- build do frontend;
- fluxo local completo BRL;
- fluxo local completo USD;
- confirmação de que nenhuma tela do escopo mostra `R$` para processo USD;
- confirmação de que o documento/template final não foi modificado.

Os testes amplos devem respeitar o limite global de no máximo dois workers.

## Critérios de aceite

1. Uma negociação não muda de moeda nem de valor original depois de iniciada.
2. Alterar valor ou moeda do produto durante `NEGOTIATION` é bloqueado no
   backend.
3. Propostas BRL e USD aplicam corretamente a configuração de mínimo.
4. Desativar o mínimo remove a validação e sua exibição imediatamente.
5. USD permanece USD até a página do contrato e a divisão de comissão.
6. Todas as interfaces do escopo usam `R$` ou `US$` com locale `pt-BR`.
7. Notificações do fluxo não usam símbolo fixo.
8. Nenhuma conversão cambial é executada.
9. O template/documento final do contrato permanece inalterado.

## Dependência conhecida

Uma migration anterior, `20260602120000_add_office_role_and_invite_jobs`, não
é aplicável em um PostgreSQL limpo porque adiciona e utiliza o valor `OFFICE` do
enum na mesma transação. A correção será especificada separadamente. Até lá, a
verificação desta entrega deve registrar que `prisma migrate deploy` completo
em banco vazio permanece bloqueado por essa migration preexistente.
