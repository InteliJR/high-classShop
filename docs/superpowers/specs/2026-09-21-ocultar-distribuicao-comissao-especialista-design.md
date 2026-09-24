# Ocultar a distribuição da comissão do especialista

## Contexto

Na criação do contrato, o especialista define a porcentagem total de comissão da venda. A interface atual também revela a comissão total, o valor líquido do vendedor e os repasses da plataforma e do escritório. Esses dados fazem parte da composição interna do contrato, mas não devem ser apresentados ao especialista.

## Objetivo

Exibir ao especialista somente o valor final que ele receberá pela venda, formatado na moeda da negociação (`BRL` ou `USD`), sem alterar o cálculo financeiro nem o payload enviado ao backend.

## Escopo da interface

### Etapa de configuração da comissão

- Manter o valor total do produto como contexto da negociação.
- Manter o campo editável de porcentagem da comissão total.
- Exibir somente o resultado **Seu ganho estimado**, usando o repasse calculado do especialista.
- Não exibir comissão total, valor líquido do vendedor, valor da plataforma, valor do escritório nem o título “Distribuição da comissão”.
- Ajustar o texto auxiliar do percentual para não mencionar as partes do split.

### Etapa de dados do contrato

- No resumo financeiro, manter o valor total do produto e exibir somente **Valor da sua comissão**.
- Não exibir comissão total, valor líquido do vendedor, valor da plataforma, valor do escritório nem percentuais internos de distribuição.
- Na seção de dados do especialista, manter o campo de comissão já existente, pois ele representa o mesmo valor final recebido pelo especialista.

## Arquitetura e fluxo de dados

`CreateContractPage` continuará calculando o split completo por meio de `getCommissionPreview`. Os valores internos permanecem disponíveis para montar o contrato e enviar o payload esperado pela API. A mudança ficará restrita à apresentação:

- `ContractCommissionStep` receberá apenas o valor final necessário para a prévia do especialista, além dos dados de preço, moeda e formulário.
- `CreateContractPage` deixará de renderizar as parcelas internas no resumo financeiro.
- Nenhum contrato de serviço, DTO ou endpoint será alterado.

Essa separação evita regressões na geração e assinatura de contratos e restringe somente o que o especialista consegue visualizar.

## Estados e erros

- Enquanto a porcentagem estiver vazia ou for zero, o ganho estimado não será exibido, preservando o comportamento atual da prévia.
- As validações existentes de percentual obrigatório e faixa entre 0 e 100 permanecem iguais.
- A formatação continuará usando a moeda recebida no prefill do processo, sem conversão de valores.
- Os fluxos de carregamento, preview, cancelamento e envio do contrato não mudam.

## Testes

Adicionar testes de regressão da interface que comprovem:

1. O especialista vê o próprio ganho estimado na primeira etapa em BRL.
2. O mesmo valor é formatado corretamente em USD quando essa é a moeda da negociação.
3. Comissão total, líquido do vendedor, plataforma, escritório e distribuição não aparecem na primeira etapa.
4. As mesmas informações internas não aparecem no resumo da segunda etapa.
5. O avanço entre etapas e a montagem do contrato continuam funcionando com o cálculo interno preservado.

## Fora de escopo

- Alterar regras ou percentuais do split.
- Alterar os dados retornados pelo backend.
- Alterar o documento gerado ou os campos enviados ao provedor de assinatura.
- Mudar permissões de administradores ou outros papéis.
