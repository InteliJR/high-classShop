# Desativação do valor mínimo de propostas

## Objetivo

Desativar integralmente a regra de valor mínimo de propostas durante a negociação, sem remover o suporte técnico que permitiria restaurá-la em uma futura alteração de código. Enquanto este desenho estiver vigente, nenhuma configuração persistida, chamada administrativa ou resposta antiga da API poderá ativar a regra ou revelar um valor mínimo no frontend.

O filtro “Preço mínimo” do catálogo permanece inalterado, pois serve apenas para pesquisa de produtos e não participa da negociação.

## Comportamento esperado

- Toda proposta monetária válida maior que zero pode ser enviada, mesmo abaixo da porcentagem mínima armazenada.
- A API de negociação informa `minimum_enabled: false` e `minimum_value: null`.
- Uma configuração legada `minimum_proposal_enabled=true` no banco não altera esse comportamento.
- Uma tentativa de atualizar `minimum_proposal_enabled` para `true` pela API administrativa é recusada.
- As telas de negociação do cliente e do consultor não mostram valor mínimo, dica de valor mínimo ou erro de formulário relacionado a essa regra.
- A tela administrativa não mostra controles para ativar a regra nem editar sua porcentagem.
- O cálculo, os tipos e as chaves de configuração existentes podem permanecer no código para uma eventual reintrodução deliberada por mudança de código.

## Arquitetura

### Trava central no backend

O backend terá uma constante de disponibilidade definida em código e fixada como desativada. `SettingsService.isMinimumProposalEnabled()` consultará essa disponibilidade antes de considerar qualquer valor persistido e, no estado atual, sempre responderá `false`.

O endpoint de atualização de configurações recusará explicitamente a tentativa de salvar `minimum_proposal_enabled=true`. Atualizações para `false` continuam permitidas. Isso cria duas barreiras independentes: não é possível ativar pela API e um valor `true` já existente no banco é ignorado.

Uma nova migração atualizará registros existentes de `minimum_proposal_enabled` para `false`. A migração mantém o banco coerente, mas não será a única garantia de segurança.

### Fluxo de propostas

O serviço de propostas continuará usando `isMinimumProposalEnabled()` como ponto único de decisão. Como a trava retorna `false`, ele não buscará a porcentagem, não calculará um limite, não rejeitará propostas abaixo dele e devolverá os metadados desativados. O algoritmo de cálculo permanece disponível, mas não alcançável no fluxo atual.

### Frontend

Os controles de valor mínimo serão removidos da página administrativa. As páginas de negociação do cliente e do consultor deixarão de renderizar os blocos de informação e as dicas do formulário relacionadas ao mínimo.

O frontend continuará aceitando os campos `minimum_enabled` e `minimum_value` no contrato da API para preservar compatibilidade. A apresentação terá uma trava local fixa como proteção adicional contra respostas antigas ou inconsistentes que indiquem o mínimo como ativo. Erros legados de mínimo recebidos durante uma atualização de versão serão descartados em vez de exibidos.

## Tratamento de erros

A tentativa administrativa de ativação retornará erro de requisição inválida com uma mensagem informando que a funcionalidade está indisponível. Os demais erros de configuração e de propostas permanecem inalterados.

## Testes

Os testes serão escritos antes das mudanças de produção e deverão provar que:

1. `isMinimumProposalEnabled()` retorna `false` mesmo quando o banco contém `true`.
2. A API de configurações não permite atualizar a chave de ativação para `true` e ainda permite mantê-la em `false`.
3. A criação de proposta abaixo do limite antigo é aceita e não consulta a porcentagem quando a trava está desligada.
4. A resposta da negociação contém `minimum_enabled: false` e `minimum_value: null`.
5. A camada de apresentação do frontend nunca expõe o mínimo, mesmo recebendo `minimum_enabled: true` e um valor preenchido.
6. As telas não contêm controles, rótulos ou dicas de valor mínimo de proposta.
7. O filtro “Preço mínimo” do catálogo continua presente e funcional.

## Fora do escopo

- Remover definitivamente o cálculo, as colunas, as chaves de configuração ou os tipos do valor mínimo.
- Alterar filtros de preço do catálogo.
- Modificar outras regras de validade, permissão ou alternância de propostas.
